import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { streamCoachPipeline } from "@/lib/coach/run-coach-stream";
import { transcribeAudio } from "@/lib/coach/deepgram";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const rep = await getSessionUser();
  if (!rep) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let sessionId: string | undefined;
    let leadId: string | null | undefined;
    let transcript = "";
    let prospectOnly: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      sessionId = (form.get("sessionId") as string | null) ?? undefined;
      leadId = (form.get("leadId") as string | null) ?? null;
      const audio = form.get("audio");
      if (!(audio instanceof Blob) || audio.size === 0) {
        return new Response(JSON.stringify({ error: "audio required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      transcript = await transcribeAudio(audio, audio.type || "audio/webm");
    } else {
      const body = await request.json();
      sessionId = body.sessionId;
      leadId = body.leadId ?? null;
      transcript = body.transcript ?? "";
      prospectOnly = body.prospectOnly;
    }

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of streamCoachPipeline({
            sessionId,
            leadId,
            transcript,
            prospectOnly,
          })) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
            );
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          const message = e instanceof Error ? e.message : "Coach stream failed";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Coach stream failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
