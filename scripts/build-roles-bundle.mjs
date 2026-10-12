#!/usr/bin/env node
/**
 * 打包岗位数据为可托管的数据包（远程热更新用）。
 *
 * 用法：
 *   node --experimental-strip-types scripts/build-roles-bundle.mjs
 *   node --experimental-strip-types scripts/build-roles-bundle.mjs --out dist/roles-bundle.json
 *   node --experimental-strip-types scripts/build-roles-bundle.mjs --bump
 *
 * 参数：
 *   --out <path>   输出路径，默认 data/roles-bundle.json
 *   --bump         版本号 +1（改完内容要发布时用）
 *   --version <n>  直接指定版本号
 *   --pretty       格式化输出（体积大，仅调试用；托管时不要加）
 *
 * 为什么打包成单个文件而不是直接托管 data/roles 目录：
 * 热更新要**原子替换**。逐个文件拉会出现"更新到一半"——
 * 岗位列表半新半旧，排查起来会非常痛苦。
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ROLES_DIR = join(ROOT, "data", "roles");

const argv = process.argv.slice(2);
function argValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const OUT = resolve(ROOT, argValue("--out") || "data/roles-bundle.json");
const BUMP = argv.includes("--bump");
const EXPLICIT_VERSION = Number(argValue("--version"));
const PRETTY = argv.includes("--pretty");

const { validateRoleData } = await import(
  `file:///${join(ROOT, "src/lib/job-roles/validate.ts").replace(/\\/g, "/")}`
);

// ---------- 读取 ----------

const taxonomyPath = join(ROLES_DIR, "taxonomy.json");
if (!existsSync(taxonomyPath)) {
  console.error(`✗ 找不到分类索引：${taxonomyPath}`);
  process.exit(1);
}
const taxonomy = JSON.parse(readFileSync(taxonomyPath, "utf8"));

const contents = {};
const entries = [];
for (const categoryId of readdirSync(ROLES_DIR)) {
  const dir = join(ROLES_DIR, categoryId);
  if (!statSync(dir).isDirectory()) continue;

  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    const id = `${categoryId}.${file.replace(/\.json$/, "")}`;
    const data = JSON.parse(readFileSync(join(dir, file), "utf8"));
    contents[id] = data;
    entries.push({ expectedId: id, expectedCategoryId: categoryId, data });
  }
}

// ---------- 校验（不通过就不打包，避免把脏数据发布出去） ----------

const outcome = validateRoleData(taxonomy, entries);
if (!outcome.ok) {
  console.error(`✗ 数据校验未通过（${outcome.errors.length} 个错误），拒绝打包：`);
  for (const e of outcome.errors.slice(0, 20)) console.error(`  - ${e.where}: ${e.message}`);
  process.exit(1);
}

// ---------- 版本号 ----------

const baseVersion = Number(taxonomy.version) || 1;
let version = baseVersion;
if (Number.isFinite(EXPLICIT_VERSION) && EXPLICIT_VERSION > 0) version = EXPLICIT_VERSION;
else if (BUMP) version = baseVersion + 1;

const payload = {
  version,
  updatedAt: new Date().toISOString().slice(0, 10),
  taxonomy,
  contents,
};

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
const json = PRETTY ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
writeFileSync(OUT, `${json}\n`, "utf8");

const sizeKb = Math.round((Buffer.byteLength(json) / 1024) * 10) / 10;

console.log("岗位数据包已打包");
console.log("─".repeat(48));
console.log(`  输出     : ${OUT}`);
console.log(`  版本     : v${version}${version !== baseVersion ? `（原 v${baseVersion}）` : ""}`);
console.log(`  大类/子类: ${taxonomy.categories.length} / ${outcome.stats.implementedSubcategories}`);
console.log(`  题目总数 : ${outcome.stats.questionCount}`);
console.log(`  体积     : ${sizeKb} KB`);
console.log("");
console.log("发布后把托管地址配到环境变量 OPC_ROLES_URL 即可热更新。");
console.log("建议开启 gzip/br —— 这份 JSON 压缩后通常只剩十分之一左右。");
