import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { listMissedCalls } from "@/lib/storage/client";

export async function GET() {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const calls = await listMissedCalls();
    return NextResponse.json(
      { calls },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load" },
      { status: 500 },
    );
  }
}
