import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { updateLeadStatus } from "@/lib/storage/client";
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
    await updateLeadStatus(id, status, rep, status === "Calling");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    if (message.includes("409") || message.includes("not available")) {
      return NextResponse.json(
        { error: "Lead not available or already claimed" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
