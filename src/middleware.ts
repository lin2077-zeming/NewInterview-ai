import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Coze 沙箱部署：无 Clerk 密钥时直接放行所有请求
// Clerk 仅用于需要持久化的页面，核心面试功能不需要认证
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
