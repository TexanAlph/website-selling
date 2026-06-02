import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { createServerClient } from "@/lib/supabase/server";
import type { LeadStatus } from "@/lib/leads";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rep = await getSessionUser();
  if (!rep) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const status = body.status as LeadStatus | undefined;

  if (!status) {
    return NextResponse.json({ error: "status required" }, { status: 400 });
  }

  try {
    const supabase = createServerClient();

    let query = supabase
      .from("leads")
      .update({
        status,
        status_changed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (status === "Calling") {
      query = query.eq("status", "New").eq("assigned_rep", rep);
    } else {
      query = query.eq("assigned_rep", rep);
    }

    const { data, error } = await query.select("id").maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Lead not available or already claimed" },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Database error" },
      { status: 500 },
    );
  }
}
