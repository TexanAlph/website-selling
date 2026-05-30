import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/dialer-session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname.startsWith("/login");
  const isAuthApi = pathname.startsWith("/api/auth");
  const isTwilioVoice = pathname === "/api/twilio/voice";
  const isCronAnalyze = pathname === "/api/cron/analyze";

  if (isCronAnalyze) {
    const secret = process.env.CRON_SECRET?.trim();
    const auth = request.headers.get("authorization");
    if (secret && auth === `Bearer ${secret}`) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getSessionFromRequest(request);

  if (!user && !isLogin && !isAuthApi && !isTwilioVoice) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
