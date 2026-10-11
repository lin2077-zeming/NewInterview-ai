#!/usr/bin/env node
/**
 * 岗位数据校验。
 *
 * 用法：node scripts/validate-roles.mjs [--strict]
 *
 * 为什么需要它：岗位内容会持续更新（还会远程热更），
 * 靠人自觉守格式必然出错。这个脚本是唯一的守门员：
 *
 * 1. **结构**：id 规范、大类/子类必须在 taxonomy.json 里登记
 * 2. **来源**：每条题目 / 公司 / 面经都必须带 source ——
 *    赛事要求「使用外部数据须说明来源」，无源内容不得入库；
 *    AI 生成的必须标 ai-generated，不得冒充真实面经
 * 3. **完整性**：completeness=full 的子类必须真的填了题目/公司/面经
 *
 * 不加 --strict 时，骨架档（completeness=skeleton）允许题目为空。
 * 加 --strict 则要求所有子类都达到 full（提交前的最终检查用）。
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, basename } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ROLES_DIR = join(ROOT, "data", "roles");
const TAXONOMY_PATH = join(ROLES_DIR, "taxonomy.json");

const STRICT = process.argv.includes("--strict");
const MIN_DESCRIPTION = 20;
const MAX_SKILLS = 20;
const REQUIRED_DIMENSIONS = 4;
const VALID_COMPLETENESS = new Set(["full", "skeleton"]);
const VALID_SOURCE_TYPES = new Set([
  "public-bank",
  "company-jd",
  "official",
  "public-post",
  "project-authored",
  "ai-generated",
]);

/** 必须给出可核验链接的来源类型 —— 外部采集的内容要经得起追问 */
const SOURCE_TYPES_REQUIRING_URL = new Set([
  "public-bank",
  "company-jd",
  "official",
  "public-post",
]);

const errors = [];
const warnings = [];

function err(file, msg) {
  errors.push(`${file}: ${msg}`);
}
function warn(file, msg) {
  warnings.push(`${file}: ${msg}`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    err(basename(path), `JSON 解析失败：${e.message}`);
    return null;
  }
}

// ==================== 1. taxonomy.json ====================

if (!existsSync(TAXONOMY_PATH)) {
  console.error(`✗ 找不到分类索引：${TAXONOMY_PATH}`);
  process.exit(1);
}

const taxonomy = readJson(TAXONOMY_PATH);
if (!taxonomy) process.exit(1);

const categoryIds = new Set();
/** `${categoryId}.${subId}` → 元信息 */
const declaredRoles = new Map();

if (!Array.isArray(taxonomy.categories) || taxonomy.categories.length === 0) {
  err("taxonomy.json", "categories 必须是非空数组");
} else {
  for (const cat of taxonomy.categories) {
    if (!cat.id) {
      err("taxonomy.json", "存在缺少 id 的大类");
      continue;
    }
    if (categoryIds.has(cat.id)) err("taxonomy.json", `大类 id 重复：${cat.id}`);
    categoryIds.add(cat.id);

    if (!cat.label) err("taxonomy.json", `大类 ${cat.id} 缺少 label`);
    if (!Array.isArray(cat.subcategories) || cat.subcategories.length === 0) {
      err("taxonomy.json", `大类 ${cat.id} 没有子类`);
      continue;
    }

    const subIds = new Set();
    for (const sub of cat.subcategories) {
      if (!sub.id) {
        err("taxonomy.json", `大类 ${cat.id} 存在缺少 id 的子类`);
        continue;
      }
      if (subIds.has(sub.id)) err("taxonomy.json", `大类 ${cat.id} 子类 id 重复：${sub.id}`);
      subIds.add(sub.id);

      const fullId = `${cat.id}.${sub.id}`;
      if (declaredRoles.has(fullId)) err("taxonomy.json", `子类全 id 重复：${fullId}`);
      declaredRoles.set(fullId, { categoryId: cat.id, sub });
    }
  }
}

// ==================== 2. 每个子类内容文件 ====================

