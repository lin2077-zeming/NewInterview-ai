import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { jobRoles } from "@/lib/db/schema";
import {
  getRoleDimensions,
  listRoleCategoryViews,
  listRoleViews,
} from "@/lib/job-roles/loader";
import type { RoleCategoryView, RoleDimension } from "@/lib/job-roles/types";
import { RoleValidationError } from "@/lib/errors";

/**
 * 岗位数据访问。
 *
 * 两级来源：
 * - `builtin`：来自 `data/roles/**`（64 个子类，11 个大类）。
 *   **这是唯一数据源** —— 代码里不再有第二份岗位清单（改造前有 4 份且已分叉）。
 * - `admin`  ：管理员通过管理端新增的岗位，只存元信息（描述 + 技能要求），
 *              面试内容由 AI 按描述实时生成
 *
 * 对外统一成 `JobRole`，调用方不需要关心来源。
 */

export interface JobRole {
  key: string;
  label: string;
  category?: string;
  /** 一级大类 id（两级分类用，如 `cs-it`） */
  categoryId?: string;
  /** 大类显示名，如「计算机与信息技术」 */
  categoryLabel?: string;
  /** 岗位别称，用于搜索与匹配 */
  aliases?: string[];
  /** 岗位描述 —— AI 生成面试内容的依据 */
  description?: string;
  skills: string[];
  enabled: boolean;
  source: "builtin" | "admin";
  /**
   * 离线追问链维度（来自 JSON 内容文件）。
   * 有它就能在没有 AI 密钥时给出人工整理过的追问链。
   */
  dimensions?: RoleDimension[];
  /**
   * 是否具备离线兜底内容。
   * 为 false 时，无 API Key 的环境下只能降级为按技能生成的通用追问。
   */
  hasOfflineContent: boolean;
  /** 仅 admin 岗位有：数据库主键 */
  id?: string;
}

const MAX_SKILLS = 20;
const MIN_DESCRIPTION = 20;
const MAX_DESCRIPTION = 2000;
const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;

/** 内置岗位 = data/roles/** 里的全部子类 */
function builtinRoles(): JobRole[] {
  return listRoleViews().map((view) => ({
    key: view.id,
    label: view.label,
    category: view.categoryLabel,
    categoryId: view.categoryId,
    categoryLabel: view.categoryLabel,
    aliases: view.aliases,
    description: view.description,
    skills: view.skills,
    enabled: true,
    source: "builtin" as const,
    dimensions: getRoleDimensions(view.id),
    hasOfflineContent: view.hasOfflineContent,
  }));
}

function rowToRole(row: typeof jobRoles.$inferSelect): JobRole {
  let skills: string[] = [];
  try {
    const parsed = JSON.parse(row.skills);
    if (Array.isArray(parsed)) skills = parsed.filter((s): s is string => typeof s === "string");
  } catch {
    skills = [];
  }

  return {
    key: row.key,
    label: row.label,
    category: row.category ?? undefined,
    categoryId: "custom",
    categoryLabel: "自定义岗位",
    description: row.description,
    skills,
    enabled: row.enabled,
    source: "admin",
    hasOfflineContent: false,
    id: row.id,
  };
}

async function adminRoles(includeDisabled: boolean): Promise<JobRole[]> {
  await ready();
  const rows = await db.select().from(jobRoles).orderBy(jobRoles.sortOrder, desc(jobRoles.createdAt));
  return rows
    .filter((row) => includeDisabled || row.enabled)
    .map(rowToRole);
}

/** 全部岗位：内置 + 管理员新增 */
export async function listJobRoles(options: { includeDisabled?: boolean } = {}): Promise<JobRole[]> {
  const includeDisabled = options.includeDisabled ?? false;
  const admin = await adminRoles(includeDisabled).catch((error) => {
    // 岗位表异常不应导致整个下拉不可用，退回只展示内置岗位
    console.error("[roles] 读取自定义岗位失败:", error);
    return [] as JobRole[];
  });

  const builtin = builtinRoles().filter((role) => includeDisabled || role.enabled);
  return [...admin, ...builtin];
}

/**
 * 旧的一级岗位 key → 新体系子类 id。
 *
 * 改造前岗位 key 是扁平的（backend / frontend / …），
 * 现在变成 `cs-it.backend`。历史链接与 `?role=` 预填仍可能带旧 key，
 * 这里做一次兼容映射，避免老链接失效。
 */
const LEGACY_KEY_MAP: Record<string, string> = {
  backend: "cs-it.backend",
  frontend: "cs-it.frontend",
  fullstack: "cs-it.fullstack",
  algorithm: "cs-it.algorithm",
  data: "cs-it.data-analysis",
  test: "cs-it.test-dev",
  ops: "cs-it.devops",
  product: "cs-it.product-manager",
};

/** 按 key / 中文标签 / 别称查找（内置与自定义都支持） */
export async function findJobRole(keyOrLabel?: string): Promise<JobRole | null> {
  if (!keyOrLabel) return null;
  const target = keyOrLabel.trim();
  if (!target) return null;

  const all = await listJobRoles({ includeDisabled: true });
  const normalized = LEGACY_KEY_MAP[target] ?? target;

  return (
    all.find((role) => role.key === normalized) ??
    all.find((role) => role.label === target) ??
    all.find((role) => role.aliases?.includes(target)) ??
    null
  );
}

/**
 * 两级分类视图：大类 → 子类。
 * 内置 64 个子类来自 JSON，管理员新增的挂在「自定义岗位」大类下。
 */
