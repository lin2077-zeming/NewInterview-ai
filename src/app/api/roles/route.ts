import { NextResponse } from "next/server";
import { listJobRoleCategories, listJobRoles } from "@/lib/roles";
import { getRoleDataMeta } from "@/lib/job-roles/loader";
import { ensureFreshRoles, isRemoteRefreshEnabled } from "@/lib/job-roles/refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 公开岗位列表。
 *
 * 返回三份内容：
 * - `categories`：两级结构（一级大类 → 细分小类），前端选择器用这个
 * - `roles`     ：展平列表，给不需要分组的场景兜底（历史调用方仍可用）
 * - `meta`      ：当前生效数据的版本与来源（排查「线上跑的是哪一版」）
 *
 * 数据源统一为 `data/roles/**` + 管理员覆盖层，前端不再自带一份岗位清单。
 *
 * 顺带承担远程热更新的触发点：这是前端每次加载岗位都会经过的地方，
 * 放在这里等于「有人用就会自然更新」。刷新失败不影响本次响应。
 */
export async function GET() {
  try {
    if (isRemoteRefreshEnabled()) {
      // 内部有 TTL 节流与 8s 超时，不会拖慢常规请求
      await ensureFreshRoles().catch(() => false);
    }

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
      meta: {
        ...getRoleDataMeta(),
        remoteEnabled: isRemoteRefreshEnabled(),
      },
    });
  } catch (error) {
    console.error("[roles] 读取岗位失败:", error);
    return NextResponse.json({ error: "读取岗位列表失败。" }, { status: 500 });
  }
}
