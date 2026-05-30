import { NextRequest, NextResponse } from "next/server";
import { runPendingCallAnalysis } from "@/lib/coach/analysis-batch";
import { hasServiceRole } from "@/lib/supabase/service";

export const maxDuration = 120;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY required for batch analysis" },
      { status: 503 },
    );
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY required" },
      { status: 503 },
    );
  }

  try {
    const result = await runPendingCallAnalysis();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Batch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
