/**
 * AI 调用成本估算。
 *
 * 默认单价按 base_url 自动判定：
 * - 智谱 bigmodel.cn（GLM-Flash 免费档）→ 0
 * - DeepSeek → V4-Pro 空闲时段 4.5 / 13.5 元每百万 token
 *   （DeepSeek 2026-08-17 起采用峰谷定价，北京时间 9:00-12:00 / 14:00-18:00
 *    为高峰，其余为空闲，空闲价为高峰的一半；高峰请自行上调）
 * - 其他端点 → 0（未知单价不臆造）
 *
 * 单价可用环境变量覆盖，避免模型或价格变动后需要改代码：
 *   OPC_PRICE_INPUT_PER_MILLION   （元 / 百万输入 token）
 *   OPC_PRICE_OUTPUT_PER_MILLION  （元 / 百万输出 token）
 */

const PROVIDER_PRICES: Array<{ match: string; input: number; output: number; note: string }> = [
  { match: "bigmodel.cn", input: 0, output: 0, note: "智谱 GLM-Flash 免费档" },
  { match: "deepseek", input: 4.5, output: 13.5, note: "DeepSeek V4-Pro 空闲时段" },
];

function resolvePrices() {
  const baseURL = process.env.OPENAI_BASE_URL || "";
  const matched = PROVIDER_PRICES.find((item) => baseURL.includes(item.match));

  const envInput = Number(process.env.OPC_PRICE_INPUT_PER_MILLION);
  const envOutput = Number(process.env.OPC_PRICE_OUTPUT_PER_MILLION);

  return {
    input:
      Number.isFinite(envInput) && envInput >= 0
        ? envInput
        : matched?.input ?? 0,
    output:
      Number.isFinite(envOutput) && envOutput >= 0
        ? envOutput
        : matched?.output ?? 0,
    note: matched?.note ?? "未匹配到已知端点，按 0 计",
  };
}

const prices = resolvePrices();

export const PRICE_PER_MILLION_INPUT = prices.input;
export const PRICE_PER_MILLION_OUTPUT = prices.output;
export const PRICE_NOTE = prices.note;
/** 当前是否为零成本（免费模型） */
export const IS_FREE_TIER = prices.input === 0 && prices.output === 0;

export interface UsageCost {
  inputTokens: number;
  outputTokens: number;
  /** 估算成本（元），保留 4 位小数 */
  cost: number;
}

/** 从 AI SDK 的 usage 计算估算成本；无 usage 时返回 0 成本 */
export function estimateCost(
  usage?: { inputTokens?: number; outputTokens?: number } | null
): UsageCost {
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;

  const cost =
    (inputTokens / 1_000_000) * PRICE_PER_MILLION_INPUT +
    (outputTokens / 1_000_000) * PRICE_PER_MILLION_OUTPUT;

  return {
    inputTokens,
    outputTokens,
    cost: Math.round(cost * 10000) / 10000,
  };
}

/** 规则版 / 离线路径不产生 AI 成本 */
export const ZERO_USAGE: UsageCost = { inputTokens: 0, outputTokens: 0, cost: 0 };
