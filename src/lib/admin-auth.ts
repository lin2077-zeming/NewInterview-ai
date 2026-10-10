import { timingSafeEqual } from "crypto";
import { AdminAuthError } from "@/lib/errors";

/**
 * 管理端鉴权。
 *
 * 采用环境变量 **ADMIN_TOKEN** 校验：改动最小、当天可用，适合内部管理与演示。
 * 局限：令牌一旦泄露即失守，且不能区分多个管理员 —— 后续如需分级权限，
 * 应替换为真正的登录鉴权（Clerk 依赖已装但未接入）。
 *
 * 未配置 ADMIN_TOKEN 时**管理接口整体关闭**（默认安全），而不是默认放行。
 */

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const MIN_TOKEN_LENGTH = 12;

export function isAdminConfigured(): boolean {
  return typeof ADMIN_TOKEN === "string" && ADMIN_TOKEN.length >= MIN_TOKEN_LENGTH;
}

function readToken(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return req.headers.get("x-admin-token")?.trim() ?? "";
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** 校验通过则返回；否则抛 AdminAuthError，由调用方转成 401/403 */
export function assertAdmin(req: Request): void {
  if (!isAdminConfigured()) {
    throw new AdminAuthError(
      "管理端未启用：请在环境变量中配置 ADMIN_TOKEN（至少 12 位）后重启服务。"
    );
  }

  const token = readToken(req);
  if (!token || !safeEqual(token, ADMIN_TOKEN as string)) {
    throw new AdminAuthError();
  }
}
