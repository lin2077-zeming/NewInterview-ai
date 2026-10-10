import { NextResponse } from "next/server";
import { deleteSessionData } from "@/lib/ai/actions";
import { clearSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

/**
 * 删除当前会话的全部数据。
 *
 * 不要求登录，但只能删自己会话的数据 —— 会话 ID 由服务端 cookie 决定，
 * 客户端无法通过参数指定要删谁的数据。
 */
export async function DELETE() {
  try {
    const summary = await deleteSessionData();
    await clearSessionCookie();

    return NextResponse.json({
      ok: true,
      message: "已删除本会话的全部数据，并重置了匿名会话。",
      deleted: summary,
    });
  } catch (error) {
    console.error("[me/data] 删除失败:", error);
    return NextResponse.json({ error: "删除数据失败，请稍后重试。" }, { status: 500 });
  }
}