function checkSource(file, where, source) {
  if (!source || typeof source !== "object") {
    err(file, `${where} 缺少 source —— 无来源的内容不得入库`);
    return;
  }
  if (!VALID_SOURCE_TYPES.has(source.type)) {
    err(file, `${where} 的 source.type 非法：${source.type}`);
  }
  if (!source.name) err(file, `${where} 的 source.name 为空`);
  // 外部采集的来源必须可核验；项目自建与 AI 生成没有外部链接，不强制
  if (SOURCE_TYPES_REQUIRING_URL.has(source.type) && !source.url) {
    err(file, `${where} 的 source 缺少 url（${source.type} 必须可核验）`);
  }
}

function checkSources(file) {
  const content = file;
  for (const [i, q] of (content.questions ?? []).entries()) {
    if (!q.id) err(file.id, `questions[${i}] 缺少 id`);
    if (!q.title) err(file.id, `questions[${i}] 缺少 title`);
    checkSource(file.id, `questions[${i}](${q.title ?? "?"})`, q.source);
  }
  for (const [i, c] of (content.companies ?? []).entries()) {
    if (!c.name) err(file.id, `companies[${i}] 缺少 name`);
    checkSource(file.id, `companies[${i}](${c.name ?? "?"})`, c.source);
  }
  for (const [i, r] of (content.interviewReports ?? []).entries()) {
    checkSource(file.id, `interviewReports[${i}]`, r.source);
    if (r.source?.type === "ai-generated") {
      warn(file.id, `interviewReports[${i}] 是 AI 生成内容，不得作为真实面经展示`);
    }
  }
}

let fullCount = 0;
let skeletonCount = 0;
const foundRoles = new Set();
const questionIds = new Map();

if (!existsSync(ROLES_DIR)) {
  console.error(`✗ 找不到岗位数据目录：${ROLES_DIR}`);
  process.exit(1);
}

