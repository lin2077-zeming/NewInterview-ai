import { NextResponse } from "next/server";
import { ZERO_USAGE } from "@/lib/ai/cost";
import { buildFallbackQuestionChain, generateQuestionChainWithAI } from "@/lib/ai/question-chain";
import { withTimeout } from "@/lib/async-utils";

export const runtime = "nodejs";

interface ChainRequest {
  /** 岗位 key（frontend / backend / ...）或中文岗位名 */
  role?: string;
  /** 公司 key（bytedance / alibaba / ...） */
  company?: string;
  /** 候选人层次，如「校招」「社招」 */
  level?: string;
}

/**
 * 岗位追问链生成。
 *
 * 输出「岗位 → 考察维度 → 逐层追问」的可视化链条。
 * AI 不可用时（未配密钥 / 超时 / 输出不合格）自动降级为人工配置版。
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ChainRequest;

    try {
      const ai = await withTimeout(generateQuestionChainWithAI(body), 45000);
      if (ai) {
        return NextResponse.json({ ...ai.chain, usage: ai.usage });
      }
    } catch (error) {
      console.warn(
        "[interview/chain] AI 生成失败，降级为配置版：",
        error instanceof Error ? error.message : error
      );
    }

    return NextResponse.json({
      ...buildFallbackQuestionChain(body.role, body.company),
      usage: ZERO_USAGE,
    });
  } catch (error) {
    console.error("[interview/chain] 生成异常:", error);
    return NextResponse.json({ error: "追问链生成失败，请稍后重试。" }, { status: 500 });
  }
}
