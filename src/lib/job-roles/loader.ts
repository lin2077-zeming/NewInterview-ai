import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  RoleCategoryView,
  RoleContent,
  RoleDimension,
  RoleOptionView,
  RoleQuestion,
  Taxonomy,
} from "@/lib/job-roles/types";

/**
 * 岗位数据加载层 —— 岗位体系的**唯一数据源**。
 *
 * 改造前，岗位列表在 4 个文件里各存一份（config/question-chains.ts、lib/roles.ts、
 * lib/ai/resume-diagnosis.ts、app/api/career/analyze/route.ts），已经开始分叉：
 * 改一处必漏三处。现在所有岗位数据来自 `data/roles/**`，代码里不再有第二份。
 *
 * 读盘策略：首次访问时全量读入并缓存。数据是构建产物的一部分，
 * 运行期不会变（远程热更新走 I-31，届时提供 clearCache 重载）。
 */

const ROLES_DIR = join(process.cwd(), "data", "roles");

interface LoadedData {
  taxonomy: Taxonomy;
  /** `<categoryId>.<subId>` → 内容 */
  contents: Map<string, RoleContent>;
}

let cache: LoadedData | null = null;

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    console.error(`[job-roles] 读取失败 ${path}:`, error);
    return null;
  }
}

function load(): LoadedData {
  if (cache) return cache;

  const taxonomyPath = join(ROLES_DIR, "taxonomy.json");
  const taxonomy = readJson<Taxonomy>(taxonomyPath);
  if (!taxonomy) {
    console.error(`[job-roles] 未找到分类索引 ${taxonomyPath}，岗位列表将为空`);
    cache = { taxonomy: { version: 0, updatedAt: "", categories: [] }, contents: new Map() };
    return cache;
  }

  const contents = new Map<string, RoleContent>();

  for (const category of taxonomy.categories) {
    const dir = join(ROLES_DIR, category.id);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;

    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json") || file.startsWith("_")) continue;
      const content = readJson<RoleContent>(join(dir, file));
      if (!content) continue;
      contents.set(content.id, content);
    }
  }

  console.log(
    `[job-roles] 载入 ${taxonomy.categories.length} 个大类 / ${contents.size} 个子类`
  );

  cache = { taxonomy, contents };
  return cache;
}

/** 远程热更新后调用（I-31） */
export function clearRoleCache(): void {
  cache = null;
}

/**
 * 同步查岗位（只查 JSON 基线，不含管理员在后台新增的）。
 *
 * 存在的原因是有一部分遗留代码在同步上下文里需要岗位名
 * （如 `api/career/analyze` 的关键词缺口分析），拿不到 async 接口。
 * 新增代码请优先用 `lib/roles.ts` 的 `findJobRole()`（含自定义岗位）。
 */
export function findRoleSync(idOrLabelOrAlias?: string): RoleOptionView | undefined {
  if (!idOrLabelOrAlias) return undefined;
  const target = idOrLabelOrAlias.trim();
  if (!target) return undefined;

  const views = listRoleViews();
  return (
    views.find((v) => v.id === target) ??
    views.find((v) => v.label === target) ??
    views.find((v) => v.aliases.includes(target))
  );
}

// ==================== 读取接口 ====================

export function getTaxonomy(): Taxonomy {
  return load().taxonomy;
}

export function getRoleContent(id: string): RoleContent | undefined {
  return load().contents.get(id);
}

/** 子类的 4 维离线追问链；没有内容文件时返回 undefined */
export function getRoleDimensions(id: string): RoleDimension[] | undefined {
  const dims = getRoleContent(id)?.dimensions;
  return dims && dims.length > 0 ? dims : undefined;
}

/** 某个子类的题库；没有内容文件时返回空数组 */
export function getRoleQuestions(id: string): RoleQuestion[] {
  return getRoleContent(id)?.questions ?? [];
}

/**
 * 全部子类的题目，带上所属岗位。
 *
 * 面试排题要跨岗位检索（先按角色筛、再按阶段/难度/标签筛），
 * 所以这里返回的是「题目 + 它属于哪个岗位」的合并池。
 */
export function listAllRoleQuestions(): Array<RoleQuestion & { roleId: string }> {
  const { contents } = load();
  const out: Array<RoleQuestion & { roleId: string }> = [];
  for (const content of contents.values()) {
    for (const question of content.questions) {
      out.push({ ...question, roleId: content.id });
    }
  }
  return out;
}

/** 展平的岗位视图（含完全没内容文件的子类，便于前端提示"暂无内容"） */
export function listRoleViews(): RoleOptionView[] {
  return buildCategories().flatMap((category) => category.subcategories);
}

/**
 * 两级视图：大类 → 子类。
 * `extraRoles` 是管理员新增的岗位（数据库覆盖层），统一挂到「自定义岗位」大类下，
 * 避免 JSON 基线与 DB 覆盖层混在一起后无法区分。
 */
export function listRoleCategoryViews(extraRoles: RoleOptionView[] = []): RoleCategoryView[] {
  const views = buildCategories();

  if (extraRoles.length > 0) {
    views.push({
      id: "custom",
      label: "自定义岗位",
      summary: "管理员在后台录入的岗位，内容由 AI 按岗位描述实时生成",
      subcategories: extraRoles,
    });
  }

  return views;
}

/** 按 taxonomy 展开成两级结构；没有内容文件的子类也会列出（前端据此提示"暂无内容"） */
function buildCategories(): RoleCategoryView[] {
  const { taxonomy, contents } = load();

  return taxonomy.categories.map((category) => ({
    id: category.id,
    label: category.label,
    summary: category.summary,
    subcategories: category.subcategories.map((sub) => {
      const id = `${category.id}.${sub.id}`;
      const content = contents.get(id);
      return {
        id,
        categoryId: category.id,
        categoryLabel: category.label,
        label: content?.label ?? sub.label,
        aliases: content?.aliases ?? sub.aliases ?? [],
        skills: content?.skills ?? [],
        description: content?.description,
        completeness: content?.meta.completeness ?? ("skeleton" as const),
        hasOfflineContent: Boolean(
          content && (content.dimensions.length > 0 || content.questions.length > 0)
        ),
        isCustom: false,
      };
    }),
  }));
}
