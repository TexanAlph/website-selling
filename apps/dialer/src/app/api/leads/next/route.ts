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
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      supabase
        .from("leads")
        .select("*")
        .eq("status", "New")
        .eq("assigned_rep", rep)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("status", "New")
        .eq("assigned_rep", rep),
    ]);

    if (error || countError) {
      return NextResponse.json(
        { error: error?.message ?? countError?.message },
        { status: 500 },
      );
    }
    return NextResponse.json({
      lead: data,
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
