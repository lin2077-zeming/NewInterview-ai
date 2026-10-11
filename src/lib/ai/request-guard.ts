/**
 * 出站请求守卫。
 *
 * 位置选在 provider 的 `fetch` 出口，是因为**这是唯一不会漏的地方**：
 * 项目里 generateObject / generateText / streamText 的调用点有十几处，
 * 逐个去加参数一定会漏掉几个，而漏掉的那个恰好就是会跑飞的那个。
 *
 * 目前统一管两件事：
 * 1. **输出上限**：请求体里没有 max_tokens 时补一个安全上限。
 *    `maxOutputTokens` 在 AI SDK 里映射到 OpenAI 兼容协议的 `max_tokens`
 *    （已实测确认字段名，@ai-sdk/deepseek 与 @ai-sdk/openai 都是它）。
 *    调用点已显式指定则不覆盖 —— 守卫只兜底，不夺权。
 * 2. **DeepSeek 推理开关**：注入 `thinking`，见下方注释。
 */

/** 单次调用输出 token 的安全上限，可用 OPC_MAX_OUTPUT_TOKENS 调整 */
function resolveMaxOutputTokens(): number {
  const raw = Number(process.env.OPC_MAX_OUTPUT_TOKENS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 4096;
}

export const MAX_OUTPUT_TOKENS = resolveMaxOutputTokens();

/**
 * DeepSeek 推理开关（`thinking`）。
 *
 * deepseek-flash 默认先产出 thinking token 再产出答案。实测「只回复两个字：可用」这条请求：
 *   开推理：63 completion token，其中 61 是 thinking；关掉：1 token。
 * 本项目的 AI 任务全是结构化输出（简历诊断清单、追问链），thinking 过程不进入最终结果，
 * 属于纯开销 —— 因此默认关闭。
 * 想做效果对比时：设 `DEEPSEEK_THINKING=enabled`（可选值同 DeepSeek API：enabled/disabled/adaptive）。
 */
const THINKING_MODE = (process.env.DEEPSEEK_THINKING || "disabled").trim();

/**
 * 返回 `undefined` 表示无需改动，沿用原 body。
 * AI SDK 实际传的是 JSON 字符串；其他形态（二进制/流）不做改动。
 */
function patchBody(body: RequestInit["body"], isDeepSeek: boolean): BodyInit | undefined {
  if (typeof body !== "string") return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;

  const target = parsed as Record<string, unknown>;
  let changed = false;

  const hasOutputLimit =
    target.max_tokens !== undefined || target.max_completion_tokens !== undefined;
  if (!hasOutputLimit) {
    target.max_tokens = MAX_OUTPUT_TOKENS;
    changed = true;
  }

  if (isDeepSeek && target.thinking === undefined) {
    target.thinking = { type: THINKING_MODE };
    changed = true;
  }

  return changed ? JSON.stringify(target) : undefined;
}

/** 包一层 fetch，在请求发出前统一施加上述约束 */
export function guardedFetch(originalFetch: typeof fetch, options: { isDeepSeek: boolean }): typeof fetch {
  return async (input, init) => {
    const nextBody = patchBody(init?.body, options.isDeepSeek);
    if (nextBody === undefined) return originalFetch(input, init);
    return originalFetch(input, { ...init, body: nextBody });
  };
}
