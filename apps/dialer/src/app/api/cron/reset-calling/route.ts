import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { resetStaleCallingLeads } from "@/lib/calls/reset-stale-calling";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const reset = await resetStaleCallingLeads(30);
    return NextResponse.json({ ok: true, reset });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Reset failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
