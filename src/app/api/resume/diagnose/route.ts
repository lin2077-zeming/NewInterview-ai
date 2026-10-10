import { NextResponse } from "next/server";
import { ZERO_USAGE } from "@/lib/ai/cost";
import {
  buildFallbackDiagnosis,
  diagnoseResumeWithAI,
  isResumeLike,
} from "@/lib/ai/resume-diagnosis";
import { withTimeout } from "@/lib/async-utils";

export const runtime = "nodejs";

interface DiagnoseRequest {
  rawText?: string;
  targetRole?: string;
  fileName?: string;
}

/**
 * 简历诊断：把简历文本转成一份**可执行的修改清单**。
 *
 * 每条建议都必须引用简历原句并给出改后原句。
 * AI 不可用时（未配密钥 / 超时 / 输出异常）自动降级为规则版诊断，保证始终有结果。
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DiagnoseRequest;
    const rawText = body.rawText?.trim();

    if (!rawText) {
      return NextResponse.json(
        { error: "简历内容为空，请先上传或粘贴简历。" },
        { status: 400 }
      );
    }

    if (!isResumeLike(rawText)) {
      return NextResponse.json(
        { error: "这份内容不像简历，请上传包含教育经历、项目经历、技能栈或工作经历的简历。" },
        { status: 400 }
      );
    }

    try {
      const ai = await withTimeout(diagnoseResumeWithAI(rawText, body.targetRole), 40000);
      if (ai) {
        return NextResponse.json({
          ...ai.diagnosis,
          usage: ai.usage,
          fileName: body.fileName,
        });
      }
    } catch (error) {
      console.warn(
        "[resume/diagnose] AI 诊断失败，降级为规则版：",
        error instanceof Error ? error.message : error
      );
    }

    return NextResponse.json({
      ...buildFallbackDiagnosis(rawText, body.targetRole),
      usage: ZERO_USAGE,
      fileName: body.fileName,
    });
  } catch (error) {
    console.error("[resume/diagnose] 诊断异常:", error);
    return NextResponse.json({ error: "简历诊断失败，请稍后重试。" }, { status: 500 });
  }
}
