import { createOpenAI } from "@ai-sdk/openai";
import { createDeepSeek } from "@ai-sdk/deepseek";

/**
 * 模型客户端。
 *
 * 主模型由 OPENAI_BASE_URL + INTERVIEW_MODEL / ANALYSIS_MODEL 决定，
 * 支持任意 OpenAI 兼容端点（智谱 GLM、DeepSeek、OpenAI 等）。
 *
 * 备用模型（可选）：配置 FALLBACK_API_KEY 后，主模型调用失败会自动切换过去。
 */

const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const isDeepSeek = baseURL.includes("deepseek");
const isZhipu = baseURL.includes("bigmodel.cn");

/**
 * DeepSeek 推理开关（`thinking`）。
 *
 * deepseek-flash 默认先产出 thinking token 再产出答案。实测「只回复两个字：可用」这条请求：
 *   开推理：63 completion token，其中 61 是 thinking；关掉：1 token。
 * 本项目的 AI 任务全是结构化输出（简历诊断清单、追问链），thinking 过程不进入最终结果，
 * 属于纯开销 —— 因此默认 closed。
 * 想做效果对比时：设 `DEEPSEEK_THINKING=enabled`（可选值同 DeepSeek API：enabled/disabled/adaptive）。
 */
const THINKING_MODE = (process.env.DEEPSEEK_THINKING || "disabled").trim();

/**
 * 往 DeepSeek 请求体里塞 `thinking` 开关的 fetch 中间件。
 *
 * 写在这里而不是给每个调用点传 providerOptions，是因为 withModelFallback / streamText /
 * generateObject 的调用点有十几处，逐个改必然漏；provider 的 fetch 钩子能在出口统一改。
 */
function thinkingAwareFetch(originalFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const nextBody = patchThinkingBody(init?.body);
    if (nextBody === undefined) return originalFetch(input, init);
    return originalFetch(input, { ...init, body: nextBody });
  };
}

/**
 * 返回 `undefined` 表示无需改动，沿用原 body。
 * AI SDK 实际传的是 JSON 字符串；其他形态（二进制/流）不做改动。
 */
function patchThinkingBody(body: RequestInit["body"]): BodyInit | undefined {
  if (typeof body !== "string") return undefined;
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const target = parsed as Record<string, unknown>;
    if (target.thinking !== undefined) return undefined; // 已显式指定，不覆盖
    target.thinking = { type: THINKING_MODE };
    return JSON.stringify(target);
  } catch {
    return undefined;
  }
}

/** 未显式指定模型名时，按端点推断一个合理默认值 */
function defaultModelName(): string {
  if (isDeepSeek) return "deepseek-v4-pro";
  if (isZhipu) return "glm-4.7-flash";
  return "gpt-4o";
}

/** DeepSeek 用原生 provider（正确处理 reasoning_content 回传），其余走 OpenAI 兼容适配 */
function createChatModel(options: { apiKey?: string; baseURL: string; modelName: string }) {
  const { apiKey, baseURL: url, modelName: name } = options;
  if (url.includes("deepseek")) {
    return createDeepSeek({
      apiKey,
      baseURL: url,
      fetch: thinkingAwareFetch(fetch),
    }).chat(name);
  }
  return createOpenAI({ apiKey, baseURL: url }).chat(name);
}

const primaryKey = process.env.OPENAI_API_KEY;
const inferredModel = defaultModelName();

// 面试对话：需要流式与工具调用
export const interviewModel = createChatModel({
  apiKey: primaryKey,
  baseURL,
  modelName: process.env.INTERVIEW_MODEL || inferredModel,
});

// 分析类任务：结构化输出（generateObject）
export const analysisModel = createChatModel({
  apiKey: primaryKey,
  baseURL,
  modelName: process.env.ANALYSIS_MODEL || inferredModel,
});

/** 主模型展示名，用于日志与说明 */
export const activeModelLabel = process.env.ANALYSIS_MODEL || inferredModel;

// ==================== 备用模型 ====================

const fallbackKey = process.env.FALLBACK_API_KEY;
const fallbackBaseURL = process.env.FALLBACK_BASE_URL;
const fallbackModelName = process.env.FALLBACK_MODEL;

/** 备用分析模型；未配置 FALLBACK_API_KEY 时为 null（关闭备用链路） */
export const analysisFallbackModel =
  fallbackKey && fallbackBaseURL && fallbackModelName
    ? createChatModel({
        apiKey: fallbackKey,
        baseURL: fallbackBaseURL,
        modelName: fallbackModelName,
      })
    : null;

export type ChatModel = typeof analysisModel;
