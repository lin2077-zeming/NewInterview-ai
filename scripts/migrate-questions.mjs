#!/usr/bin/env node
/**
 * 存量题库迁移：把项目里已有的题目按岗位归位到新的两级体系。
 *
 * 用法：node --experimental-strip-types scripts/migrate-questions.mjs [--dry-run]
 *
 * 背景与事实（实测，不是推测）：
 * - `interview-questions-remote.json` 293 题，**全部** role = 「后端开发工程师」、stage 全是 algorithm
 * - `interview-questions.ts` 内置 63 题：27 algorithm / 15 project / 11 cross / 10 hr，
 *   其中 26 题标了后端岗，37 题无岗位标签但内容同样是 CS 向（三数之和、进程调度等）
 *
 * 所以存量题库**只会流向 cs-it.backend 一个子类** —— 非计算机岗位的内容
 * 无法靠迁移得到，必须新采（见 I-23 ~ I-25）。这一点必须如实说明，
 * 不能把「356 题」当成「覆盖 356 个岗位」来宣传。
 *
 * 脚本可重复执行：按题目 id 去重，已存在的不会重复写入。
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ROLES_DIR = join(ROOT, "data", "roles");
const REMOTE_BANK = join(ROOT, "src", "config", "interview-questions-remote.json");
const BUILTIN_BANK = join(ROOT, "src", "config", "interview-questions.ts");

const DRY_RUN = process.argv.includes("--dry-run");

/** 旧岗位标签 → 新体系子类 id */
const ROLE_ID_MAP = {
  后端开发工程师: "cs-it.backend",
  前端开发工程师: "cs-it.frontend",
  全栈开发工程师: "cs-it.fullstack",
  算法工程师: "cs-it.algorithm",
  数据分析师: "cs-it.data-analysis",
  测试开发工程师: "cs-it.test-dev",
  运维开发工程师: "cs-it.devops",
  产品经理: "cs-it.product-manager",
};

/**
 * 无岗位标签的题落到哪里。
 * 实测这 37 题是各公司算法/项目/HR 题（前缀 mt/hw/bd/ne 表示公司），
 * 内容仍是 CS 后端向 —— 归入 backend，但来源标注要如实写明是项目内置题。
 */
const DEFAULT_ROLE_ID = "cs-it.backend";

const SOURCE_REMOTE = {
  type: "public-bank",
  name: "力扣（LeetCode）高频题",
  url: "https://leetcode.cn/problemset/",
  collectedAt: "2026-10-11",
};
const SOURCE_BUILTIN = {
  type: "project-authored",
  name: "项目内置题（原仓库自带）",
  collectedAt: "2026-10-11",
};

// ==================== 读取题库 ====================

const remote = JSON.parse(readFileSync(REMOTE_BANK, "utf8"));
const builtinMod = await import(`file:///${BUILTIN_BANK.replace(/\\/g, "/")}`);
const builtin = builtinMod.INTERVIEW_QUESTIONS;

console.log(`读到题库：remote ${remote.length} 题 + 内置 ${builtin.length} 题`);

// ==================== 归位 ====================

/** roleId → 该子类的题目数组 */
const buckets = new Map();
const unmapped = [];

function addQuestion(raw, source, origin) {
  const roleId = raw.role ? ROLE_ID_MAP[raw.role] : DEFAULT_ROLE_ID;
  if (!roleId) {
    unmapped.push({ id: raw.id, role: raw.role, origin });
    return;
  }
  const entry = {
    id: raw.id,
    stage: raw.stage,
    difficulty: raw.difficulty,
    title: raw.title,
    content: raw.content,
    tags: raw.tags ?? [],
    ...(raw.company ? { company: raw.company } : {}),
    source,
  };
  if (!buckets.has(roleId)) buckets.set(roleId, []);
  buckets.get(roleId).push(entry);
}

for (const q of remote) addQuestion(q, SOURCE_REMOTE, "remote");
for (const q of builtin) addQuestion(q, SOURCE_BUILTIN, "builtin");

// 同一批次内按 id 去重（两个题库理论上不重名，但仍要防）
for (const [roleId, list] of buckets) {
  const seen = new Set();
  const deduped = [];
  for (const q of list) {
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    deduped.push(q);
  }
  buckets.set(roleId, deduped);
}

// ==================== 写回子类文件 ====================

let totalWritten = 0;
let totalSkipped = 0;

for (const [roleId, incoming] of buckets) {
  const [categoryId, subId] = roleId.split(".");
  const filePath = join(ROLES_DIR, categoryId, `${subId}.json`);

  if (!existsSync(filePath)) {
    console.log(`  ⚠ ${roleId}：还没有内容文件（${filePath}），${incoming.length} 题暂存未写入`);
    continue;
  }

  const content = JSON.parse(readFileSync(filePath, "utf8"));
  const existing = content.questions ?? [];
  const existingIds = new Set(existing.map((q) => q.id));

  const added = incoming.filter((q) => !existingIds.has(q.id));
  const skipped = incoming.length - added.length;

  content.questions = [...existing, ...added];
  content.meta = {
    ...content.meta,
    version: (content.meta?.version ?? 1) + 1,
    updatedAt: new Date().toISOString().slice(0, 10),
  };

  // 内容齐备则升级为 full
  const isFull =
    content.questions.length > 0 &&
    (content.companies ?? []).length > 0 &&
    (content.interviewReports ?? []).length > 0 &&
    (content.dimensions ?? []).length === 4;
  content.meta.completeness = isFull ? "full" : "skeleton";

  if (DRY_RUN) {
    console.log(`  [dry-run] ${roleId}：新增 ${added.length} 题、跳过 ${skipped} 题（已有）`);
  } else {
    writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
    console.log(
      `  ✓ ${roleId}：新增 ${added.length} 题、跳过 ${skipped} 题 → 共 ${content.questions.length} 题，完档次 ${content.meta.completeness}`
    );
  }

  totalWritten += added.length;
  totalSkipped += skipped;
}

if (unmapped.length > 0) {
  console.log(`\n⚠ ${unmapped.length} 题无法归位（岗位标签未映射）：`);
  for (const u of unmapped.slice(0, 10)) console.log(`  - ${u.id} role=${u.role} (${u.origin})`);
}

console.log(`\n合计：写入 ${totalWritten} 题、跳过 ${totalSkipped} 题（已存在）`);
console.log(
  "注意：存量题库全部是计算机/后端向，非计算机岗位内容必须新采 —— 不要把题量当成岗位覆盖度。"
);
