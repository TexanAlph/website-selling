import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, isAllowedUsername } from "@/lib/dialer-auth";
import { setSessionCookie } from "@/lib/dialer-session";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!isAllowedUsername(username) || !verifyCredentials(username, password)) {
    return NextResponse.json(
      { error: "Wrong username or password." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true, user: username });
  await setSessionCookie(response, username);
  return response;
}
