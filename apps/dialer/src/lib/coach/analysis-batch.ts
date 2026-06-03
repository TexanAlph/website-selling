import { runPostCallSwarm } from "./post-call";
import { geminiText, parseJsonBlock } from "./gemini-shared";
import { getCoachStackConfig } from "./config";
import { normalizeNiche } from "@/lib/calls/niche";
import { upsertPlaybookEntry } from "./playbook";
import { buildDailyAnalystPrompt } from "./sales-sop";
import * as storage from "@/lib/storage/client";

const BATCH_LIMIT = 25;

export type BatchResult = {
  processed: number;
  failed: number;
  dailyInsight: boolean;
};

export async function runPendingCallAnalysis(): Promise<BatchResult> {
  const pending = await storage.listPendingAnalysis(BATCH_LIMIT);

  let processed = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      await runPostCallSwarm(row.id);
      processed += 1;
    } catch {
      failed += 1;
    }
  }

  const dailyInsight = await runDailyInsightReport();

  return { processed, failed, dailyInsight };
}

async function runDailyInsightReport(): Promise<boolean> {
  const stack = getCoachStackConfig();
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 7 * 86400000).toISOString();

  if (await storage.dailyInsightExists(today)) return false;

  const sessions = await storage.listCompletedSessionsSince(since);
  if (!sessions.length) return false;

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

  const raw = await geminiText(stack.geminiModel, buildDailyAnalystPrompt(), payload);
  const parsed = parseJsonBlock<Record<string, unknown>>(raw);
  const content = parsed ?? { raw, generated_at: new Date().toISOString() };

  await storage.insertDailyInsight(today, content);

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
