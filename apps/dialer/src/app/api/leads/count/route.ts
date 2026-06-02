import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { createServerClient } from "@/lib/supabase/server";
import { MAX_NEW_PER_REP } from "@/lib/rep-queue";

export async function GET() {
  const rep = await getSessionUser();
  if (!rep) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerClient();
    const { count, error } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("status", "New")
      .eq("assigned_rep", rep);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      queueCount: count ?? 0,
      maxPerRep: MAX_NEW_PER_REP,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Database error" },
      { status: 500 },
    );
  }
}
