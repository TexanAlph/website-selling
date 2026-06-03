import type { LlmProvider, SttProvider } from "./types";
import type { LlmCallConfig } from "./llm-client";

export type CoachStackConfig = {
  stt: SttProvider;
  /** Live coach during calls */
  liveLlm: LlmCallConfig;
  /** Post-call swarm + nightly insights */
  batchLlm: LlmCallConfig;
  labels: {
    stt: string;
    liveLlm: string;
    batchLlm: string;
  };
};

/** Default for live coach + post-call recap + nightly analysis */
export const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-chat-v3-0324";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

export function openRouterModel(): string {
  return (
    process.env.OPENROUTER_BATCH_MODEL?.trim() ||
    process.env.OPENROUTER_LIVE_MODEL?.trim() ||
    DEFAULT_OPENROUTER_MODEL
  );
}

/**
 * Post-call recap + nightly: try Gemini first when GEMINI_API_KEY is set.
 * On 429 / depleted credits, batchLlmText() retries OpenRouter automatically.
 * Set BATCH_LLM_PROVIDER=openrouter to skip Gemini entirely.
 */
export function getBatchLlmConfig(): LlmCallConfig {
  const forced = process.env.BATCH_LLM_PROVIDER?.trim().toLowerCase();
  const geminiModel =
    process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  if (forced === "openrouter") {
    return { provider: "openrouter", model: openRouterModel() };
  }
  if (process.env.GEMINI_API_KEY?.trim()) {
    return { provider: "gemini", model: geminiModel };
  }
  return { provider: "openrouter", model: openRouterModel() };
}

/**
 * Live coach during calls: OpenRouter by default (high RPM).
 * Set LIVE_LLM_PROVIDER=gemini to try Gemini first; liveLlmTextStream falls back on quota errors.
 */
export function getLiveLlmConfig(): LlmCallConfig {
  const forced = process.env.LIVE_LLM_PROVIDER?.trim().toLowerCase();
  const geminiModel =
    process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  if (forced === "openrouter") {
    return { provider: "openrouter", model: openRouterModel() };
  }
  if (forced === "gemini" && process.env.GEMINI_API_KEY?.trim()) {
    return { provider: "gemini", model: geminiModel };
  }
  return { provider: "openrouter", model: openRouterModel() };
}

/** Fallback when Gemini quota is exhausted or key missing. */
export function getOpenRouterFallback(): LlmCallConfig | null {
  if (!process.env.OPENROUTER_API_KEY?.trim()) return null;
  return { provider: "openrouter", model: openRouterModel() };
}

/** @deprecated Use getOpenRouterFallback */
export function getOpenRouterBatchFallback(): LlmCallConfig | null {
  return getOpenRouterFallback();
}

export function isBatchAnalysisConfigured(): boolean {
  return Boolean(
    process.env.OPENROUTER_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim(),
  );
}

export function isLiveCoachConfigured(): boolean {
  return isBatchAnalysisConfigured();
}

/**
 * - STT: Safari Web Speech ($0) unless DEEPGRAM_API_KEY is set
 * - Live LLM: OpenRouter + DeepSeek (LIVE_LLM_PROVIDER=gemini to try Gemini first)
 * - Batch LLM: Gemini first if GEMINI_API_KEY set, else OpenRouter; auto-fallback on quota
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

  const liveLlm = getLiveLlmConfig();
  const batchLlm = getBatchLlmConfig();
  const orLabel = (cfg: LlmCallConfig) =>
    cfg.provider === "openrouter"
      ? `DeepSeek via OpenRouter (${cfg.model})`
      : `Gemini (${cfg.model})`;

  return {
    stt,
    liveLlm,
    batchLlm,
    labels: {
      stt:
        stt === "deepgram"
          ? "Deepgram Nova (free credits)"
          : "Safari speech (free)",
      liveLlm: orLabel(liveLlm),
      batchLlm: orLabel(batchLlm),
    },
  };
}

export function requireLiveLlm(): LlmCallConfig {
  const live = getLiveLlmConfig();
  if (live.provider === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY?.trim()) {
      const gemini = process.env.GEMINI_API_KEY?.trim();
      if (gemini) {
        return {
          provider: "gemini",
          model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
        };
      }
      throw new Error("OPENROUTER_API_KEY not configured (required for live coach)");
    }
    return live;
  }
  if (!process.env.GEMINI_API_KEY?.trim()) {
    const fallback = getOpenRouterFallback();
    if (fallback) return fallback;
    throw new Error("GEMINI_API_KEY not configured");
  }
  return live;
}

export function requireBatchLlm(): LlmCallConfig {
  const batch = getBatchLlmConfig();
  if (batch.provider === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY?.trim()) {
      if (process.env.GEMINI_API_KEY?.trim()) {
        return {
          provider: "gemini",
          model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
        };
      }
      throw new Error(
        "OPENROUTER_API_KEY not configured (required for post-call & nightly analysis)",
      );
    }
    return batch;
  }
  if (!process.env.GEMINI_API_KEY?.trim()) {
    const fallback = getOpenRouterFallback();
    if (fallback) return fallback;
    throw new Error(
      "OPENROUTER_API_KEY or GEMINI_API_KEY required for post-call & nightly analysis",
    );
  }
  return batch;
}
