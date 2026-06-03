import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import type { LeadStatus } from "@/lib/leads";
import { finalizeCallSession, getSessionRecap } from "@/lib/calls/sessions";
import { isBatchAnalysisConfigured } from "@/lib/coach/config";
import { runPostCallSwarm } from "@/lib/coach/post-call";
import { getSessionUser } from "@/lib/dialer-session";

export const maxDuration = 60;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const recap = await getSessionRecap(id);
    if (!recap) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ recap });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

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

    const shouldAnalyze =
      !result.alreadyEnded &&
      Boolean(result.transcriptFull) &&
      isBatchAnalysisConfigured();

    const alreadyProcessing =
      result.alreadyEnded &&
      result.recap?.analysisStatus === "processing";

    if (shouldAnalyze && !alreadyProcessing) {
      after(async () => {
        try {
          await runPostCallSwarm(sessionId);
        } catch {
          /* analysis_status set to failed on session */
        }
      });
    }

    const recap =
      result.recap ??
      (shouldAnalyze ? null : await getSessionRecap(sessionId));

    return NextResponse.json({
      ok: true,
      alreadyEnded: result.alreadyEnded,
      durationSeconds: "durationSeconds" in result ? result.durationSeconds : null,
      analysisQueued: shouldAnalyze,
      recap,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Finalize failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
