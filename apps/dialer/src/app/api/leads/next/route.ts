import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { MAX_NEW_PER_REP } from "@/lib/rep-queue";
import { getNextLead } from "@/lib/storage/client";

export async function GET() {
  const rep = await getSessionUser();
  if (!rep) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { lead, queueCount } = await getNextLead(rep);
    return NextResponse.json({
      lead,
      queueCount,
      maxPerRep: MAX_NEW_PER_REP,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Database error" },
      { status: 500 },
    );
  }
}
