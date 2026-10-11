#!/usr/bin/env node
/**
 * 抢救人工手写的追问链维度（**一次性迁移脚本，已完成使命**）。
 *
 * 用法：node --experimental-strip-types scripts/migrate-dimensions.mjs [--dry-run]
 *
 * ⚠️ 本脚本依赖 `src/config/question-chains.ts` —— 那个文件在 I-26 中已被删除
 * （它的岗位数据与 `data/roles/**` 重复，是"分类混乱"的根源之一）。
 * 因此这个脚本**现在跑不了**，保留它只是为了留下迁移过程的可追溯记录。
 *
 * 历史背景：那 8 个岗位的维度是**人工精心撰写**的（三层递进追问 + 及格线 + 危险信号，
 * 质量高于 AI 批量生成）。体系重构时岗位改由 data/roles/** 提供，
 * 如果直接让生成器覆盖，这批人工内容就丢了 —— 实打实的质量回退。
 * 已于 2026-10-11 全部抢救回 JSON（8/8）。
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ROLES_DIR = join(ROOT, "data", "roles");
const CHAINS_PATH = join(ROOT, "src", "config", "question-chains.ts");

const DRY_RUN = process.argv.includes("--dry-run");

/** 旧的扁平 key → 新体系子类 id */
const KEY_MAP = {
  backend: "cs-it.backend",
  frontend: "cs-it.frontend",
  fullstack: "cs-it.fullstack",
  algorithm: "cs-it.algorithm",
  data: "cs-it.data-analysis",
  test: "cs-it.test-dev",
  ops: "cs-it.devops",
  product: "cs-it.product-manager",
};

const mod = await import(`file:///${CHAINS_PATH.replace(/\\/g, "/")}`);
const ROLE_DIMENSIONS = mod.ROLE_DIMENSIONS ?? {};

let written = 0;
let skipped = 0;

console.log("抢救人工手写维度");
console.log("─".repeat(48));

for (const [oldKey, roleId] of Object.entries(KEY_MAP)) {
  const seeded = ROLE_DIMENSIONS[oldKey];
  if (!Array.isArray(seeded) || seeded.length === 0) {
    console.log(`  ⚠ ${oldKey}：源码里没有维度，跳过`);
    skipped++;
    continue;
  }

  const [categoryId, subId] = roleId.split(".");
  const filePath = join(ROLES_DIR, categoryId, `${subId}.json`);
  if (!existsSync(filePath)) {
    console.log(`  ⚠ ${roleId}：内容文件不存在，跳过`);
    skipped++;
    continue;
  }

  const content = JSON.parse(readFileSync(filePath, "utf8"));
  const before = (content.dimensions ?? []).map((d) => d.name).join(" / ");

  if (DRY_RUN) {
    console.log(`  [dry-run] ${roleId}`);
    console.log(`      生成器版: ${before}`);
    console.log(`      手写版  : ${seeded.map((d) => d.name).join(" / ")}`);
    continue;
  }

  content.dimensions = seeded;
  content.meta = {
    ...content.meta,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  // 标出这批维度是人工整理，与 AI 生成内容区分开
  content.meta.dimensionSource = "project-authored";
  writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`, "utf8");

  console.log(`  ✓ ${roleId}：已替换为手写版（${seeded.length} 维）`);
  console.log(`      原生成器版: ${before}`);
  written++;
}

console.log("─".repeat(48));
console.log(`写入 ${written} / 跳过 ${skipped}`);
console.log("下一步：node scripts/validate-roles.mjs");
