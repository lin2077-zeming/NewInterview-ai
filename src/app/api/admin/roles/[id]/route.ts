import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { AdminAuthError, RoleValidationError } from "@/lib/errors";
import { deleteJobRole, setJobRoleEnabled, updateJobRole, type JobRoleInput } from "@/lib/roles";

export const runtime = "nodejs";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AdminAuthError) {
    const status = error.message.includes("未启用") ? 503 : 401;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (error instanceof RoleValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** 修改岗位（key 不可改） */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertAdmin(req);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as JobRoleInput;
    const role = await updateJobRole(id, body);
    return NextResponse.json({ ok: true, role });
  } catch (error) {
    console.error("[admin/roles] 修改失败:", error);
    return toErrorResponse(error, "修改岗位失败。");
  }
}

/** 启用 / 停用 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertAdmin(req);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { enabled?: boolean };

    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "缺少 enabled 参数。" }, { status: 400 });
    }

    const role = await setJobRoleEnabled(id, body.enabled);
    return NextResponse.json({ ok: true, role });
  } catch (error) {
    console.error("[admin/roles] 停用/启用失败:", error);
    return toErrorResponse(error, "更新岗位状态失败。");
  }
}

/** 删除岗位（历史数据已存的是中文标签快照，删除不会导致数据丢失） */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertAdmin(req);
    const { id } = await params;
    await deleteJobRole(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/roles] 删除失败:", error);
    return toErrorResponse(error, "删除岗位失败。");
  }
}
