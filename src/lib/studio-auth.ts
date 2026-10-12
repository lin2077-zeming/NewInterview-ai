import { createHmac, timingSafeEqual } from "crypto";

/**
 * OPC 运营看板的访问口令。
 *
 * 定位：这个看板**不是给用户看的**，它是评委核验 OPC 成果的工具
 * （成本、耗时、AI 完成占比、迭代轮次这些数字）。所以它要有门槛，
 * 而且不该出现在正常用户的浏览路径里。
 *
 * ⚠️ 口令校验必须放在服务端。写在前端等于把口令连同判断逻辑一起
 * 打包发给每一个访客，打开 devtools 就能看到 —— 那种"门槛"只是摆设。
 *
 * 口令来源：环境变量 `STUDIO_PASSWORD`；未配置时使用默认值，
 * 这样换一台机器部署不用先配环境变量也能进得去（评委现场不会去配 env）。
 * 若仓库将来需要公开，**务必在部署环境里显式设置 `STUDIO_PASSWORD`**。
 */

const DEFAULT_STUDIO_PASSWORD = "Mind@123";
const CONFIGURED_PASSWORD = process.env.STUDIO_PASSWORD?.trim();
const STUDIO_PASSWORD = CONFIGURED_PASSWORD || DEFAULT_STUDIO_PASSWORD;

/** 是否用的是内置默认口令（用于启动时提醒、以及状态接口如实告知） */
export const USING_DEFAULT_PASSWORD = !CONFIGURED_PASSWORD;

export const STUDIO_COOKIE = "zhijing_studio";
/** 看板属于内部工具，令牌有效期给短一些 */
export const STUDIO_COOKIE_MAX_AGE = 60 * 60 * 12;

/**
 * 由口令派生的 cookie 值。
 *
 * 不直接把口令当 cookie：那样一旦 cookie 泄漏就等于口令泄漏。
 * 用 HMAC 派生后，cookie 值无法反推口令，且**服务重启后依然有效**
 * （不需要引入会话存储）。
 */
function deriveToken(password: string): string {
  return createHmac("sha256", password).update("zhijing-studio-v1").digest("hex");
}

const EXPECTED_TOKEN = deriveToken(STUDIO_PASSWORD);

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** 校验用户输入的口令 */
export function verifyStudioPassword(input: unknown): boolean {
  if (typeof input !== "string" || !input) return false;
  return safeEqual(input, STUDIO_PASSWORD);
}

/** 登录成功后写进 cookie 的值 */
export function studioCookieValue(): string {
  return EXPECTED_TOKEN;
}

/** 判断当前 cookie 是否已通过口令校验 */
export function isStudioUnlocked(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  return safeEqual(cookieValue, EXPECTED_TOKEN);
}
