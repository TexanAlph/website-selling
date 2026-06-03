import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { getLatestScraperRun } from "@/lib/storage/client";

export async function GET() {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const run = await getLatestScraperRun();
    return NextResponse.json({ run });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Database error" },
      { status: 500 },
    );
  }
}
