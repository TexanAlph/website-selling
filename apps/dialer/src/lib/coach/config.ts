import type { LlmProvider, SttProvider } from "./types";
import type { LlmCallConfig } from "./llm-client";

export type CoachStackConfig = {
  stt: SttProvider;
  /** Live coach during calls — OpenRouter + DeepSeek by default */
  liveLlm: LlmCallConfig;
  /** Post-call swarm + nightly insights — Gemini free tier */
  batchLlm: LlmCallConfig;
  labels: {
    stt: string;
    liveLlm: string;
    batchLlm: string;
  };
};

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_OPENROUTER_LIVE_MODEL = "deepseek/deepseek-chat-v3-0324";

/**
 * - STT: Safari Web Speech ($0) unless DEEPGRAM_API_KEY is set
 * - Live LLM: OpenRouter + DeepSeek (high RPM, pay-per-token)
 * - Batch LLM: Gemini AI Studio free tier (post-call + nightly)
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

  const batchModel =
    process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const liveModel =
    process.env.OPENROUTER_LIVE_MODEL?.trim() ||
    DEFAULT_OPENROUTER_LIVE_MODEL;

  const liveProvider: LlmProvider = process.env.LIVE_LLM_PROVIDER?.trim() ===
    "gemini"
    ? "gemini"
    : "openrouter";

  return {
    stt,
    liveLlm: {
      provider: liveProvider,
      model: liveProvider === "gemini" ? batchModel : liveModel,
    },
    batchLlm: {
      provider: "gemini",
      model: batchModel,
    },
    labels: {
      stt:
        stt === "deepgram"
          ? "Deepgram Nova (free credits)"
          : "Safari speech (free)",
      liveLlm:
        liveProvider === "gemini"
          ? `Gemini live (${batchModel})`
          : `DeepSeek via OpenRouter (${liveModel})`,
      batchLlm: `Gemini batch (${batchModel})`,
    },
  };
}

export function requireLiveLlm(): LlmCallConfig {
  const { liveLlm } = getCoachStackConfig();
  if (liveLlm.provider === "openrouter" && !process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error("OPENROUTER_API_KEY not configured (required for live coach)");
  }
  if (liveLlm.provider === "gemini" && !process.env.GEMINI_API_KEY?.trim()) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  return liveLlm;
}

export function requireBatchLlm(): LlmCallConfig {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error("GEMINI_API_KEY not configured (required for post-call & nightly analysis)");
  }
  return getCoachStackConfig().batchLlm;
}
