import {
  getObjectionDef,
  seenObjectionIds,
} from "./objection-library";

/**
 * Deterministic full-call memory — no extra LLM calls, no server state.
 * Rebuilt from the cumulative transcript (client sends it each turn) plus
 * the coach lines already stored for this session, so it survives
 * serverless instance churn.
 */

export type CallMemory = {
  /** Objection ids raised anywhere in the call so far. */
  objectionIds: string[];
  /** Most recent coach suggestions (newest last), stage tags stripped. */
  recentCoachLines: string[];
  /** How the call opened — kept when the live window has scrolled past it. */
  openingSnippet: string;
};

const MAX_RECENT_LINES = 3;
const OPENING_CHARS = 220;
/** Only carry an opening snippet once the live window can no longer see it. */
const OPENING_MIN_TRANSCRIPT = 1100;

export function buildCallMemory(
  fullTranscript: string,
  recentCounterTexts: string[],
): CallMemory {
  const transcript = fullTranscript.trim();
  return {
    objectionIds: seenObjectionIds(transcript),
    recentCoachLines: recentCounterTexts
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(-MAX_RECENT_LINES),
    openingSnippet:
      transcript.length > OPENING_MIN_TRANSCRIPT
        ? transcript.slice(0, OPENING_CHARS)
        : "",
  };
}

/** Compact prompt block (~80–150 tokens). Empty string when nothing to say. */
export function formatMemoryContext(memory: CallMemory): string {
  const parts: string[] = [];

  if (memory.objectionIds.length) {
    const labels = memory.objectionIds
      .map((id) => getObjectionDef(id)?.label ?? id)
      .join("; ");
    parts.push(
      `Objections already raised this call: ${labels}. If one comes up again use a NEW angle or advance the sale — never repeat an answer that didn't land.`,
    );
  }

  if (memory.recentCoachLines.length) {
    const quoted = memory.recentCoachLines.map((l) => `"${l}"`).join(" / ");
    parts.push(`Your last suggestions (do NOT repeat any of these): ${quoted}`);
  }

  if (memory.openingSnippet) {
    parts.push(`Call opened with: "${memory.openingSnippet}…"`);
  }

  if (!parts.length) return "";
  return `CALL MEMORY:\n- ${parts.join("\n- ")}`;
}
