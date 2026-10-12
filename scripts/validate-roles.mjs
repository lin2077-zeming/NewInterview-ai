#!/usr/bin/env node
/**
 * 岗位数据校验（命令行入口）。
 *
 * 用法：node --experimental-strip-types scripts/validate-roles.mjs [--strict]
 *
 * 规则本身在 `src/lib/job-roles/validate.ts` —— 与运行时加载层**共用同一份**，
 * 避免出现「本地校验通过、远程热更新包没被拦住」这种分叉。
 *
 * 为什么必须加 --experimental-strip-types？因为要 import 那个 .ts。
 * 这是刻意的取舍：宁可让调用方多打一个参数，也不要维护两份校验规则
 * （两份规则必然分叉，而分叉的校验等于没有校验）。
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ROLES_DIR = join(ROOT, "data", "roles");
const TAXONOMY_PATH = join(ROLES_DIR, "taxonomy.json");

const STRICT = process.argv.includes("--strict");

const { validateRoleData } = await import(
  `file:///${join(ROOT, "src/lib/job-roles/validate.ts").replace(/\\/g, "/")}`
);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.error(`✗ ${basename(path)} 解析失败：${error.message}`);
    process.exit(1);
  }
}

if (!existsSync(TAXONOMY_PATH)) {
  console.error(`✗ 找不到分类索引：${TAXONOMY_PATH}`);
  process.exit(1);
}

const taxonomy = readJson(TAXONOMY_PATH);

// 扫描磁盘上的内容文件（文件名以 _ 开头的跳过，留给 _category.json 这类元信息）
const contents = [];
if (existsSync(ROLES_DIR)) {
  for (const entry of readdirSync(ROLES_DIR)) {
    const categoryDir = join(ROLES_DIR, entry);
    if (!statSync(categoryDir).isDirectory()) continue;

    for (const file of readdirSync(categoryDir)) {
      if (!file.endsWith(".json") || file.startsWith("_")) continue;
      contents.push({
        expectedId: `${entry}.${file.replace(/\.json$/, "")}`,
        expectedCategoryId: entry,
        data: readJson(join(categoryDir, file)),
      });
    }
  }
}

const result = validateRoleData(taxonomy, contents, { strict: STRICT });
const { stats } = result;

console.log("岗位数据校验");
console.log("─".repeat(48));
console.log(`  已登记子类 : ${stats.declaredSubcategories}`);
console.log(
  `  已实现内容 : ${stats.implementedSubcategories}  （full ${stats.fullCount} / skeleton ${stats.skeletonCount}）`
);
console.log(`  题目总数   : ${stats.questionCount}`);
if (stats.missingSubcategories.length > 0) {
  console.log(
    `  未实现     : ${stats.missingSubcategories.length} 个子类（前台会显示为「暂无内容」）`
  );
}

if (result.warnings.length > 0) {
  console.log(`\n⚠ 警告 ${result.warnings.length} 条：`);
  for (const w of result.warnings.slice(0, 20)) console.log(`  - ${w.where}: ${w.message}`);
  if (result.warnings.length > 20) console.log(`  ... 另有 ${result.warnings.length - 20} 条`);
}

if (result.errors.length > 0) {
  console.log(`\n✗ 错误 ${result.errors.length} 条：`);
  for (const e of result.errors.slice(0, 40)) console.log(`  - ${e.where}: ${e.message}`);
  if (result.errors.length > 40) console.log(`  ... 另有 ${result.errors.length - 40} 条`);
  process.exit(1);
}

console.log("\n✓ 校验通过");