export async function listJobRoleCategories(): Promise<RoleCategoryView[]> {
  const admin = await adminRoles(false).catch((error) => {
    console.error("[roles] 读取自定义岗位失败:", error);
    return [] as JobRole[];
  });

  const customViews = admin.map((role) => ({
    id: role.key,
    categoryId: "custom",
    categoryLabel: "自定义岗位",
    label: role.label,
    aliases: [] as string[],
    skills: role.skills,
    description: role.description,
    completeness: "skeleton" as const,
    hasOfflineContent: false,
    isCustom: true,
  }));

  return listRoleCategoryViews(customViews);
}

// ==================== 校验 ====================

export interface JobRoleInput {
  label?: string;
  key?: string;
  category?: string;
  description?: string;
  skills?: unknown;
  sortOrder?: number;
}

function normalizeSkills(input: unknown): string[] {
  if (!Array.isArray(input)) {
    throw new RoleValidationError("技能要求需要是数组。");
  }
  const skills = input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  if (skills.length === 0) {
    throw new RoleValidationError("至少填写 1 项技能要求 —— AI 要据此生成面试内容。");
  }
  if (skills.length > MAX_SKILLS) {
    throw new RoleValidationError(`技能要求最多 ${MAX_SKILLS} 项。`);
  }
  for (const skill of skills) {
    if (skill.length > 30) {
      throw new RoleValidationError(`技能「${skill.slice(0, 10)}…」过长，请控制在 30 字以内。`);
    }
  }
  return [...new Set(skills)];
}

function normalizeLabel(input: unknown): string {
  const label = typeof input === "string" ? input.trim() : "";
  if (label.length < 2) throw new RoleValidationError("岗位名称至少 2 个字。");
  if (label.length > 30) throw new RoleValidationError("岗位名称最多 30 个字。");
  return label;
}

function normalizeDescription(input: unknown): string {
  const description = typeof input === "string" ? input.trim() : "";
  if (description.length < MIN_DESCRIPTION) {
    throw new RoleValidationError(
      `岗位描述至少 ${MIN_DESCRIPTION} 字。这段描述是 AI 生成面试内容的唯一依据，写得太短会导致 AI 瞎编。`
    );
  }
  if (description.length > MAX_DESCRIPTION) {
    throw new RoleValidationError(`岗位描述最多 ${MAX_DESCRIPTION} 字。`);
  }
  return description;
}

/** 生成稳定 key：优先用 ASCII 部分，中文标签则退回随机标识 */
function buildKey(label: string, provided?: string): string {
  const raw = (provided?.trim() || label).toLowerCase();
  const ascii = raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (KEY_PATTERN.test(ascii)) return ascii;
  return `custom-${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

// ==================== 写操作 ====================

export async function createJobRole(input: JobRoleInput): Promise<JobRole> {
  await ready();

  const label = normalizeLabel(input.label);
  const description = normalizeDescription(input.description);
  const skills = normalizeSkills(input.skills);
  let key = buildKey(label, input.key);

  const existing = await listJobRoles({ includeDisabled: true });

  if (existing.some((role) => role.label === label)) {
    throw new RoleValidationError(`已存在同名岗位「${label}」，请改用其他名称或直接编辑该岗位。`);
  }
  if (existing.some((role) => role.key === key)) {
    key = `${key}-${randomUUID().replace(/-/g, "").slice(0, 4)}`;
  }

  const now = new Date();
  const id = randomUUID();

  await db.insert(jobRoles).values({
    id,
    key,
    label,
    category: typeof input.category === "string" && input.category.trim() ? input.category.trim() : null,
    description,
    skills: JSON.stringify(skills),
    enabled: true,
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 100,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    key,
    label,
    category: input.category?.trim() || undefined,
    description,
    skills,
    enabled: true,
    source: "admin",
    hasOfflineContent: false,
  };
}

export async function updateJobRole(id: string, input: JobRoleInput): Promise<JobRole> {
  await ready();

  const rows = await db.select().from(jobRoles).where(eq(jobRoles.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new RoleValidationError("岗位不存在。");

  const label = input.label === undefined ? row.label : normalizeLabel(input.label);
  const description =
    input.description === undefined ? row.description : normalizeDescription(input.description);
  const skills = input.skills === undefined ? rowToRole(row).skills : normalizeSkills(input.skills);

  const all = await listJobRoles({ includeDisabled: true });
  if (all.some((role) => role.label === label && role.id !== id)) {
    throw new RoleValidationError(`已存在同名岗位「${label}」。`);
  }

  await db
    .update(jobRoles)
    .set({
      label,
      description,
      skills: JSON.stringify(skills),
      category:
        input.category === undefined
          ? row.category
          : input.category.trim() || null,
      sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : row.sortOrder,
      // key 不可修改：历史数据依赖它
      updatedAt: new Date(),
    })
    .where(eq(jobRoles.id, id));

  const updated = await db.select().from(jobRoles).where(eq(jobRoles.id, id)).limit(1);
  return rowToRole(updated[0]);
}

export async function setJobRoleEnabled(id: string, enabled: boolean): Promise<JobRole> {
  await ready();
  const rows = await db.select().from(jobRoles).where(eq(jobRoles.id, id)).limit(1);
  if (rows.length === 0) throw new RoleValidationError("岗位不存在。");

  await db.update(jobRoles).set({ enabled, updatedAt: new Date() }).where(eq(jobRoles.id, id));

  const updated = await db.select().from(jobRoles).where(eq(jobRoles.id, id)).limit(1);
  return rowToRole(updated[0]);
}

/** 岗位被引用时会拒绝删除，避免历史数据变成孤儿 */
export async function deleteJobRole(id: string): Promise<void> {
  await ready();
  const rows = await db.select().from(jobRoles).where(eq(jobRoles.id, id)).limit(1);
  if (rows.length === 0) throw new RoleValidationError("岗位不存在。");

  await db.delete(jobRoles).where(eq(jobRoles.id, id));
}
