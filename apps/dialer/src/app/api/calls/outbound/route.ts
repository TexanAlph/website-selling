import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { mapOutboundCallRow } from "@/lib/calls/outbound-history";
import { listRecentOutboundCalls } from "@/lib/storage/client";

export async function GET() {
  const rep = await getSessionUser();
  if (!rep) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await listRecentOutboundCalls(rep);
    return NextResponse.json({
      calls: rows.map((row) => mapOutboundCallRow(row)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Database error" },
      { status: 500 },
    );
  }
}
