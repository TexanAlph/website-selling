import { normalizeNiche } from "@/lib/calls/niche";
import {
  fetchLeadContext,
  getSessionForAnalysis,
  markSessionAnalysis,
} from "@/lib/calls/sessions";
import { bumpPlaybookOutcomes, upsertPlaybookEntry } from "./playbook";
import { parseJsonBlock } from "./llm-client";
import { batchLlmText, formatAnalysisFailure } from "./batch-llm";
import { requireBatchLlm } from "./config";
import { buildPostCallSystemPrompt } from "./sales-sop";
import * as storage from "@/lib/storage/client";

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

export async function runPostCallSwarm(sessionId: string) {
  const batch = requireBatchLlm();

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
      `Rep: ${session.rep_name ?? "unknown"}`,
      "",
      "Transcript:",
      transcript.slice(-6000),
    ].join("\n");

    const [summaryRaw, scoreRaw, playbookRaw] = await Promise.all([
      batchLlmText(batch, buildPostCallSystemPrompt("summarize"), context),
      batchLlmText(batch, buildPostCallSystemPrompt("score"), context),
      outcome === "Interested/Closed"
        ? batchLlmText(batch, buildPostCallSystemPrompt("playbook"), context)
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

    await storage.insertCoachMessage({
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
      summary: formatAnalysisFailure(e),
    });
    throw e;
  }
}

function clampScore(n: unknown): number | null {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return Math.min(10, Math.max(1, Math.round(n)));
}
