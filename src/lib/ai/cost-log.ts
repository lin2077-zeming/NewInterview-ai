import { and, desc, gte, sql } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { costLogs } from "@/lib/db/schema";
import type { PriceChannel, UsageCost } from "@/lib/ai/cost";

/**
 * LLM 调用成本流水。
 *
 * 写入点只有一处（`withModelFallback`），保证「每次 AI 调用都有成本记录」这件事
 * 不依赖调用方自觉 —— 少了记账，OPC 赛道里「低成本」的论证就没有底。
 *
 * 除了记账，这张表还兼作限流与预算的数据源，见下方查询函数。
 */

export interface CostLogInput {
  sessionId?: string | null;
  kind: string;
  model: string;
  channel: PriceChannel;
  usage: UsageCost;
  durationMs: number;
}

function newId(): string {
  return crypto.randomUUID();
}

/** 记一条成本流水。失败只告警不抛出 —— 记账不该把用户的正常请求带崩 */
export async function logCost(input: CostLogInput): Promise<void> {
  try {
    await ready();
    await db.insert(costLogs).values({
      id: newId(),
      sessionId: input.sessionId ?? null,
      kind: input.kind,
      model: input.model,
      channel: input.channel,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      cost: input.usage.cost,
      durationMs: Math.max(0, Math.round(input.durationMs)),
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("[cost-log] 写入成本流水失败:", error);
  }
}

/** 某会话在最近 windowMs 内完成的 AI 调用次数（限流用，持久化，重启不丢） */
export async function countRecentCallsBySession(
  sessionId: string,
  windowMs: number
): Promise<number> {
  await ready();
  const since = new Date(Date.now() - windowMs);
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(costLogs)
    .where(and(gte(costLogs.createdAt, since), sql`${costLogs.sessionId} = ${sessionId}`));
  return Number(rows[0]?.count ?? 0);
}

export interface CostSummary {
  /** 当日总花费（元） */
  totalCost: number;
  /** 当日调用次数 */
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** 其中由备用链路完成的次数 */
  fallbackCalls: number;
}

/** 从当天 0 点起的成本汇总（预算告警用） */
export async function getTodayCostSummary(): Promise<CostSummary> {
  await ready();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      totalCost: sql<number>`coalesce(sum(${costLogs.cost}), 0)`,
      calls: sql<number>`count(*)`,
      inputTokens: sql<number>`coalesce(sum(${costLogs.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${costLogs.outputTokens}), 0)`,
      fallbackCalls: sql<number>`coalesce(sum(case when ${costLogs.channel} = 'fallback' then 1 else 0 end), 0)`,
    })
    .from(costLogs)
    .where(gte(costLogs.createdAt, start));

  const row = rows[0];
  return {
    totalCost: Math.round(Number(row?.totalCost ?? 0) * 10000) / 10000,
    calls: Number(row?.calls ?? 0),
    inputTokens: Number(row?.inputTokens ?? 0),
    outputTokens: Number(row?.outputTokens ?? 0),
    fallbackCalls: Number(row?.fallbackCalls ?? 0),
  };
}

/** 最近若干条流水，供看板展示「钱花在哪」 */
export async function listRecentCostLogs(limit = 20) {
  await ready();
  return db.select().from(costLogs).orderBy(desc(costLogs.createdAt)).limit(limit);
}

/** 删除某会话的全部成本流水（配合「删除我的数据」） */
export async function deleteCostLogsBySession(sessionId: string): Promise<void> {
  await ready();
  await db.delete(costLogs).where(sql`${costLogs.sessionId} = ${sessionId}`);
}
