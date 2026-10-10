import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { jobRoles } from "@/lib/db/schema";
import { ROLE_DIMENSIONS, ROLE_LABELS } from "@/config/question-chains";
import { RoleValidationError } from "@/lib/errors";

/**
 * 岗位数据访问。
 *
 * 两级来源：
 * - `builtin`：代码里已有的 8 个岗位（含手写的追问链与技能要求），保持现状不动
 * - `admin`  ：管理员通过管理端新增的岗位，只存元信息（描述 + 技能要求），
 *              面试内容由 AI 按描述实时生成
 *
 * 对外统一成 `JobRole`，调用方不需要关心来源。
 */

export interface JobRole {
  key: string;
  label: string;
  category?: string;
  /** 岗位描述 —— AI 生成面试内容的依据（内置岗位暂无，用 label 兜底） */
  description?: string;
  skills: string[];
  enabled: boolean;
  source: "builtin" | "admin";
  /**
   * 是否具备离线兜底内容（手写追问链）。
   * 为 false 时，无 API Key 的环境下只能降级为按技能生成的通用追问。
   */
  hasOfflineContent: boolean;
  /** 仅 admin 岗位有：数据库主键 */
  id?: string;
}

/** 内置岗位的技能要求（描述由 label 兜底） */
const BUILTIN_SKILLS: Record<string, string[]> = {
  backend: ["编程基础", "数据结构与算法", "数据库与索引", "缓存", "并发", "系统设计"],
  frontend: ["JavaScript / TypeScript", "框架原理", "工程化", "性能优化", "浏览器机制"],
  fullstack: ["前后端打通", "接口设计", "数据库", "部署与运维", "工程化"],
  algorithm: ["机器学习基础", "特征工程", "实验设计与评估", "模型工程落地"],
  data: ["SQL", "指标体系", "统计分析", "AB 实验", "业务归因"],
  test: ["测试策略", "用例设计", "自动化测试", "缺陷定位", "性能测试"],
  ops: ["Linux 与网络", "CI/CD", "监控告警", "故障排查", "容器与云原生"],
  product: ["需求洞察", "优先级判断", "方案设计", "数据分析", "跨团队协作"],
};

const BUILTIN_CATEGORY: Record<string, string> = {
  backend: "技术",
  frontend: "技术",
  fullstack: "技术",
  algorithm: "技术",
  data: "数据",
  test: "技术",
  ops: "技术",
  product: "产品",
};

const MAX_SKILLS = 20;
const MIN_DESCRIPTION = 20;
const MAX_DESCRIPTION = 2000;
const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;

function builtinRoles(): JobRole[] {
  return Object.entries(ROLE_LABELS).map(([key, label]) => ({
    key,
    label,
    category: BUILTIN_CATEGORY[key],
    skills: BUILTIN_SKILLS[key] ?? [],
    enabled: true,
    source: "builtin" as const,
    hasOfflineContent: Boolean(ROLE_DIMENSIONS[key]),
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

/** 按 key 或中文标签查找（内置与自定义都支持） */
export async function findJobRole(keyOrLabel?: string): Promise<JobRole | null> {
  if (!keyOrLabel) return null;
  const target = keyOrLabel.trim();
  if (!target) return null;

  const all = await listJobRoles({ includeDisabled: true });
  return (
    all.find((role) => role.key === target) ??
    all.find((role) => role.label === target) ??
    null
  );
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
