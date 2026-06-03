import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { listCoachCountersSince } from "@/lib/storage/client";

/** Poll for new coach counter lines (replaces Supabase Realtime). */
export async function GET(request: NextRequest) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const since = request.nextUrl.searchParams.get("since") ?? undefined;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  try {
    const messages = await listCoachCountersSince(sessionId, since);
    return NextResponse.json({ messages });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
