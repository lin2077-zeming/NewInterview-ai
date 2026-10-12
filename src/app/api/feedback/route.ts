import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { AdminAuthError } from "@/lib/errors";
import {
  FeedbackValidationError,
  VERDICT_LABELS,
  listFeedback,
  submitFeedback,
  summarizeFeedback,
  type FeedbackInput,
} from "@/lib/feedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AdminAuthError) {
    const status = error.message.includes("未启用") ? 503 : 401;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (error instanceof FeedbackValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/**
 * 提交试用反馈（公开）。
 *
 * 试用者本人填写，不需要登录 —— 降低填写门槛才能拿到真实反馈。
 * 只收集化名/编号与主观评价，不收集真名与联系方式。
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as FeedbackInput;
    const record = await submitFeedback(body);
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return toErrorResponse(error, "提交反馈失败，请稍后重试。");
  }
}

/**
 * 读取反馈列表与汇总（需管理员令牌）。
 *
 * 需要鉴权是因为**这是别人的数据**：化名、背景、原话都在里面。
 * 公开它等于把试用者的信息摊在网上。
 */
export async function GET(req: Request) {
  try {
    assertAdmin(req);
    const records = await listFeedback();
    const summary = summarizeFeedback(records);
    return NextResponse.json({
      summary,
      records,
      verdictLabels: VERDICT_LABELS,
    });
  } catch (error) {
    return toErrorResponse(error, "读取反馈失败。");
  }
}
