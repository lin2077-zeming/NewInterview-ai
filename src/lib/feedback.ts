import { desc, sql } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { iterations } from "@/lib/db/schema";
import { ensureSessionId } from "@/lib/session";

/**
 * 真实试用反馈。
 *
 * 定位：这张表是**赛事材料里"应用成效"的唯一数据来源**。
 * 赛事明确要求不得编造数据，所以这里只做两件事 —— 如实存、如实统计。
 * 任何"帮用户填几条凑数"的想法都是错的：评审追问一句就露。
 */

export type Verdict = "good" | "ok" | "poor";

export const VERDICT_LABELS: Record<Verdict, string> = {
  good: "很有用",
  ok: "一般",
  poor: "不好用",
};

export interface FeedbackInput {
  /**
   * 反馈来源。
   * - `form`（默认）：完整表单，必须填化名/编号
   * - `inline`：结果页的快捷反馈（👍/👎），不要求填化名
   *
   * 区分开来是为了**不削弱表单的校验**：快捷反馈是降低门槛，
   * 不是把"必须填化名"这条规则整体干掉。
   */
  source?: unknown;
  participant?: unknown;
  participantRole?: unknown;
  triedModules?: unknown;
  verdict?: unknown;
  valuable?: unknown;
  improvable?: unknown;
  wouldReuse?: unknown;
  metrics?: unknown;
}

export interface FeedbackRecord {
  id: string;
  participant: string;
  participantRole?: string;
  triedModules: string[];
  verdict: Verdict;
  valuable?: string;
  improvable?: string;
  wouldReuse?: boolean;
  metrics?: Record<string, unknown>;
  createdAt: string;
}

export class FeedbackValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedbackValidationError";
  }
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

/** 结果页快捷反馈不填化名时的占位值 —— 仍然不收集真名 */
const INLINE_PARTICIPANT = "匿名（结果页快捷反馈）";

export async function submitFeedback(input: FeedbackInput): Promise<FeedbackRecord> {
  const inline = input.source === "inline";

  let participant = text(input.participant, 30);
  if (!participant) {
    if (!inline) {
      throw new FeedbackValidationError("请填写一个化名或编号（不用真名，用于区分不同试用者）。");
    }
    participant = INLINE_PARTICIPANT;
  }

  const verdict = String(input.verdict ?? "");
  if (!["good", "ok", "poor"].includes(verdict)) {
    throw new FeedbackValidationError("请选择总体评价。");
  }

  const triedModules = Array.isArray(input.triedModules)
    ? input.triedModules
        .filter((m): m is string => typeof m === "string")
        .map((m) => m.slice(0, 30))
        .slice(0, 12)
    : [];

  const metrics =
    input.metrics && typeof input.metrics === "object" && !Array.isArray(input.metrics)
      ? (input.metrics as Record<string, unknown>)
      : undefined;

  const sessionId = await ensureSessionId().catch(() => null);
  const now = new Date();
  const id = crypto.randomUUID();

  await ready();
  await db.insert(iterations).values({
    id,
    sessionId,
    participant,
    participantRole: text(input.participantRole, 40) ?? null,
    triedModules: JSON.stringify(triedModules),
    verdict,
    valuable: text(input.valuable, 800) ?? null,
    improvable: text(input.improvable, 800) ?? null,
    wouldReuse: typeof input.wouldReuse === "boolean" ? input.wouldReuse : null,
    metrics: metrics ? JSON.stringify(metrics) : null,
    createdAt: now,
  });

  return {
    id,
    participant,
    participantRole: text(input.participantRole, 40),
    triedModules,
    verdict: verdict as Verdict,
    valuable: text(input.valuable, 800),
    improvable: text(input.improvable, 800),
    wouldReuse: typeof input.wouldReuse === "boolean" ? input.wouldReuse : undefined,
    metrics,
    createdAt: now.toISOString(),
  };
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function listFeedback(): Promise<FeedbackRecord[]> {
  await ready();
  const rows = await db.select().from(iterations).orderBy(desc(iterations.createdAt));
  return rows.map((row) => ({
    id: row.id,
    participant: row.participant,
    participantRole: row.participantRole ?? undefined,
    triedModules: parseJson<string[]>(row.triedModules, []),
    verdict: row.verdict as Verdict,
    valuable: row.valuable ?? undefined,
    improvable: row.improvable ?? undefined,
    wouldReuse: row.wouldReuse ?? undefined,
    metrics: parseJson<Record<string, unknown> | undefined>(row.metrics, undefined),
    createdAt: row.createdAt.toISOString(),
  }));
}

export interface FeedbackSummary {
  /** 总样本数 —— 材料里写"n 位同学试用"时用这个数，不能多写 */
  total: number;
  good: number;
  ok: number;
  poor: number;
  /** 愿意继续使用的比例（0-100，四舍五入） */
  wouldReusePercent: number;
  /** 出现过的背景分布 */
  roles: Array<{ role: string; count: number }>;
  /** 被体验最多的模块 */
  modules: Array<{ module: string; count: number }>;
  firstAt: string | null;
  lastAt: string | null;
}

export function summarizeFeedback(list: FeedbackRecord[]): FeedbackSummary {
  const total = list.length;
  const good = list.filter((f) => f.verdict === "good").length;
  const ok = list.filter((f) => f.verdict === "ok").length;
  const poor = list.filter((f) => f.verdict === "poor").length;

  const reuseAnswered = list.filter((f) => typeof f.wouldReuse === "boolean");
  const wouldReusePercent = reuseAnswered.length
    ? Math.round((reuseAnswered.filter((f) => f.wouldReuse).length / reuseAnswered.length) * 100)
    : 0;

  const roleCounts = new Map<string, number>();
  const moduleCounts = new Map<string, number>();
  for (const f of list) {
    if (f.participantRole) {
      roleCounts.set(f.participantRole, (roleCounts.get(f.participantRole) ?? 0) + 1);
    }
    for (const m of f.triedModules) {
      moduleCounts.set(m, (moduleCounts.get(m) ?? 0) + 1);
    }
  }

  // 按时间正序取首尾
  const times = list.map((f) => f.createdAt).sort();

  return {
    total,
    good,
    ok,
    poor,
    wouldReusePercent,
    roles: [...roleCounts.entries()]
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count),
    modules: [...moduleCounts.entries()]
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count),
    firstAt: times[0] ?? null,
    lastAt: times[times.length - 1] ?? null,
  };
}

export async function deleteFeedbackBySession(sessionId: string): Promise<number> {
  await ready();
  const removed = await db
    .delete(iterations)
    .where(sql`${iterations.sessionId} = ${sessionId}`)
    .returning({ id: iterations.id });
  return removed.length;
}
