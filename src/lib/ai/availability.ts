/**
 * AI 可用性检测。
 *
 * 为什么单独成一层：项目原来的"降级"是**被动**的 —— 先去调 AI，失败了再走离线内容。
 * 没配密钥时这意味着一件事：每个请求都要先等一次网络失败（十几秒），
 * 用户看到的是页面卡住，日志里刷满"调用失败"，而真正的原因（压根没配密钥）被淹了。
 *
 * 改成**主动检测**后：
 * - 未配密钥 → 立刻走离线内容，不浪费时间也不污染日志
 * - 前端可以明确告诉用户"现在是离线模式"，而不是让用户猜为什么没反应
 *
 * 这也是赛事官方在选题里暗示的加分设计：**没有 AI 密钥也要能用**。
 */

const KEY = process.env.OPENAI_API_KEY?.trim() || "";

/** 是否配置了 AI 密钥。没有它就只能走离线内容 */
export function isAiConfigured(): boolean {
  return KEY.length > 0;
}

export type AiMode = "online" | "offline";

export interface AiStatus {
  mode: AiMode;
  /** 是否配置了主模型密钥 */
  configured: boolean;
  /** 展示用：模型提供方 */
  provider: string;
  /** 展示用：模型名 */
  model: string;
  /** 是否配置了备用模型（主模型失败时自动切换） */
  fallbackEnabled: boolean;
  /** 离线时说明原因，前端可直接展示 */
  reason?: string;
}

function providerLabel(baseURL: string): string {
  if (baseURL.includes("bigmodel.cn") || baseURL.includes("z.ai")) return "智谱 GLM";
  if (baseURL.includes("deepseek")) return "DeepSeek";
  if (baseURL.includes("openai.com")) return "OpenAI";
  return "OpenAI 兼容端点";
}

function modelLabel(baseURL: string): string {
  const analysis = process.env.ANALYSIS_MODEL?.trim();
  if (analysis) return analysis;
  if (baseURL.includes("bigmodel.cn") || baseURL.includes("z.ai")) return "glm-4.7-flash";
  if (baseURL.includes("deepseek")) return "deepseek-v4-pro";
  return "gpt-4o";
}

export function getAiStatus(): AiStatus {
  const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const configured = isAiConfigured();

  return {
    mode: configured ? "online" : "offline",
    configured,
    provider: providerLabel(baseURL),
    model: modelLabel(baseURL),
    fallbackEnabled: Boolean(process.env.FALLBACK_API_KEY && process.env.FALLBACK_BASE_URL),
    ...(configured
      ? {}
      : {
          reason:
            "未配置 OPENAI_API_KEY，AI 相关功能（面试陪练、AI 简历诊断、AI 追问链）暂不可用。" +
            "题库练习与离线追问链不受影响。",
        }),
  };
}
