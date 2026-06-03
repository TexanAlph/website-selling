import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { listRecentLeads } from "@/lib/storage/client";

export async function GET() {
  const rep = await getSessionUser();
  if (!rep) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const leads = await listRecentLeads(rep);
    return NextResponse.json({ leads });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Database error" },
      { status: 500 },
    );
  }
}
