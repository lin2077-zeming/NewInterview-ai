import type { LanguageModelUsage } from "ai";
import {
  activeModelLabel,
  analysisFallbackModel,
  analysisModel,
  fallbackModelLabel,
  type ChatModel,
} from "@/lib/ai/client";
import { isAiConfigured } from "@/lib/ai/availability";
import { estimateCost, type PriceChannel } from "@/lib/ai/cost";
import { logCost } from "@/lib/ai/cost-log";
import { AiUnavailableError } from "@/lib/errors";
import { getSessionId } from "@/lib/session";

export interface ModelResult<T> {
  value: T;
  /** 实际由哪条链路完成 —— 决定按谁的单价计费 */
  servedBy: PriceChannel;
}

/**
 * 用主模型执行；主模型失败且配置了备用模型时，自动切换过去重试一次。
 *
 * 两条附带职责都收在这里，调用方不需要关心：
 * 1. 回传 `servedBy` —— 主模型与备用模型单价不同，按错链路算出来的成本是自欺欺人的数字
 * 2. **写成本流水** —— 记账放在这里，「每次 AI 调用都有成本记录」才不依赖调用方自觉
 *
 * 三层兜底叠加关系：主模型 → 备用模型 → 调用方的规则版/配置版降级。
 */
export async function withModelFallback<T extends { usage?: LanguageModelUsage }>(
  run: (model: ChatModel) => Promise<T>,
  options: { kind: string }
): Promise<ModelResult<T>> {
  // 主动检测：没配密钥就直接抛，让调用方的离线分支立刻接管。
  // 不这样做的话每个请求都要先等一次网络失败（十几秒），
  // 而且日志里全是"调用失败"，真正的原因（没配密钥）反而看不出来。
  if (!isAiConfigured()) {
    throw new AiUnavailableError();
  }

  const startedAt = Date.now();

  const finish = async (value: T, servedBy: PriceChannel): Promise<ModelResult<T>> => {
    const usage = estimateCost(value.usage, servedBy);
    const sessionId = await getSessionId().catch(() => null);

    await logCost({
      sessionId,
      kind: options.kind,
      model: (servedBy === "fallback" ? fallbackModelLabel : activeModelLabel) ?? "unknown",
      channel: servedBy,
      usage,
      durationMs: Date.now() - startedAt,
    });

    return { value, servedBy };
  };

  try {
    return await finish(await run(analysisModel), "primary");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    if (!analysisFallbackModel) {
      console.warn(`[ai] 主模型（${activeModelLabel}）调用失败：${reason}`);
      throw error;
    }

    console.warn(`[ai] 主模型（${activeModelLabel}）调用失败，切换备用模型重试：${reason}`);
    return await finish(await run(analysisFallbackModel), "fallback");
  }
}
