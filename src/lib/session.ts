import { cookies } from "next/headers";

/**
 * 匿名会话。
 *
 * 本项目不要求注册登录，但**必须能区分不同访客的数据**：
 * 中间件为每个访客签发一个 httpOnly 的匿名会话 ID，服务端所有读写都按它过滤。
 * 这样既满足数据隔离与隐私保护要求，又不给演示增加登录门槛。
 */

export const SESSION_COOKIE = "zhijing_session";
/** 180 天 */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 180;

export function isSessionId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 16 && value.length <= 64;
}

export function createSessionId(): string {
  return crypto.randomUUID();
}

/** 读取当前会话 ID（只读，不存在时返回 null） */
export async function getSessionId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  return isSessionId(value) ? value : null;
}

/**
 * 取当前会话 ID；不存在时**立即创建并写回 cookie**。
 *
 * 只在 Route Handler / Server Action 中调用 —— Server Component 渲染期间
 * 不允许写 cookie。中间件已负责在首次访问时签发，这里是兜底。
 */
export async function ensureSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(SESSION_COOKIE)?.value;
  if (isSessionId(existing)) return existing;

  const id = createSessionId();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return id;
}

/** 清除会话 cookie（删除数据时调用） */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
