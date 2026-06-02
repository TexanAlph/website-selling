import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { createCallSession } from "@/lib/calls/sessions";
import type { CallSource } from "@/lib/calls/types";

export async function POST(request: NextRequest) {
  const rep = await getSessionUser();
  if (!rep) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const sessionId = body.sessionId as string | undefined;
    const source = body.source as CallSource | undefined;

    if (!sessionId || !source || !["queue", "keypad"].includes(source)) {
      return NextResponse.json(
        { error: "sessionId and source (queue|keypad) required" },
        { status: 400 },
      );
    }

    await createCallSession({
      sessionId,
      leadId: body.leadId ?? null,
      niche: body.niche ?? null,
      source,
      repName: rep,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Session create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
