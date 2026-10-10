import { NextResponse } from "next/server";
import { getReview } from "@/lib/ai/actions";
import { NotFoundError } from "@/lib/errors";

/** 越权一律当作"不存在"，不泄露该面试 ID 是否有效 */
function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 }
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const report = await getReview(id);

    if (!report) {
      return NextResponse.json({ error: "复盘报告不存在" }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error("获取复盘报告失败:", error);
    return toErrorResponse(error, "获取复盘报告失败");
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let stage: string | undefined;
    try {
      const body = await req.json();
      stage = body.stage;
    } catch {}
    const { generateReview } = await import("@/lib/ai/actions");
    const report = await generateReview(id, stage);
    return NextResponse.json({ report });
  } catch (error) {
    console.error("生成复盘报告失败:", error);
    return toErrorResponse(error, "生成复盘报告失败");
  }
}
