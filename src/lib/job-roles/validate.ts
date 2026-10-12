/**
 * 岗位数据校验规则。
 *
 * **这是唯一的一套规则**，同时被两处使用：
 * 1. `scripts/validate-roles.mjs`（提交前检查磁盘上的文件）
 * 2. 运行时加载层（校验远程热更新的数据包）
 *
 * 之所以抽成共享模块而不是各写一份：两处规则一旦分叉，就会出现
 * 「本地校验通过、远程包校验不通过」或者更糟的「远程包混进来却没被拦住」。
 * 校验这种事，宁可只维护一份。
 *
 * 本模块**不依赖 node:fs**，保持纯函数，因此浏览器/Edge 运行时也能用。
 */

export const LIMITS = {
  MIN_DESCRIPTION: 20,
  MAX_SKILLS: 20,
  MAX_SKILL_LENGTH: 30,
  REQUIRED_DIMENSIONS: 4,
} as const;

export const VALID_SOURCE_TYPES = new Set([
  "public-bank",
  "company-jd",
  "official",
  "public-post",
  "project-authored",
  "ai-generated",
]);

/** 必须给出可核验链接的来源类型 —— 外部采集的内容要经得起追问 */
export const SOURCE_TYPES_REQUIRING_URL = new Set([
  "public-bank",
  "company-jd",
  "official",
  "public-post",
]);

const VALID_COMPLETENESS = new Set(["full", "skeleton"]);

export interface ValidationIssue {
  level: "error" | "warning";
  where: string;
  message: string;
}

export interface RoleDataStats {
  declaredSubcategories: number;
  implementedSubcategories: number;
  fullCount: number;
  skeletonCount: number;
  questionCount: number;
  /** 在 taxonomy 里登记了、但没有内容文件的子类 */
  missingSubcategories: string[];
}

export interface ValidationOutcome {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  stats: RoleDataStats;
  /** 无 error 即可安全使用 */
  ok: boolean;
}

/** taxonomy 里登记的子类：`<categoryId>.<subId>` → 声明信息 */
export type DeclaredRoles = Map<string, { categoryId: string; subId: string }>;

export interface ContentEntry {
  /** 期望的完整 id（CLI 从文件名推断；远程包从 contents 的 key 推断） */
  expectedId?: string;
  /** 期望的大类 id */
  expectedCategoryId?: string;
  data: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// ==================== taxonomy ====================

export function validateTaxonomy(taxonomy: unknown): {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  declared: DeclaredRoles;
} {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const declared: DeclaredRoles = new Map();

  const err = (message: string) => errors.push({ level: "error", where: "taxonomy", message });

  if (!isRecord(taxonomy)) {
    err("taxonomy 必须是对象");
    return { errors, warnings, declared };
  }
  if (!Array.isArray(taxonomy.categories) || taxonomy.categories.length === 0) {
    err("categories 必须是非空数组");
    return { errors, warnings, declared };
  }

  const categoryIds = new Set<string>();
  for (const rawCategory of taxonomy.categories) {
    if (!isRecord(rawCategory)) {
      err("存在非法的大类项（不是对象）");
      continue;
    }
    const categoryId = typeof rawCategory.id === "string" ? rawCategory.id : "";
    if (!categoryId) {
      err("存在缺少 id 的大类");
      continue;
    }
    if (categoryIds.has(categoryId)) err(`大类 id 重复：${categoryId}`);
    categoryIds.add(categoryId);

    if (typeof rawCategory.label !== "string" || !rawCategory.label) {
      err(`大类 ${categoryId} 缺少 label`);
    }
    if (!Array.isArray(rawCategory.subcategories) || rawCategory.subcategories.length === 0) {
      err(`大类 ${categoryId} 没有子类`);
      continue;
    }

    const subIds = new Set<string>();
    for (const rawSub of rawCategory.subcategories) {
      if (!isRecord(rawSub)) {
        err(`大类 ${categoryId} 存在非法的子类项`);
        continue;
      }
      const subId = typeof rawSub.id === "string" ? rawSub.id : "";
      if (!subId) {
        err(`大类 ${categoryId} 存在缺少 id 的子类`);
        continue;
      }
      if (subIds.has(subId)) err(`大类 ${categoryId} 子类 id 重复：${subId}`);
      subIds.add(subId);

      const fullId = `${categoryId}.${subId}`;
      if (declared.has(fullId)) err(`子类全 id 重复：${fullId}`);
      declared.set(fullId, { categoryId, subId });
    }
  }

  return { errors, warnings, declared };
}

// ==================== 子类内容 ====================

export function validateRoleContent(
  entry: ContentEntry,
  declared: DeclaredRoles,
  seen: { ids: Set<string>; questionIds: Map<string, string> }
): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const data = entry.data;
  const fallbackWhere = entry.expectedId ?? "(未知)";
  const err = (message: string, where = fallbackWhere) =>
    errors.push({ level: "error", where, message });
  const warn = (message: string, where = fallbackWhere) =>
    warnings.push({ level: "warning", where, message });

