import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { getInsightsPayload } from "@/lib/storage/client";

export async function GET() {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await getInsightsPayload();
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load insights" },
      { status: 500 },
    );
  }
}
