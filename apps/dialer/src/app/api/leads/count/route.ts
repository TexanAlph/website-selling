import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { countNewLeads } from "@/lib/storage/client";

export async function GET() {
  const rep = await getSessionUser();
  if (!rep) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const queueCount = await countNewLeads(rep);
    return NextResponse.json({ queueCount });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Database error" },
      { status: 500 },
    );
  }
}
