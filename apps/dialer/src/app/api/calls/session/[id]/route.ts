import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import type { LeadStatus } from "@/lib/leads";
import { finalizeCallSession } from "@/lib/calls/sessions";
import { runPostCallSwarm } from "@/lib/coach/post-call";
export const maxDuration = 60;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await context.params;
    const body = await request.json();
    const outcomeStatus = (body.outcomeStatus as LeadStatus | null | undefined) ?? null;
    const endReason = body.endReason as "outcome" | "hangup" | "manual" | undefined;

    if (!endReason || !["outcome", "hangup", "manual"].includes(endReason)) {
      return NextResponse.json({ error: "endReason required" }, { status: 400 });
    }

    const result = await finalizeCallSession(sessionId, {
      outcomeStatus,
      endReason,
    });

    if (
      !result.alreadyEnded &&
      result.transcriptFull &&
      process.env.GEMINI_API_KEY?.trim()
    ) {
      after(async () => {
        try {
          await runPostCallSwarm(sessionId);
        } catch {
          /* logged on session row as failed */
        }
      });
    } else if (!result.alreadyEnded && !result.transcriptFull) {
      /* skipped — no transcript */
    }

    return NextResponse.json({
      ok: true,
      ...result,
      analysisQueued: Boolean(
        !result.alreadyEnded &&
          result.transcriptFull &&
          process.env.GEMINI_API_KEY?.trim(),
      ),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Finalize failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
