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

/**
 * 请求实际由哪条链路完成。
 *
 * 关键：**主模型和备用模型的单价不同**。备用模型顶上来的时候如果还按主模型的
 * 单价算钱，就会出现「明明在烧 DeepSeek 的钱、看板却显示 ¥0」这种自欺欺人的数字。
 */
export type PriceChannel = "primary" | "fallback";

function resolvePrices(channel: PriceChannel = "primary") {
  const baseURL =
    (channel === "fallback" ? process.env.FALLBACK_BASE_URL : process.env.OPENAI_BASE_URL) || "";
  const matched = PROVIDER_PRICES.find((item) => baseURL.includes(item.match));

  // 主链路允许用环境变量覆盖；备用链路必须真实反映自己的单价，不接受覆盖，
  // 否则成本又一次失真
  const envInput =
    channel === "primary" ? Number(process.env.OPC_PRICE_INPUT_PER_MILLION) : Number.NaN;
  const envOutput =
    channel === "primary" ? Number(process.env.OPC_PRICE_OUTPUT_PER_MILLION) : Number.NaN;

  return {
    input:
      Number.isFinite(envInput) && envInput >= 0 ? envInput : matched?.input ?? 0,
    output:
      Number.isFinite(envOutput) && envOutput >= 0 ? envOutput : matched?.output ?? 0,
    note: matched?.note ?? "未匹配到已知端点，按 0 计",
  };
}

const prices = resolvePrices("primary");

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

/**
 * 从 AI SDK 的 usage 计算估算成本；无 usage 时返回 0 成本。
 *
 * `channel` 必须是**实际完成请求的那条链路**（主模型 / 备用模型），
 * 由 withModelFallback 回传 —— 两条链路单价不同，传错就等于算错钱。
 */
export function estimateCost(
  usage?: { inputTokens?: number; outputTokens?: number } | null,
  channel: PriceChannel = "primary"
): UsageCost {
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;

  const unit = channel === "fallback" ? resolvePrices("fallback") : prices;

  const cost =
    (inputTokens / 1_000_000) * unit.input + (outputTokens / 1_000_000) * unit.output;

  return {
    inputTokens,
    outputTokens,
    cost: Math.round(cost * 10000) / 10000,
  };
}

/** 备用链路（顶上时）的真实单价说明，用于看板展示 */
export const FALLBACK_PRICE_NOTE = analysisFallbackPrices().note;

function analysisFallbackPrices() {
  // 仅在真正配置了备用模型时才算；未配置时说明沿用主链路
  return process.env.FALLBACK_API_KEY
    ? resolvePrices("fallback")
    : { input: prices.input, output: prices.output, note: prices.note };
}

/** 规则版 / 离线路径不产生 AI 成本 */
export const ZERO_USAGE: UsageCost = { inputTokens: 0, outputTokens: 0, cost: 0 };
