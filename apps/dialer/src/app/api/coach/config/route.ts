import { NextResponse } from "next/server";
import { getCoachStackConfig } from "@/lib/coach/config";
import { getSalesConfig } from "@/lib/coach/sales-config";

export async function GET() {
  const stack = getCoachStackConfig();
  const sales = getSalesConfig();
  return NextResponse.json({
    companyName: sales.companyName,
    stt: stack.stt,
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
          ? "OpenRouter + DeepSeek for live coach (pay-per-token, no Gemini rate limits)."
          : "Gemini for live coach — may hit free-tier RPM on long calls.",
      batchLlm:
        "Gemini AI Studio free tier — post-call analysis & nightly insights only.",
    },
  });
}
