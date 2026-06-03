import type { LlmCallConfig } from "./llm-client";
import { llmText, llmTextStream } from "./llm-client";
import { getOpenRouterFallback } from "./config";

export function isLlmQuotaError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /429|quota|depleted|rate limit|RESOURCE_EXHAUSTED|too many requests/i.test(
    msg,
  );
}

export function formatAnalysisFailure(e: unknown): string {
  if (isLlmQuotaError(e)) {
    return "Recap unavailable — AI quota exceeded. Check OpenRouter balance or add Gemini billing.";
  }
  return "Call recap could not be generated. Try again after your next call.";
}

async function withOpenRouterFallback<T>(
  primary: LlmCallConfig,
  run: (cfg: LlmCallConfig) => Promise<T>,
): Promise<T> {
  try {
    return await run(primary);
  } catch (e) {
    if (primary.provider === "gemini" && isLlmQuotaError(e)) {
      const fallback = getOpenRouterFallback();
      if (fallback) return await run(fallback);
    }
    throw e;
  }
}

/** Post-call / nightly — OpenRouter by default; Gemini only if configured. */
export async function batchLlmText(
  primary: LlmCallConfig,
  system: string,
  user: string,
  maxOutputTokens = 600,
): Promise<string> {
  return withOpenRouterFallback(primary, (cfg) =>
    llmText(cfg, system, user, maxOutputTokens),
  );
}

/** Live coach stream — same fallback when Gemini is out of quota. */
export async function* liveLlmTextStream(
  primary: LlmCallConfig,
  system: string,
  user: string,
  maxOutputTokens = 160,
): AsyncGenerator<string> {
  try {
    yield* llmTextStream(primary, system, user, maxOutputTokens);
  } catch (e) {
    if (primary.provider === "gemini" && isLlmQuotaError(e)) {
      const fallback = getOpenRouterFallback();
      if (fallback) {
        yield* llmTextStream(fallback, system, user, maxOutputTokens);
        return;
      }
    }
    throw e;
  }
}

export async function warmCoachLlm(primary: LlmCallConfig): Promise<void> {
  await withOpenRouterFallback(primary, (cfg) =>
    llmText(cfg, "Reply with OK only.", "OK", 8),
  );
}
