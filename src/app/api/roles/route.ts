import { NextResponse } from "next/server";
import { listJobRoleCategories, listJobRoles } from "@/lib/roles";

export const runtime = "nodejs";

/**
 * 公开岗位列表。
 *
 * 返回两份视图：
 * - `categories`：两级结构（一级大类 → 细分小类），前端选择器用这个
 * - `roles`     ：展平列表，给不需要分组的场景兜底（历史调用方仍可用）
 *
 * 数据源统一为 `data/roles/**` + 管理员覆盖层，前端不再自带一份岗位清单。
 */
export async function GET() {
  try {
    const [categories, roles] = await Promise.all([
      listJobRoleCategories(),
      listJobRoles(),
    ]);

    return NextResponse.json({
      categories,
      roles: roles.map((role) => ({
        key: role.key,
        label: role.label,
        category: role.category,
        categoryId: role.categoryId,
        categoryLabel: role.categoryLabel,
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
