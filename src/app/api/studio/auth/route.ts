import { NextResponse } from "next/server";
import {
  STUDIO_COOKIE,
  STUDIO_COOKIE_MAX_AGE,
  isStudioUnlocked,
  studioCookieValue,
  verifyStudioPassword,
} from "@/lib/studio-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OPC 运营看板：口令校验。
 *
 * POST 校验口令并写入 httpOnly cookie；DELETE 清除（评委用完交还电脑时可能用到）。
 * GET 返回当前是否已解锁，供前端判断要不要显示解锁入口。
 */
export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${STUDIO_COOKIE}=([^;]+)`));
  return NextResponse.json({ unlocked: isStudioUnlocked(match?.[1]) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: unknown };

  if (!verifyStudioPassword(body.password)) {
    // 不回显口令、不提示"差几位"，只给一句统一的失败信息
    return NextResponse.json({ error: "口令不正确。" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(STUDIO_COOKIE, studioCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: STUDIO_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(STUDIO_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
