import { NextResponse } from "next/server";
import { getAiStatus } from "@/lib/ai/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AI 可用状态。
 *
 * 前端据此决定要不要显示「离线模式」提示。
 * 只暴露"能不能用"与"用的哪家"，**不暴露任何密钥信息**。
 */
export async function GET() {
  return NextResponse.json(getAiStatus());
}
