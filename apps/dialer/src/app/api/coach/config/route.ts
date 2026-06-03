import { NextResponse } from "next/server";
import { getCoachStackConfig } from "@/lib/coach/config";
import { getSalesConfig } from "@/lib/coach/sales-config";

export async function GET() {
  const stack = getCoachStackConfig();
  const sales = getSalesConfig();
  return NextResponse.json({
    companyName: sales.companyName,
    stt: stack.stt,
    mediaStreamsEnabled: stack.mediaStreamsEnabled,
    liveLlm: stack.liveLlm,
    batchLlm: stack.batchLlm,
    labels: stack.labels,
    freeTierNotes: {
      stt:
        stack.stt === "webspeech"
          ? "Safari speech — $0, no API key."
          : "Deepgram — usage-based after free credits.",
      liveLlm:
        stack.liveLlm.provider === "openrouter"
          ? "OpenRouter + DeepSeek for live coach (default)."
          : "Gemini for live coach (set LIVE_LLM_PROVIDER=gemini).",
      batchLlm:
        stack.batchLlm.provider === "gemini"
          ? "Gemini first for recap & nightly — falls back to OpenRouter on 429 if OPENROUTER_API_KEY is set."
          : "OpenRouter only for batch (BATCH_LLM_PROVIDER=openrouter or no GEMINI_API_KEY).",
    },
  });
}
