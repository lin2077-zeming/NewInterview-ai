/**
 * 把「逐字引用的公开面试真题」合入各岗位题库。
 *
 * 与 `expand-role-questions.mjs` 的分工：
 * - 那个脚本用 AI **扩写**题目，来源标 `ai-generated`
 * - 本脚本合入的是**网络调研中逐字引用**的真实题目，来源标 `public-post` 并带 URL
 *
 * 幂等：同一「标题 + 来源链接」已存在则跳过，可反复运行。
 *
 * 数据源：`data/reference/public-interview-questions.json`
 *
 * 用法：
 *   node scripts/merge-public-questions.mjs
 *   node scripts/merge-public-questions.mjs --dry-run
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ROLES_DIR = join(ROOT, "data", "roles");
const SOURCE_FILE = join(ROOT, "data", "reference", "public-interview-questions.json");
const DRY_RUN = process.argv.includes("--dry-run");

const payload = JSON.parse(readFileSync(SOURCE_FILE, "utf8"));
const entries = payload["题目"] ?? [];

console.log(`公开真题共 ${entries.length} 条，覆盖 ${new Set(entries.flatMap((e) => e.roles)).size} 个岗位\n`);

let inserted = 0;
let skipped = 0;
let missingRoles = [];

for (const entry of entries) {
  for (const roleId of entry.roles) {
    const [category, sub] = roleId.split(".");
    const path = join(ROLES_DIR, category, `${sub}.json`);
    if (!existsSync(path)) {
      missingRoles.push(roleId);
      continue;
    }

    const role = JSON.parse(readFileSync(path, "utf8"));
    const questions = role.questions ?? [];

    // 去重：标题 + 来源链接都相同才算重复
    const dup = questions.some(
      (q) =>
        q.title === entry.title &&
        q.source &&
        typeof q.source === "object" &&
        q.source.url === entry.source.url
    );
    if (dup) {
      skipped += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry] ${role.label} ← ${entry.title}`);
      inserted += 1;
      continue;
    }

    const nextIndex = questions.length + 1;
    questions.push({
      id: `${roleId}-q${String(nextIndex).padStart(3, "0")}`,
      stage: entry.stage,
      difficulty: entry.difficulty,
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      // 逐字引用 —— 必须带可核验链接
      source: entry.source,
    });

    role.questions = questions;
    writeFileSync(path, JSON.stringify(role, null, 2) + "\n", "utf8");
    inserted += 1;
  }
}

console.log(`\n合入 ${inserted} 条，跳过（已存在）${skipped} 条`);
if (missingRoles.length) {
  console.log(`未找到的岗位：${[...new Set(missingRoles)].join(", ")}`);
}
