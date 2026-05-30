import { createServerClient } from "@/lib/supabase/server";
import { normalizeNiche } from "@/lib/calls/niche";
import {
  fetchLeadContext,
  getSessionForAnalysis,
  markSessionAnalysis,
} from "@/lib/calls/sessions";
import { bumpPlaybookOutcomes, upsertPlaybookEntry } from "./playbook";
import { geminiText, parseJsonBlock } from "./gemini-shared";
import { getCoachStackConfig } from "./config";

type SummaryResult = { summary: string };
type ScoreResult = {
  rep_score: number;
  objections: string[];
  recommendations: string;
  opener_suggestion: string;
};
type PlaybookExtract = {
  objection_pattern: string;
  winning_response: string;
  worth_saving: boolean;
};

const SUMMARIZER_SYSTEM = `You summarize cold calls for a web design sales rep ($599 sites, local businesses without websites).
Return JSON only: {"summary":"2-4 sentences: what happened, tone, next step if any"}`;

const SCORER_SYSTEM = `You coach outbound sales reps selling websites to local service businesses.
Return JSON only:
{
  "rep_score": 1-10,
  "objections": ["short phrases the prospect raised"],
  "recommendations": "2-3 bullet-style sentences to improve the next call",
  "opener_suggestion": "one sentence opener for tomorrow in this niche"
}`;

const PLAYBOOK_SYSTEM = `Extract one reusable counter from a successful website sales call.
Return JSON only:
{
  "worth_saving": true|false,
  "objection_pattern": "short phrase prospect said",
  "winning_response": "what the rep said that worked (max 2 sentences)"
}
Only worth_saving true if outcome was Interested/Closed and a clear objection/response pair exists.`;

export async function runPostCallSwarm(sessionId: string) {
  const stack = getCoachStackConfig();
  const model = stack.geminiModel;

  await markSessionAnalysis(sessionId, { analysis_status: "processing" });

  try {
    const session = await getSessionForAnalysis(sessionId);
    const lead = await fetchLeadContext(session.lead_id);
    const transcript =
      session.transcript_full?.trim() ||
      "(no transcript captured — coach may have been off or call was very short)";
    const outcome = session.outcome_status ?? "unknown";
    const niche = normalizeNiche(session.niche ?? lead?.niche);
    const business = lead?.business_name ?? "unknown business";

    const context = [
      `Business: ${business}`,
      `Niche: ${niche}`,
      `Outcome: ${outcome}`,
      `Duration: ${session.duration_seconds ?? 0}s`,
      `Source: ${session.call_source}`,
      "",
      "Transcript:",
      transcript.slice(-6000),
    ].join("\n");

    const [summaryRaw, scoreRaw, playbookRaw] = await Promise.all([
      geminiText(model, SUMMARIZER_SYSTEM, context),
      geminiText(model, SCORER_SYSTEM, context),
      outcome === "Interested/Closed"
        ? geminiText(model, PLAYBOOK_SYSTEM, context)
        : Promise.resolve(""),
    ]);

    const summaryParsed = parseJsonBlock<SummaryResult>(summaryRaw);
    const scoreParsed = parseJsonBlock<ScoreResult>(scoreRaw);
    const playbookParsed = playbookRaw
      ? parseJsonBlock<PlaybookExtract>(playbookRaw)
      : null;

    const summary =
      summaryParsed?.summary ??
      (summaryRaw.slice(0, 800) || "Call ended; no summary generated.");
    const repScore = clampScore(scoreParsed?.rep_score);
    const objections = scoreParsed?.objections?.slice(0, 8) ?? [];
    const recommendations = scoreParsed?.recommendations ?? "";
    const openerSuggestion = scoreParsed?.opener_suggestion ?? "";

    await markSessionAnalysis(sessionId, {
      analysis_status: "completed",
      summary,
      objections,
      rep_score: repScore,
      recommendations,
      opener_suggestion: openerSuggestion,
    });

    const supabase = createServerClient();
    await supabase.from("coach_messages").insert({
      session_id: sessionId,
      lead_id: session.lead_id,
      role: "summary",
      content: summary,
    });

    if (
      playbookParsed?.worth_saving &&
      playbookParsed.objection_pattern &&
      playbookParsed.winning_response
    ) {
      await upsertPlaybookEntry({
        niche,
        objectionPattern: playbookParsed.objection_pattern.slice(0, 200),
        winningResponse: playbookParsed.winning_response.slice(0, 500),
        sourceSessionId: sessionId,
        won: true,
      });
    }

    await bumpPlaybookOutcomes(niche, outcome);
  } catch (e) {
    await markSessionAnalysis(sessionId, {
      analysis_status: "failed",
      summary: e instanceof Error ? e.message : "Analysis failed",
    });
    throw e;
  }
}

function clampScore(n: unknown): number | null {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return Math.min(10, Math.max(1, Math.round(n)));
}