for (const entry of readdirSync(ROLES_DIR)) {
  const catDir = join(ROLES_DIR, entry);
  if (!statSync(catDir).isDirectory()) continue;
  if (!categoryIds.has(entry)) {
    err(entry, `目录名不是已登记的大类 id —— 请在 taxonomy.json 中先登记`);
    continue;
  }

  for (const f of readdirSync(catDir)) {
    if (!f.endsWith(".json") || f.startsWith("_")) continue;

    const subId = f.replace(/\.json$/, "");
    const fullId = `${entry}.${subId}`;
    const content = readJson(join(catDir, f));
    if (!content) continue;

    // ---- 标识一致性 ----
    if (content.id !== fullId) {
      err(fullId, `id 字段（${content.id}）与文件名推断值（${fullId}）不一致`);
    }
    if (content.categoryId !== entry) {
      err(fullId, `categoryId（${content.categoryId}）与所在目录（${entry}）不一致`);
    }
    if (!declaredRoles.has(fullId)) {
      err(fullId, `未在 taxonomy.json 中登记 —— 前台选择器不会出现这个子类`);
    }
    if (foundRoles.has(fullId)) err(fullId, `子类重复定义`);
    foundRoles.add(fullId);

    // ---- 基本字段 ----
    if (!content.label) err(fullId, "缺少 label");
    if (!content.summary) err(fullId, "缺少 summary");
    if (typeof content.description !== "string" || content.description.trim().length < MIN_DESCRIPTION) {
      err(fullId, `description 至少 ${MIN_DESCRIPTION} 字（当前 ${content.description?.trim().length ?? 0}）`);
    }

    const skills = content.skills ?? [];
    if (!Array.isArray(skills) || skills.length === 0) {
      err(fullId, "skills 不能为空");
    } else {
      if (skills.length > MAX_SKILLS) err(fullId, `skills 最多 ${MAX_SKILLS} 项`);
      for (const s of skills) {
        if (typeof s !== "string" || s.length > 30) err(fullId, `技能项过长或非字符串：${s}`);
      }
    }

    // ---- 维度 ----
    const dims = content.dimensions ?? [];
    if (!Array.isArray(dims)) {
      err(fullId, "dimensions 必须是数组");
    } else if (dims.length !== 0 && dims.length !== REQUIRED_DIMENSIONS) {
      err(fullId, `dimensions 要么为空（骨架档），要么恰好 ${REQUIRED_DIMENSIONS} 个（当前 ${dims.length}）`);
    } else {
      for (const [i, d] of dims.entries()) {
        if (!d.name) err(fullId, `dimensions[${i}] 缺少 name`);
        if (!["高", "中", "低"].includes(d.weight)) {
          err(fullId, `dimensions[${i}] 的 weight 必须是 高/中/低`);
        }
        if (!Array.isArray(d.probes) || d.probes.length !== 3) {
          err(fullId, `dimensions[${i}] 必须恰好 3 条 probes`);
        } else {
          for (const [j, p] of d.probes.entries()) {
            if (!p.q || !p.bar || !p.red) {
              err(fullId, `dimensions[${i}].probes[${j}] 的 q/bar/red 均不可为空`);
            }
          }
        }
      }
    }

    // ---- 来源 ----
    checkSources(content);

    // ---- 题目 id 全局唯一 ----
    for (const q of content.questions ?? []) {
      if (!q.id) continue;
      if (questionIds.has(q.id)) {
        err(fullId, `题目 id「${q.id}」与 ${questionIds.get(q.id)} 重复`);
      } else {
        questionIds.set(q.id, fullId);
      }
    }

    // ---- meta 与完整性 ----
    const meta = content.meta ?? {};
    if (!Number.isFinite(meta.version) || meta.version < 1) err(fullId, "meta.version 必须是正整数");
    if (!meta.updatedAt) err(fullId, "meta.updatedAt 缺失");
    if (!VALID_COMPLETENESS.has(meta.completeness)) {
      err(fullId, `meta.completeness 必须是 full 或 skeleton`);
    }

    const hasQuestions = (content.questions ?? []).length > 0;
    const hasCompanies = (content.companies ?? []).length > 0;
    const hasReports = (content.interviewReports ?? []).length > 0;

    if (meta.completeness === "full") {
      fullCount++;
      const missing = [];
      if (!hasQuestions) missing.push("questions");
      if (!hasCompanies) missing.push("companies");
      if (!hasReports) missing.push("interviewReports");
      if (dims.length !== REQUIRED_DIMENSIONS) missing.push("dimensions(4)");
      if (missing.length) {
        err(fullId, `标注为 full 但缺少：${missing.join(" / ")}`);
      }
    } else if (meta.completeness === "skeleton") {
      skeletonCount++;
      if (STRICT) err(fullId, `--strict 模式下不允许 skeleton 档（仍是骨架）`);
      if (dims.length === 0) {
        warn(fullId, "骨架档也没有 dimensions —— AI 路径下该岗位将没有可用内容");
      }
    }
  }
}

// ==================== 3. 反向检查：登记了但没实现的子类 ====================

const missingFiles = [];
for (const fullId of declaredRoles.keys()) {
  if (!foundRoles.has(fullId)) missingFiles.push(fullId);
}

// ==================== 输出 ====================

const totalDeclared = declaredRoles.size;
console.log("岗位数据校验");
console.log("─".repeat(48));
console.log(`  已登记子类 : ${totalDeclared}`);
console.log(`  已实现内容 : ${foundRoles.size}  （full ${fullCount} / skeleton ${skeletonCount}）`);
console.log(`  题目总数   : ${questionIds.size}`);
if (missingFiles.length > 0) {
  console.log(`  未实现     : ${missingFiles.length} 个子类（前台会显示为「暂无内容」）`);
}

if (warnings.length > 0) {
  console.log(`\n⚠ 警告 ${warnings.length} 条：`);
  for (const w of warnings.slice(0, 20)) console.log(`  - ${w}`);
  if (warnings.length > 20) console.log(`  ... 另有 ${warnings.length - 20} 条`);
}

if (errors.length > 0) {
  console.log(`\n✗ 错误 ${errors.length} 条：`);
  for (const e of errors.slice(0, 40)) console.log(`  - ${e}`);
  if (errors.length > 40) console.log(`  ... 另有 ${errors.length - 40} 条`);
  process.exit(1);
}

console.log("\n✓ 校验通过");
