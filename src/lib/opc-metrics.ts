import type { UsageCost } from "@/lib/ai/cost";

/**
 * OPC 度量：把「一人公司」的五个特征变成可量化的数字。
 *
 * 每次交付（简历诊断 / 追问链 / 面试 / 复盘）都会记一条事件，
 * 看板据此实时聚合出成本、耗时、AI 完成占比、迭代轮次与 AI 替代的岗位。
 *
 * 事件与团队信息存在浏览器本地（尚未接入服务端会话，见 I-05/I-11）。
 */

export type OpcEventKind =
  | "resume_diagnose"
  | "chain_generate"
  | "interview_create"
  | "interview_review";

export interface OpcEvent {
  id: string;
  kind: OpcEventKind;
  /** 完成时间（ISO） */
  at: string;
  durationMs: number;
  source: "ai" | "fallback";
  inputTokens: number;
  outputTokens: number;
  /** 本次交付的估算成本（元） */
  cost: number;
  /** 交付物计数（条建议 / 个节点 / 场面试） */
  units: number;
  /** 简述本次交付了什么 */
  label: string;
  /** 仅简历诊断：本次得分，用于迭代趋势 */
  score?: number;
}

/** 每类交付对应的「它替代了哪个岗位」 */
export const KIND_META: Record<
  OpcEventKind,
  { label: string; replacedRole: string; unit: string }
> = {
  resume_diagnose: { label: "简历诊断", replacedRole: "简历顾问", unit: "条建议" },
  chain_generate: { label: "岗位追问链", replacedRole: "面试教练", unit: "个追问节点" },
  interview_create: { label: "面试陪练", replacedRole: "面试官", unit: "场面试" },
  interview_review: { label: "面试复盘", replacedRole: "复盘教练", unit: "份报告" },
};

export const OPC_EVENTS_KEY = "zhijing-opc-metrics-events";
export const OPC_TEAM_KEY = "zhijing-opc-team";
const MAX_EVENTS = 300;

export interface OpcTeam {
  /** 团队人数（含本人） */
  size: number;
}

export const DEFAULT_TEAM: OpcTeam = { size: 1 };

// ==================== 读写 ====================

export function loadOpcEvents(): OpcEvent[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(OPC_EVENTS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OpcEvent[]) : [];
  } catch {
    return [];
  }
}

export function recordOpcEvent(input: {
  kind: OpcEventKind;
  durationMs: number;
  source: "ai" | "fallback";
  usage?: Partial<UsageCost> | null;
  units: number;
  label: string;
  score?: number;
}): OpcEvent {
  const event: OpcEvent = {
    id: crypto.randomUUID(),
    kind: input.kind,
    at: new Date().toISOString(),
    durationMs: Math.max(0, Math.round(input.durationMs)),
    source: input.source,
    inputTokens: input.usage?.inputTokens ?? 0,
    outputTokens: input.usage?.outputTokens ?? 0,
    cost: input.usage?.cost ?? 0,
    units: Math.max(0, input.units),
    label: input.label,
    score: input.score,
  };

  if (typeof window !== "undefined") {
    const next = [event, ...loadOpcEvents()].slice(0, MAX_EVENTS);
    window.localStorage.setItem(OPC_EVENTS_KEY, JSON.stringify(next));
  }

  return event;
}

export function clearOpcEvents() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(OPC_EVENTS_KEY);
}

export function loadOpcTeam(): OpcTeam {
  if (typeof window === "undefined") return DEFAULT_TEAM;

  const raw = window.localStorage.getItem(OPC_TEAM_KEY);
  if (!raw) return DEFAULT_TEAM;

  try {
    const parsed = JSON.parse(raw) as OpcTeam;
    const size = Number(parsed?.size);
    return { size: Number.isFinite(size) && size >= 1 ? Math.min(50, Math.round(size)) : 1 };
  } catch {
    return DEFAULT_TEAM;
  }
}

export function saveOpcTeam(team: OpcTeam) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OPC_TEAM_KEY, JSON.stringify(team));
}

// ==================== 聚合 ====================

export interface OpcScorePoint {
  at: string;
  score: number;
  index: number;
}

