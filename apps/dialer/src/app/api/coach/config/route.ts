import { NextResponse } from "next/server";
import { getCoachStackConfig } from "@/lib/coach/config";

export async function GET() {
  const stack = getCoachStackConfig();
  return NextResponse.json({
    stt: stack.stt,
    llm: stack.llm,
    geminiModel: stack.geminiModel,
    labels: stack.labels,
    freeTierNotes: {
      stt:
        stack.stt === "webspeech"
          ? "Uses built-in Safari speech — $0, no API key."
          : "Uses Deepgram — new accounts get ~$200 free credit.",
      llm: "Gemini via Google AI Studio — generous free tier for Flash models.",
    },
  });
}