  if (!isRecord(data)) {
    err("内容不是对象");
    return { errors, warnings };
  }

  const id = typeof data.id === "string" ? data.id : "";
  const categoryId = typeof data.categoryId === "string" ? data.categoryId : "";

  if (entry.expectedId && id !== entry.expectedId) {
    err(`id 字段（${id || "空"}）与期望值（${entry.expectedId}）不一致`, entry.expectedId);
  }
  if (entry.expectedCategoryId && categoryId !== entry.expectedCategoryId) {
    err(`categoryId（${categoryId || "空"}）与期望值（${entry.expectedCategoryId}）不一致`);
  }
  if (!id) err("缺少 id");

  const where = id || fallbackWhere;
  const inDeclared = declared.has(id);
  if (!inDeclared) {
    err("未在 taxonomy 中登记 —— 前台选择器不会出现这个子类", where);
  }
  if (seen.ids.has(id)) err("子类重复定义", where);
  seen.ids.add(id);

  // ---- 基本字段 ----
  const label = typeof data.label === "string" ? data.label : "";
  const summary = typeof data.summary === "string" ? data.summary : "";
  const description = typeof data.description === "string" ? data.description : "";
  if (!label) err("缺少 label", where);
  if (!summary) err("缺少 summary", where);
  if (description.trim().length < LIMITS.MIN_DESCRIPTION) {
    err(`description 至少 ${LIMITS.MIN_DESCRIPTION} 字（当前 ${description.trim().length}）`, where);
  }

  const skills = Array.isArray(data.skills) ? data.skills : [];
  if (skills.length === 0) {
    err("skills 不能为空", where);
  } else if (skills.length > LIMITS.MAX_SKILLS) {
    err(`skills 最多 ${LIMITS.MAX_SKILLS} 项`, where);
  } else {
    for (const skill of skills) {
      if (typeof skill !== "string" || skill.length > LIMITS.MAX_SKILL_LENGTH) {
        err(`技能项过长或非字符串：${String(skill).slice(0, 20)}`, where);
      }
    }
  }

  // ---- 维度 ----
  const dimensions = Array.isArray(data.dimensions) ? data.dimensions : [];
  if (!Array.isArray(data.dimensions)) {
    err("dimensions 必须是数组", where);
  } else if (dimensions.length !== 0 && dimensions.length !== LIMITS.REQUIRED_DIMENSIONS) {
    err(
      `dimensions 要么为空（骨架档），要么恰好 ${LIMITS.REQUIRED_DIMENSIONS} 个（当前 ${dimensions.length}）`,
      where
    );
  } else {
    dimensions.forEach((rawDim, i) => {
      if (!isRecord(rawDim)) {
        err(`dimensions[${i}] 不是对象`, where);
        return;
      }
      if (typeof rawDim.name !== "string" || !rawDim.name) err(`dimensions[${i}] 缺少 name`, where);
      if (!["高", "中", "低"].includes(String(rawDim.weight))) {
        err(`dimensions[${i}] 的 weight 必须是 高/中/低`, where);
      }
      const probes = Array.isArray(rawDim.probes) ? rawDim.probes : [];
      if (probes.length !== 3) {
        err(`dimensions[${i}] 必须恰好 3 条 probes`, where);
      } else {
        probes.forEach((rawProbe, j) => {
          if (!isRecord(rawProbe) || !rawProbe.q || !rawProbe.bar || !rawProbe.red) {
            err(`dimensions[${i}].probes[${j}] 的 q/bar/red 均不可为空`, where);
          }
        });
      }
    });
  }

  // ---- 来源 ----
  const checkSource = (where2: string, source: unknown) => {
    if (!isRecord(source)) {
      err(`${where2} 缺少 source —— 无来源的内容不得入库`, where);
      return;
    }
    const type = String(source.type);
    if (!VALID_SOURCE_TYPES.has(type)) {
      err(`${where2} 的 source.type 非法：${type}`, where);
    }
    if (typeof source.name !== "string" || !source.name) {
      err(`${where2} 的 source.name 为空`, where);
    }
    // 外部采集的来源必须可核验；项目自建与 AI 生成没有外部链接，不强制
    if (SOURCE_TYPES_REQUIRING_URL.has(type) && !source.url) {
      err(`${where2} 的 source 缺少 url（${type} 必须可核验）`, where);
    }
  };

