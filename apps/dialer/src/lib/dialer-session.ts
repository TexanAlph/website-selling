import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { isAllowedUsername, type DialerUsername } from "./dialer-auth";

export const SESSION_COOKIE = "dialer_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

function secretKey(): Uint8Array {
  const s = process.env.DIALER_AUTH_SECRET?.trim();
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("DIALER_AUTH_SECRET is required in production");
  }
  return new TextEncoder().encode(
    s || "dev-only-set-DIALER_AUTH_SECRET",
  );
}

export async function createSessionToken(
  username: DialerUsername,
): Promise<string> {
  return new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secretKey());
}

export async function parseSessionToken(
  token: string,
): Promise<DialerUsername | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const username = payload.username;
    if (typeof username !== "string" || !isAllowedUsername(username)) {
      return null;
    }
    return username;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<DialerUsername | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? parseSessionToken(token) : null;
}

export async function setSessionCookie(
  response: NextResponse,
  username: DialerUsername,
): Promise<void> {
  const token = await createSessionToken(username);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionUser(): Promise<DialerUsername | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return token ? parseSessionToken(token) : null;
}
