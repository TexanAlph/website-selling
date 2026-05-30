import type { LlmProvider, SttProvider } from "./types";

export type CoachStackConfig = {
  stt: SttProvider;
  llm: LlmProvider;
  geminiModel: string;
  /** Human-readable labels for the dialer UI */
  labels: {
    stt: string;
    llm: string;
  };
};

/**
 * Free-first defaults:
 * - STT: Safari Web Speech ($0) unless DEEPGRAM_API_KEY is set
 * - LLM: Gemini via Google AI Studio free tier
 */
export function getCoachStackConfig(): CoachStackConfig {
  const forced = process.env.COACH_STT_PROVIDER?.toLowerCase() ?? "auto";
  const hasDeepgram = Boolean(process.env.DEEPGRAM_API_KEY?.trim());

  let stt: SttProvider = "webspeech";
  if (forced === "webspeech") {
    stt = "webspeech";
  } else if (forced === "deepgram" && hasDeepgram) {
    stt = "deepgram";
  } else if (forced === "auto" && hasDeepgram) {
    stt = "deepgram";
  }

  const geminiModel =
    process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";

  return {
    stt,
    llm: "gemini",
    geminiModel,
    labels: {
      stt:
        stt === "deepgram"
          ? "Deepgram Nova (free credits)"
          : "Safari speech (free)",
      llm: `Gemini (${geminiModel})`,
    },
  };
}
