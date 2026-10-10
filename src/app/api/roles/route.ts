import { NextResponse } from "next/server";
import { listJobRoles } from "@/lib/roles";

export const runtime = "nodejs";

/**
 * 公开岗位列表。
 *
 * 前端下拉统一从这里取（内置 8 个 + 管理员新增），
 * 避免岗位列表在多个页面各写一份。
 */
export async function GET() {
  try {
    const roles = await listJobRoles();
    return NextResponse.json({
      roles: roles.map((role) => ({
        key: role.key,
        label: role.label,
        category: role.category,
        skills: role.skills,
        source: role.source,
        hasOfflineContent: role.hasOfflineContent,
      })),
    });
  } catch (error) {
    console.error("[roles] 读取岗位失败:", error);
    return NextResponse.json({ error: "读取岗位列表失败。" }, { status: 500 });
  }
}
