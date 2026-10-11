#!/usr/bin/env node
/**
 * 岗位内容批量生成器。
 *
 * 用法（在仓库根目录）：
 *   node --experimental-strip-types scripts/generate-roles.mjs --category cs-it
 *   node --experimental-strip-types scripts/generate-roles.mjs --only cs-it.backend,finance-econ.banking
 *   node --experimental-strip-types scripts/generate-roles.mjs --category edu-research --limit 3
 *   node --experimental-strip-types scripts/generate-roles.mjs --category law-public --dry-run
 *
 * 参数：
 *   --category <id>   只处理某个大类
 *   --only <ids>      逗号分隔的子类 id 白名单
 *   --limit <n>       本次最多生成几个
 *   --force           已达标（full）的文件也重新生成
 *   --dry-run         只打印，不写文件
 *   --model <name>    默认深 seek-flash
 *
 * ────────────────────────────────────────────────────────────
 * 关于诚实性（这一点比产出量重要）：
 *
 * 本脚本产出的**全部是 AI 生成的草稿**，一律标注 `source.type = "ai-generated"`，
 * 公司信息与「常见考察点」也如实写明来源为 AI 汇总，**不冒充真实面经**。
 * 真实来源（公司招聘官网、公开题库）需另行补充 —— 那是 `enrich` 步骤的活，
 * 不是这个脚本能编出来的。编造出来的"面经"评审一问就露，得不偿失。
 *
 * 生成后务必跑 `node scripts/validate-roles.mjs` 校验。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ROLES_DIR = join(ROOT, "data", "roles");
const TAXONOMY_PATH = join(ROLES_DIR, "taxonomy.json");
const ENV_PATH = join(ROOT, ".env.local");

// ==================== 参数解析 ====================

const argv = process.argv.slice(2);
function argValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const OPT = {
  category: argValue("--category"),
  only: argValue("--only")?.split(",").map((s) => s.trim()).filter(Boolean),
  limit: Number(argValue("--limit")) || Infinity,
  force: argv.includes("--force"),
  dryRun: argv.includes("--dry-run"),
  model: argValue("--model") || "deepseek-flash",
};

// ==================== 环境变量 ====================

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = loadEnv(ENV_PATH);
const API_KEY = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const BASE_URL = env.OPENAI_BASE_URL || "https://api.deepseek.com";

if (!API_KEY) {
  console.error("✗ 没找到 OPENAI_API_KEY（应在 .env.local 中）");
  process.exit(1);
}

// ==================== 依赖 ====================

const { createDeepSeek } = await import("@ai-sdk/deepseek");
const { generateObject } = await import("ai");
const { z } = await import("zod");
const { guardedFetch } = await import(`file:///${join(ROOT, "src/lib/ai/request-guard.ts").replace(/\\/g, "/")}`);

const isDeepSeek = BASE_URL.includes("deepseek");
const provider = createDeepSeek({
  apiKey: API_KEY,
  baseURL: BASE_URL,
  fetch: guardedFetch(fetch, { isDeepSeek }),
});

// ==================== 生成结构 ====================

const TODAY = new Date().toISOString().slice(0, 10);

const probeSchema = z.object({
  q: z.string().describe("追问问题，口语化，像面试官真的会问出来的话"),
  bar: z.string().describe("及格线：答到什么程度算过关，要具体"),
  red: z.string().describe("危险信号：出现什么表现说明不合格"),
});

const dimensionSchema = z.object({
  name: z.string().describe("考察维度名称，6-12 字"),
  why: z.string().describe("为什么要考这个维度，1-2 句"),
  weight: z.enum(["高", "中", "低"]),
  probes: z.array(probeSchema).length(3).describe("恰好 3 层递进追问：从入门到深挖"),
});

const questionSchema = z.object({
  stage: z.enum(["algorithm", "project", "cross", "hr"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  title: z.string().describe("简短题目标题"),
  content: z.string().describe("完整题干，2-4 句"),
  tags: z.array(z.string()).describe("2-4 个标签"),
});

const companySchema = z.object({
  name: z.string().describe("用人单位名称，必须是真实存在的机构"),
  hiringStyle: z.string().describe("招聘风格与考察侧重，1-2 句"),
  stages: z.array(z.string()).describe("典型招聘流程环节，3-6 项"),
});

const reportSchema = z.object({
  summary: z.string().describe("该岗位面试的常见考察点汇总，3-5 句"),
});

const roleGenSchema = z.object({
  label: z.string(),
  aliases: z.array(z.string()).describe("该岗位的常见别称，0-3 个"),
  summary: z.string().describe("一句话说明这个岗位做什么，30-50 字"),
  description: z
    .string()
    .describe("岗位描述，150-250 字。写清「做什么、服务谁、日常工作内容、需要什么能力」。这是 AI 生成面试内容的唯一依据，不能空泛"),
  skills: z.array(z.string()).describe("6 项核心能力要求，每项 4-12 字"),
  dimensions: z.array(dimensionSchema).length(4).describe("恰好 4 个考察维度"),
  questions: z.array(questionSchema).describe("8-10 道面试题"),
  companies: z.array(companySchema).describe("4-6 家该岗位的真实用人单位"),
  reports: z.array(reportSchema).describe("1-2 条该岗位面试的常见考察点汇总"),
});

// ==================== 提示词 ====================

function buildSystemPrompt() {
  return `你是一位资深的校园招聘面试官与职业规划顾问，熟悉中国大陆的就业市场与各行业招聘实况。
你正在为一个「AI 面试陪练」产品整理岗位考察体系。输出必须是可直接用于面试追问的、具体可执行的内容。

铁律：
1. 所有内容都是**你基于通用行业认知整理的知识**，不要声称来自某篇具体面经或某次真实面试。
2. 不要编造具体数字（如「出现 32 次」「录取率 5%」）、不要编造具体公司的内部流程细节、
   不要编造人名或链接。公司名必须是真实存在的机构，招聘流程只写业界通行的环节。
3. 追问要像真人面试官：口语化、层层递进、能从答案里抓漏洞。不要写成考试题。
4. 「bar（及格线）」和「red（危险信号）」必须具体到可判断，不能写「回答得好」「不熟悉」这种废话。
5. 面向中国大学生求职场景，用简体中文。`;
}

function buildUserPrompt({ categoryLabel, categorySummary, sub }) {
  return `请为下面的岗位整理考察体系。

一级大类：${categoryLabel}
大类说明：${categorySummary}
细分岗位：${sub.label}${sub.aliases?.length ? `（别称：${sub.aliases.join("、")}）` : ""}

要求：
- dimensions 恰好 4 个，覆盖该岗位真正的考察重点；每个维度 3 层递进追问
- questions 8-10 道。题型 stage 的取值说明：
  · algorithm —— 该岗位的**专业硬技能题**（技术岗放算法/编码题；非技术岗放本专业的核心业务题，
    例如会计放实务处理、教师放教学设计、律师放案例分析）
  · project —— 项目/实习/实践经历深挖
  · cross —— 跨领域综合或场景应变题
  · hr —— 求职动机、职业规划、团队协作等
  非技术岗可以没有 algorithm 题，但要保证 project/cross/hr 都有覆盖
- companies 4-6 家，必须是该岗位真实会招人的机构（企业、事业单位、学校、医院、事务所等均可）
- reports 1-2 条，写该岗位面试**常见的考察点汇总**（不是某一次真实面试的复述）`;
}

// ==================== 目标筛选 ====================

const taxonomy = JSON.parse(readFileSync(TAXONOMY_PATH, "utf8"));

const targets = [];
for (const cat of taxonomy.categories) {
  if (OPT.category && cat.id !== OPT.category) continue;
  for (const sub of cat.subcategories) {
    const fullId = `${cat.id}.${sub.id}`;
    if (OPT.only && !OPT.only.includes(fullId)) continue;
    targets.push({ categoryId: cat.id, categoryLabel: cat.label, categorySummary: cat.summary, sub, fullId });
  }
}

const pending = [];
for (const t of targets) {
  const file = join(ROLES_DIR, t.categoryId, `${t.sub.id}.json`);
  if (existsSync(file) && !OPT.force) {
    const existing = JSON.parse(readFileSync(file, "utf8"));
    if (existing.meta?.completeness === "full") continue;
  }
  pending.push(t);
}

const batch = pending.slice(0, OPT.limit);

console.log("岗位内容生成器");
console.log("─".repeat(52));
console.log(`  模型      : ${OPT.model}`);
console.log(`  匹配目标  : ${targets.length} 个子类`);
console.log(`  待生成    : ${pending.length} 个（已达标 full 的会跳过，用 --force 强制）`);
console.log(`  本次处理  : ${batch.length} 个`);
if (OPT.dryRun) console.log("  模式      : dry-run（不写文件）");
console.log("");

if (batch.length === 0) {
  console.log("没有需要生成的目标。");
  process.exit(0);
}

// ==================== 逐个生成 ====================

let ok = 0;
let failed = 0;
let totalIn = 0;
let totalOut = 0;

for (const [i, t] of batch.entries()) {
  const prefix = `[${i + 1}/${batch.length}] ${t.fullId}`;
  process.stdout.write(`${prefix} 生成中…`);

  try {
    const { object, usage } = await generateObject({
      model: provider.chat(OPT.model),
      schema: roleGenSchema,
      system: buildSystemPrompt(),
      prompt: buildUserPrompt(t),
      maxOutputTokens: 8000,
    });

    totalIn += usage?.inputTokens ?? 0;
    totalOut += usage?.outputTokens ?? 0;

    const aiSource = {
      type: "ai-generated",
      name: "AI 批量生成草稿（DeepSeek）",
      collectedAt: TODAY,
    };

    const content = {
      id: t.fullId,
      categoryId: t.categoryId,
      label: object.label || t.sub.label,
      aliases: object.aliases ?? (t.sub.aliases || []),
      summary: object.summary,
      description: object.description,
      skills: object.skills,
      dimensions: object.dimensions,
      questions: object.questions.map((q, idx) => ({
        id: `${t.fullId}-q${String(idx + 1).padStart(2, "0")}`,
        ...q,
        source: aiSource,
      })),
      companies: object.companies.map((c) => ({ ...c, source: aiSource })),
      interviewReports: object.reports.map((r) => ({
        source: {
          ...aiSource,
          // 自我披露写在来源名里，避免被当成真实面经
          name: "AI 汇总的常见考察点（非真实面经）",
        },
        summary: r.summary,
      })),
      meta: {
        version: 1,
        updatedAt: TODAY,
        completeness: "full",
      },
    };

    if (OPT.dryRun) {
      process.stdout.write(`\r${prefix} [dry-run] ${object.dimensions.length} 维 / ${object.questions.length} 题\n`);
    } else {
      const dir = join(ROLES_DIR, t.categoryId);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${t.sub.id}.json`), `${JSON.stringify(content, null, 2)}\n`, "utf8");
      process.stdout.write(
        `\r${prefix} ✓ ${object.label}｜${object.dimensions.length} 维 / ${object.questions.length} 题 / ${object.companies.length} 家公司\n`
      );
    }
    ok++;
  } catch (error) {
    failed++;
    const msg = error instanceof Error ? error.message : String(error);
    process.stdout.write(`\r${prefix} ✗ 失败：${msg.slice(0, 120)}\n`);
  }

  // 顺序调用留间隔，避免触发限流
  if (i < batch.length - 1) await new Promise((r) => setTimeout(r, 1200));
}

// ==================== 汇总 ====================

const costIn = (totalIn / 1_000_000) * 4.5;
const costOut = (totalOut / 1_000_000) * 13.5;

console.log("");
console.log("─".repeat(52));
console.log(`  成功 ${ok} / 失败 ${failed}`);
console.log(`  token：输入 ${totalIn} + 输出 ${totalOut} = ${totalIn + totalOut}`);
console.log(`  估算成本：¥${(costIn + costOut).toFixed(4)}`);
console.log("");
console.log("下一步：node scripts/validate-roles.mjs");
console.log("提醒：以上均为 AI 生成草稿，真实来源（官网 / 公开题库 / 面经）需另行补充。");
