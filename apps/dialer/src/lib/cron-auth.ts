import type { NextRequest } from "next/server";

/** Vercel Cron sends this header; Mac Mini can use optional CRON_SECRET. */
export function isAuthorizedCron(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron") === "1") {
    return true;
  }

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
