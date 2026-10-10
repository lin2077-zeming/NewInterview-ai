import { NextResponse, type NextRequest } from "next/server";

/**
 * 会话中间件。
 *
 * 不阻断任何请求（演示不需要登录门槛），只做一件事：
 * 为还没有匿名会话的访客签发一个 httpOnly cookie。
 * 服务端据此隔离每位访客的数据。
 */

const SESSION_COOKIE = "zhijing_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 180;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  if (!existing) {
    response.cookies.set(SESSION_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
