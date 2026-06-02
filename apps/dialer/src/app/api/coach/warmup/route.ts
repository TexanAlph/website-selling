import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { warmCoachModel } from "@/lib/coach/run-coach-stream";

export async function POST() {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await warmCoachModel();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Warmup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
