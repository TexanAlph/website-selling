import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { resetStaleCallingLeads } from "@/lib/calls/reset-stale-calling";
import { isBatchAnalysisConfigured } from "@/lib/coach/config";
import { runPendingCallAnalysis } from "@/lib/coach/analysis-batch";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBatchAnalysisConfigured()) {
    return NextResponse.json(
      {
        error:
          "Batch analysis not configured — set OPENROUTER_API_KEY on Vercel",
      },
      { status: 503 },
    );
  }

  try {
    const reset = await resetStaleCallingLeads(30);
    const result = await runPendingCallAnalysis();
    return NextResponse.json({ ok: true, reset, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Batch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
