import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/coach/deepgram";
import { runCoachPipeline } from "@/lib/coach/run-coach";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let sessionId: string | undefined;
    let leadId: string | null | undefined;
    let transcript = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      sessionId = (form.get("sessionId") as string | null) ?? undefined;
      leadId = (form.get("leadId") as string | null) ?? null;
      const audio = form.get("audio");

      if (!(audio instanceof Blob) || audio.size === 0) {
        return NextResponse.json({ error: "audio file required" }, { status: 400 });
      }

      transcript = await transcribeAudio(audio, audio.type || "audio/webm");
    } else {
      const body = await request.json();
      sessionId = body.sessionId;
      leadId = body.leadId ?? null;
      transcript = body.transcript ?? "";
    }

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    if (!transcript.trim()) {
      return NextResponse.json(
        { error: "No speech detected in this chunk" },
        { status: 422 },
      );
    }

    const result = await runCoachPipeline({
      sessionId,
      leadId,
      transcript,
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Coach failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
