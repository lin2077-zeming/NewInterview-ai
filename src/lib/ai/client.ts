import { createOpenAI } from "@ai-sdk/openai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { guardedFetch } from "@/lib/ai/request-guard";

/**
 * 模型客户端。
 *
 * 主模型由 OPENAI_BASE_URL + INTERVIEW_MODEL / ANALYSIS_MODEL 决定，
 * 支持任意 OpenAI 兼容端点（智谱 GLM、DeepSeek、OpenAI 等）。
 *
 * 备用模型（可选）：配置 FALLBACK_API_KEY 后，主模型调用失败会自动切换过去。
 *
 * 两条链路都套了 `guardedFetch` —— 输出上限与推理开关在出口统一施加，
 * 调用点不需要（也不应该）各自去关心。
 */

const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const isDeepSeek = baseURL.includes("deepseek");
const isZhipu = baseURL.includes("bigmodel.cn");

/** 未显式指定模型名时，按端点推断一个合理默认值 */
function defaultModelName(): string {
  if (isDeepSeek) return "deepseek-v4-pro";
  if (isZhipu) return "glm-4.7-flash";
  return "gpt-4o";
}

/** DeepSeek 用原生 provider（正确处理 reasoning_content 回传），其余走 OpenAI 兼容适配 */
function createChatModel(options: { apiKey?: string; baseURL: string; modelName: string }) {
  const { apiKey, baseURL: url, modelName: name } = options;
  const withGuard = guardedFetch(fetch, { isDeepSeek: url.includes("deepseek") });

  if (url.includes("deepseek")) {
    return createDeepSeek({ apiKey, baseURL: url, fetch: withGuard }).chat(name);
  }
  return createOpenAI({ apiKey, baseURL: url, fetch: withGuard }).chat(name);
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

/** 备用模型展示名；未配置时为 null（成本流水里要记清到底是谁在干活） */
export const fallbackModelLabel = analysisFallbackModel ? fallbackModelName : null;

export type ChatModel = typeof analysisModel;
