import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { AdminAuthError, RoleValidationError } from "@/lib/errors";
import { createJobRole, listJobRoles, type JobRoleInput } from "@/lib/roles";

export const runtime = "nodejs";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AdminAuthError) {
    // 未配置令牌属于服务端配置问题，用 503 区分于"令牌错误"
    const status = error.message.includes("未启用") ? 503 : 401;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (error instanceof RoleValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** 管理端岗位列表（含已停用） */
export async function GET(req: Request) {
  try {
    assertAdmin(req);
    const roles = await listJobRoles({ includeDisabled: true });
    return NextResponse.json({ roles });
  } catch (error) {
    console.error("[admin/roles] 读取失败:", error);
    return toErrorResponse(error, "读取岗位列表失败。");
  }
}

/** 新增岗位 */
export async function POST(req: Request) {
  try {
    assertAdmin(req);

    const body = (await req.json().catch(() => ({}))) as JobRoleInput;
    const role = await createJobRole(body);

    return NextResponse.json({ ok: true, role }, { status: 201 });
  } catch (error) {
    console.error("[admin/roles] 新增失败:", error);
    return toErrorResponse(error, "新增岗位失败。");
  }
}
