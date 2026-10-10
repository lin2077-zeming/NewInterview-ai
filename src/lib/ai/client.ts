import { createOpenAI } from "@ai-sdk/openai";
import { createDeepSeek } from "@ai-sdk/deepseek";

const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const isDeepSeek = baseURL.includes("deepseek");
const defaultModel = isDeepSeek ? "deepseek-v4-pro" : "gpt-4o";

const deepseek = createDeepSeek({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL,
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL,
});

// DeepSeek 原生 provider：正确处理 reasoning_content 回传（thinking 模式）
export const interviewModel = isDeepSeek
  ? deepseek.chat(process.env.INTERVIEW_MODEL || defaultModel)
  : openai.chat(process.env.INTERVIEW_MODEL || defaultModel);

// 分析任务用通用 OpenAI 适配（generateObject 等不需要 thinking）
export const analysisModel = openai.chat(
  process.env.ANALYSIS_MODEL || defaultModel
);
