import { createServiceClient } from "@/lib/supabase/service";
import { runPostCallSwarm } from "./post-call";
import { geminiText, parseJsonBlock } from "./gemini-shared";
import { getCoachStackConfig } from "./config";
import { normalizeNiche } from "@/lib/calls/niche";
import { upsertPlaybookEntry } from "./playbook";

const BATCH_LIMIT = 25;

const DAILY_SYSTEM = `You are a sales ops analyst for a web-design cold-calling team.
Given aggregate stats and sample calls, produce JSON only:
{
  "headline": "one line",
  "wins_vs_losses": "short comparison",
  "top_objections": ["..."],
  "script_tweaks": ["actionable tweak 1", "tweak 2"],
  "focus_niche": "which niche to prioritize tomorrow and why",
  "playbook_candidates": [
    {"niche":"roofing|all","objection_pattern":"...","winning_response":"..."}
  ]
}
Max 3 playbook_candidates. Be specific to $599 one-time websites for locals with no site.`;

export type BatchResult = {
  processed: number;
  failed: number;
  dailyInsight: boolean;
};

export async function runPendingCallAnalysis(): Promise<BatchResult> {
  const supabase = createServiceClient();
  const { data: pending, error } = await supabase
    .from("call_sessions")
    .select("id")
    .eq("analysis_status", "pending")
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) throw new Error(error.message);

  let processed = 0;
  let failed = 0;

  for (const row of pending ?? []) {
    try {
      await runPostCallSwarm(row.id);
      processed += 1;
    } catch {
      failed += 1;
    }
  }

  const dailyInsight = await runDailyInsightReport(supabase);

  return { processed, failed, dailyInsight };
}

async function runDailyInsightReport(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<boolean> {
  const stack = getCoachStackConfig();
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data: existing } = await supabase
    .from("daily_insights")
    .select("id")
    .eq("report_date", today)
    .maybeSingle();

  if (existing) return false;

  const { data: sessions } = await supabase
    .from("call_sessions")
    .select(
      "outcome_status, niche, rep_score, summary, objections, duration_seconds",
    )
    .gte("ended_at", since)
    .eq("analysis_status", "completed");

  if (!sessions?.length) return false;

  const interested = sessions.filter(
    (s) => s.outcome_status === "Interested/Closed",
  ).length;
  const notInterested = sessions.filter(
    (s) => s.outcome_status === "Not Interested",
  ).length;
  const wrong = sessions.filter((s) => s.outcome_status === "Wrong Number").length;
  const avgScore =
    sessions.reduce((a, s) => a + (s.rep_score ?? 0), 0) /
    Math.max(1, sessions.filter((s) => s.rep_score).length);

  const samples = sessions
    .filter((s) => s.summary)
    .slice(-8)
    .map(
      (s) =>
        `- ${s.outcome_status} (${normalizeNiche(s.niche)}): ${s.summary?.slice(0, 200)}`,
    )
    .join("\n");

  const payload = [
    `Calls last 7d: ${sessions.length}`,
    `Interested: ${interested}, Not interested: ${notInterested}, Wrong: ${wrong}`,
    `Avg rep score: ${avgScore.toFixed(1)}`,
    "",
    "Samples:",
    samples,
  ].join("\n");

  const raw = await geminiText(stack.geminiModel, DAILY_SYSTEM, payload);
  const parsed = parseJsonBlock<Record<string, unknown>>(raw);
  const content = parsed ?? { raw, generated_at: new Date().toISOString() };

  await supabase.from("daily_insights").insert({
    report_date: today,
    content,
  });

  const candidates = (
    parsed as { playbook_candidates?: Array<Record<string, string>> } | null
  )?.playbook_candidates;

  if (Array.isArray(candidates)) {
    for (const c of candidates.slice(0, 3)) {
      if (!c.objection_pattern || !c.winning_response) continue;
      await upsertPlaybookEntry({
        niche: normalizeNiche(c.niche),
        objectionPattern: c.objection_pattern,
        winningResponse: c.winning_response,
        sourceSessionId: null,
        won: true,
      });
    }
  }

  return true;
}