export interface OpcMetrics {
  deliveries: number;
  totalCost: number;
  avgCostPerDelivery: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalDurationMs: number;
  avgDurationMs: number;
  aiDeliveries: number;
  offlineDeliveries: number;
  aiSharePercent: number;
  totalUnits: number;
  replacedRoles: string[];
  iterations: number;
  scoreTrend: OpcScorePoint[];
  scoreFrom: number | null;
  scoreTo: number | null;
  activeDays: number;
  firstAt: string | null;
  lastAt: string | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function computeOpcMetrics(events: OpcEvent[]): OpcMetrics {
  const deliveries = events.length;

  const totalCost = events.reduce((sum, event) => sum + (event.cost ?? 0), 0);
  const totalInputTokens = events.reduce((sum, event) => sum + (event.inputTokens ?? 0), 0);
  const totalOutputTokens = events.reduce((sum, event) => sum + (event.outputTokens ?? 0), 0);
  const totalDurationMs = events.reduce((sum, event) => sum + (event.durationMs ?? 0), 0);
  const totalUnits = events.reduce((sum, event) => sum + (event.units ?? 0), 0);
  const aiDeliveries = events.filter((event) => event.source === "ai").length;

  const roles = new Set<string>();
  for (const event of events) {
    const meta = KIND_META[event.kind];
    if (meta) roles.add(meta.replacedRole);
  }

  // 迭代轮次 = 简历诊断的轮数（改一版、再诊断一次，轮次 +1）
  const diagnosisEvents = events
    .filter((event) => event.kind === "resume_diagnose" && typeof event.score === "number")
    .slice()
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const scoreTrend: OpcScorePoint[] = diagnosisEvents.map((event, index) => ({
    at: event.at,
    score: event.score as number,
    index: index + 1,
  }));

  const days = new Set(events.map((event) => event.at.slice(0, 10)));

  return {
    deliveries,
    totalCost: Math.round(totalCost * 10000) / 10000,
    avgCostPerDelivery: deliveries > 0 ? Math.round((totalCost / deliveries) * 10000) / 10000 : 0,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalDurationMs,
    avgDurationMs: deliveries > 0 ? Math.round(totalDurationMs / deliveries) : 0,
    aiDeliveries,
    offlineDeliveries: deliveries - aiDeliveries,
    aiSharePercent: deliveries > 0 ? Math.round((aiDeliveries / deliveries) * 100) : 0,
    totalUnits,
    replacedRoles: [...roles],
    iterations: scoreTrend.length,
    scoreTrend,
    scoreFrom: scoreTrend[0]?.score ?? null,
    scoreTo: scoreTrend[scoreTrend.length - 1]?.score ?? null,
    activeDays: days.size,
    firstAt: events.length > 0 ? events[events.length - 1].at : null,
    lastAt: events.length > 0 ? events[0].at : null,
  };
}

export interface OpcMaturity {
  lowCost: number;
  soloTeam: number;
  aiExecution: number;
  fastValidation: number;
  iteration: number;
  overall: number;
}

/**
 * OPC 五特征 → 0-100 成熟度。
 * 口径写在注释里，便于材料中说明打分依据。
 */
export function computeOpcMaturity(metrics: OpcMetrics, team: OpcTeam): OpcMaturity {
  if (metrics.deliveries === 0) {
    return { lowCost: 0, soloTeam: 0, aiExecution: 0, fastValidation: 0, iteration: 0, overall: 0 };
  }

  // 低成本启动：单次交付成本越低越高分（¥0.05 → ~94，¥0.5 → ~40）
  const lowCost = clamp(Math.round(100 - metrics.avgCostPerDelivery * 120), 25, 100);

  // 一人公司：团队越小越高分
  const soloTeam = team.size <= 1 ? 100 : team.size === 2 ? 85 : team.size === 3 ? 70 : 55;

  // AI 辅助执行：AI 路径占比
  const aiExecution = clamp(metrics.aiSharePercent, 0, 100);

  // 快速验证：平均交付耗时（10s → 100，60s → 72，120s → 39）
  const avgSec = metrics.avgDurationMs / 1000;
  const fastValidation = clamp(Math.round(105 - avgSec * 0.55), 25, 100);

  // 持续迭代：诊断轮次（1 轮 → 35，3 轮 → 71，5 轮 → 100）
  const iteration = clamp(Math.round(35 + (metrics.iterations - 1) * 18), 20, 100);

  const overall = Math.round(
    (lowCost + soloTeam + aiExecution + fastValidation + iteration) / 5
  );

  return { lowCost, soloTeam, aiExecution, fastValidation, iteration, overall };
}

/** 毫秒 → 人类可读（如 2.4s / 1分12秒） */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}分${rest}秒`;
}

/** 金额显示：小于 1 元保留 3-4 位小数 */
export function formatCost(value: number): string {
  if (value === 0) return "¥0";
  if (value < 1) return `¥${value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
  return `¥${value.toFixed(2)}`;
}
