import { activeModelLabel, analysisFallbackModel, analysisModel, type ChatModel } from "@/lib/ai/client";

/**
 * 用主模型执行；主模型失败且配置了备用模型时，自动切换过去重试一次。
 *
 * 调用方仍是原样的 AI SDK 调用，只是把 model 换成回调传入的参数：
 *
 *   const { object, usage } = await withModelFallback((model) =>
 *     generateObject({ model, system, schema, prompt })
 *   );
 *
 * 两层兜底叠加关系：主模型 → 备用模型 → 调用方的规则版/配置版降级。
 */
export async function withModelFallback<T>(run: (model: ChatModel) => Promise<T>): Promise<T> {
  try {
    return await run(analysisModel);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    if (!analysisFallbackModel) {
      console.warn(`[ai] 主模型（${activeModelLabel}）调用失败：${reason}`);
      throw error;
    }

    console.warn(`[ai] 主模型（${activeModelLabel}）调用失败，切换备用模型重试：${reason}`);
    return await run(analysisFallbackModel);
  }
}
