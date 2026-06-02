import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const sessionId = body.sessionId as string | undefined;
    const messageId = body.messageId as string | undefined;
    const helpful = body.helpful as boolean | undefined;

    if (!sessionId || typeof helpful !== "boolean") {
      return NextResponse.json(
        { error: "sessionId and helpful required" },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    const { error } = await supabase.from("coach_feedback").insert({
      session_id: sessionId,
      message_id: messageId ?? null,
      rep_name: user,
      helpful,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Feedback failed" },
      { status: 500 },
    );
  }
}
