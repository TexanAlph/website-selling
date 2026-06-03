import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import { markInboundListened } from "@/lib/storage/client";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    await markInboundListened(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
