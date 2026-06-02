import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("coach_messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .in("role", ["transcript_prospect", "transcript_rep"])
      .order("created_at", { ascending: true })
      .limit(40);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const lines = (data ?? []).map((row) => ({
      speaker:
        row.role === "transcript_prospect"
          ? ("prospect" as const)
          : ("rep" as const),
      text: String(row.content),
      interim: false,
    }));

    return NextResponse.json({ lines });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