  const questions = Array.isArray(data.questions) ? data.questions : [];
  questions.forEach((raw, i) => {
    if (!isRecord(raw)) {
      err(`questions[${i}] 不是对象`, where);
      return;
    }
    if (!raw.id) err(`questions[${i}] 缺少 id`, where);
    if (!raw.title) err(`questions[${i}] 缺少 title`, where);
    checkSource(`questions[${i}](${String(raw.title ?? "?")})`, raw.source);

    const qid = String(raw.id ?? "");
    if (qid) {
      if (seen.questionIds.has(qid)) {
        err(`题目 id「${qid}」与 ${seen.questionIds.get(qid)} 重复`, where);
      } else {
        seen.questionIds.set(qid, where);
      }
    }
  });

  const companies = Array.isArray(data.companies) ? data.companies : [];
  companies.forEach((raw, i) => {
    if (!isRecord(raw)) {
      err(`companies[${i}] 不是对象`, where);
      return;
    }
    if (!raw.name) err(`companies[${i}] 缺少 name`, where);
    checkSource(`companies[${i}](${String(raw.name ?? "?")})`, raw.source);
  });

  const reports = Array.isArray(data.interviewReports) ? data.interviewReports : [];
  reports.forEach((raw, i) => {
    if (!isRecord(raw)) {
      err(`interviewReports[${i}] 不是对象`, where);
      return;
    }
    checkSource(`interviewReports[${i}]`, raw.source);
    // AI 生成的内容必须自我披露：来源名里要出现「AI」字样。
    // 把 AI 汇总的考察点包装成"真实面经"是诚信问题。
    const source = isRecord(raw.source) ? raw.source : {};
    if (source.type === "ai-generated" && !/AI/i.test(String(source.name ?? ""))) {
      err(
        `interviewReports[${i}] 是 AI 生成但来源名未披露（source.name 需含「AI」，当前「${String(source.name ?? "")}」）`,
        where
      );
    }
  });

  // ---- meta 与完整性 ----
  const meta = isRecord(data.meta) ? data.meta : {};
  const version = Number(meta.version);
  if (!Number.isFinite(version) || version < 1) err("meta.version 必须是正整数", where);
  if (!meta.updatedAt) err("meta.updatedAt 缺失", where);
  const completeness = String(meta.completeness ?? "");
  if (!VALID_COMPLETENESS.has(completeness)) {
    err("meta.completeness 必须是 full 或 skeleton", where);
  }

  if (completeness === "full") {
    const missing: string[] = [];
    if (questions.length === 0) missing.push("questions");
    if (companies.length === 0) missing.push("companies");
    if (reports.length === 0) missing.push("interviewReports");
    if (dimensions.length !== LIMITS.REQUIRED_DIMENSIONS) {
      missing.push(`dimensions(${LIMITS.REQUIRED_DIMENSIONS})`);
    }
    if (missing.length > 0) err(`标注为 full 但缺少：${missing.join(" / ")}`, where);
  } else if (completeness === "skeleton" && dimensions.length === 0) {
    warn("骨架档也没有 dimensions —— AI 路径下该岗位将没有可用内容", where);
  }

  return { errors, warnings };
}

// ==================== 汇总 ====================

export function validateRoleData(
  taxonomy: unknown,
  contents: ContentEntry[],
  options: { strict?: boolean } = {}
): ValidationOutcome {
  const taxonomyResult = validateTaxonomy(taxonomy);
  const errors = [...taxonomyResult.errors];
  const warnings = [...taxonomyResult.warnings];
  const declared = taxonomyResult.declared;

  const seen = { ids: new Set<string>(), questionIds: new Map<string, string>() };
  let fullCount = 0;
  let skeletonCount = 0;

  for (const entry of contents) {
    const result = validateRoleContent(entry, declared, seen);
    errors.push(...result.errors);
    warnings.push(...result.warnings);

    if (isRecord(entry.data)) {
      const meta = isRecord(entry.data.meta) ? entry.data.meta : {};
      if (meta.completeness === "full") fullCount++;
      else if (meta.completeness === "skeleton") {
        skeletonCount++;
        if (options.strict) {
          errors.push({
            level: "error",
            where: String(entry.data.id ?? entry.expectedId ?? "?"),
            message: "--strict 模式下不允许 skeleton 档（仍是骨架）",
          });
        }
      }
    }
  }

  const missingSubcategories = [...declared.keys()].filter((id) => !seen.ids.has(id));

  return {
    errors,
    warnings,
    ok: errors.length === 0,
    stats: {
      declaredSubcategories: declared.size,
      implementedSubcategories: seen.ids.size,
      fullCount,
      skeletonCount,
      questionCount: seen.questionIds.size,
      missingSubcategories,
    },
  };
}
