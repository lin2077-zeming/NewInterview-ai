import { NextResponse } from "next/server";
import { countRecentCallsBySession, getTodayCostSummary } from "@/lib/ai/cost-log";
import { ensureSessionId } from "@/lib/session";

/**
 * AI 调用的准入控制（限流 + 日预算）。
 *
 * 为什么要做：每次调用都是真金白银，且大模型接口天然是滥用目标 ——
 * 没有限流，一个脚本就能把额度刷空，参赛作品也就谈不上「可运营」。
 *
 * 两个维度：
 * - **会话维度**：查 cost_logs 做滑动窗口。放在数据库里是为了重启不丢 ——
 *   内存计数一重启就清零，等于给滥用者留了个后门。
 * - **IP 维度**：内存滑动窗口，阈值放宽些，因为同一出口 IP 可能对应多个人。
 *
 * 另有日预算闸门：当日累计花费超过阈值就停止接单，避免失控。
 */

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

function envFloat(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

const HOUR_MS = 60 * 60 * 1000;

export const RATE_LIMIT_PER_HOUR_SESSION = envInt("OPC_RATE_LIMIT_PER_HOUR_SESSION", 20);
export const RATE_LIMIT_PER_HOUR_IP = envInt("OPC_RATE_LIMIT_PER_HOUR_IP", 60);
export const DAILY_BUDGET_CNY = envFloat("OPC_DAILY_BUDGET_CNY", 5);

// ==================== IP 维度（内存滑动窗口） ====================

const ipHits = new Map<string, number[]>();
/** 超过这个键数量就清理一轮，防止 Map 无限增长 */
const IP_MAP_LIMIT = 5000;

function pruneIpHits(now: number): void {
  for (const [key, times] of ipHits) {
    const kept = times.filter((t) => now - t < HOUR_MS);
    if (kept.length === 0) ipHits.delete(key);
    else ipHits.set(key, kept);
  }
}

function recordAndCountIp(ip: string): number {
  const now = Date.now();
  if (ipHits.size > IP_MAP_LIMIT) pruneIpHits(now);

  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < HOUR_MS);
  hits.push(now);
  ipHits.set(ip, hits);
  return hits.length;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

// ==================== 准入判断 ====================

export type Admission =
  | { ok: true; sessionId: string }
  | { ok: false; response: NextResponse };

function reject(status: number, error: string, retryAfterSeconds?: number): Admission {
  const headers: Record<string, string> = {};
  if (retryAfterSeconds !== undefined) headers["Retry-After"] = String(retryAfterSeconds);

  return {
    ok: false,
    response: NextResponse.json({ error, retryAfterSeconds }, { status, headers }),
  };
}

/** 路由入口处调用；返回 ok=false 时直接把 response 返回给客户端 */
export async function admitAiCall(req: Request): Promise<Admission> {
  const sessionId = await ensureSessionId();

  // 1) 日预算闸门：先看钱，超了就不必再算次数
  try {
    const summary = await getTodayCostSummary();
    if (summary.totalCost >= DAILY_BUDGET_CNY) {
      return reject(
        429,
        `今日 AI 预算（¥${DAILY_BUDGET_CNY}）已用完，当前已花费 ¥${summary.totalCost.toFixed(4)}。` +
          `明天会自动恢复；如需继续，可调高环境变量 OPC_DAILY_BUDGET_CNY。`
      );
    }
  } catch (error) {
    // 预算查不出来不该拦人，放行并告警
    console.error("[rate-limit] 查询日预算失败，本次放行:", error);
  }

  // 2) 会话维度
  try {
    const sessionCount = await countRecentCallsBySession(sessionId, HOUR_MS);
    if (sessionCount >= RATE_LIMIT_PER_HOUR_SESSION) {
      return reject(
        429,
        `一小时内最多进行 ${RATE_LIMIT_PER_HOUR_SESSION} 次 AI 调用，请稍后再试。` +
          `（这是为了控制成本与防止误用，稍等几分钟即可继续）`,
        Math.ceil(HOUR_MS / 1000 / 60) * 60
      );
    }
  } catch (error) {
    console.error("[rate-limit] 查询会话调用次数失败，本次放行:", error);
  }

  // 3) IP 维度
  const ipCount = recordAndCountIp(clientIp(req));
  if (ipCount > RATE_LIMIT_PER_HOUR_IP) {
    return reject(
      429,
      `当前网络一小时内 AI 调用过于频繁（上限 ${RATE_LIMIT_PER_HOUR_IP} 次），请稍后再试。`,
      Math.ceil(HOUR_MS / 1000 / 60) * 60
    );
  }

  return { ok: true, sessionId };
}

/** 日预算状态，供看板展示 */
export async function getBudgetStatus(): Promise<{
  budget: number;
  spent: number;
  remaining: number;
  usedPercent: number;
}> {
  const summary = await getTodayCostSummary();
  const spent = summary.totalCost;
  return {
    budget: DAILY_BUDGET_CNY,
    spent,
    remaining: Math.max(0, Math.round((DAILY_BUDGET_CNY - spent) * 10000) / 10000),
    usedPercent: Math.min(100, Math.round((spent / DAILY_BUDGET_CNY) * 100)),
  };
}
