import { activeModelLabel, analysisFallbackModel, analysisModel, type ChatModel } from "@/lib/ai/client";
import type { PriceChannel } from "@/lib/ai/cost";

export interface ModelResult<T> {
  value: T;
  /** 实际由哪条链路完成 —— 决定按谁的单价计费 */
  servedBy: PriceChannel;
}

/**
 * 用主模型执行；主模型失败且配置了备用模型时，自动切换过去重试一次。
 *
 * 返回值带 `servedBy` 字段，调用方务必把它透传给 `estimateCost`：
 * 主模型与备用模型单价不同，按错链路算出来的成本是自欺欺人的数字。
 *
 * 两层兜底叠加关系：主模型 → 备用模型 → 调用方的规则版/配置版降级。
 */
export async function withModelFallback<T>(run: (model: ChatModel) => Promise<T>): Promise<ModelResult<T>> {
  try {
    return { value: await run(analysisModel), servedBy: "primary" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    if (!analysisFallbackModel) {
      console.warn(`[ai] 主模型（${activeModelLabel}）调用失败：${reason}`);
      throw error;
    }

    console.warn(`[ai] 主模型（${activeModelLabel}）调用失败，切换备用模型重试：${reason}`);
    return { value: await run(analysisFallbackModel), servedBy: "fallback" };
  }
}
