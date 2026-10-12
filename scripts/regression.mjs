#!/usr/bin/env node
/**
 * 端到端回归套件。
 *
 * 用法：
 *   node --experimental-strip-types scripts/regression.mjs
 *   node --experimental-strip-types scripts/regression.mjs --offline     # 跳过要调 AI 的用例
 *   node --experimental-strip-types scripts/regression.mjs --base http://127.0.0.1:5000
 *
 * 为什么要有它：这个项目已经叠了 I-04 ~ I-31 十几项功能，改动之间会互相踩。
 * 「我改完跑了一下没问题」这种话，只有在**可重复执行**的前提下才算数。
 * 每次改动后跑一遍，比人工点页面可靠得多。
 *
 * 用例分两层：
 * - 不耗 AI 的：数据校验、接口结构、文件解析、会话隔离 —— 快，任何时候都跑
 * - 耗 AI 的：简历诊断、追问链、面试排题 —— 慢且花钱，用 --offline 可跳过
 *
 * 设计约定：
 * - **每个用例用独立的匿名会话**，避免互相污染，也避免撞上 20 次/小时的会话限流
 * - 撞到 429 记为 SKIP 而不是 FAIL —— 限流本身是 I-10 的正确行为，不该判失败
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const FIXTURES = join(ROOT, "tests", "fixtures");

const argv = process.argv.slice(2);
function argValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const BASE = argValue("--base") || "http://127.0.0.1:5000";
const OFFLINE = argv.includes("--offline");

// ==================== 迷你测试框架 ====================

const results = [];
let currentGroup = "";

function group(name) {
  currentGroup = name;
  console.log(`\n${name}`);
}

function record(status, name, detail = "") {
  results.push({ group: currentGroup, status, name, detail });
  const icon = status === "PASS" ? "✓" : status === "SKIP" ? "○" : "✗";
  const tail = detail ? `  ${detail}` : "";
  console.log(`  ${icon} ${name}${tail}`);
}

function pass(name, detail) {
  record("PASS", name, detail);
}
function fail(name, detail) {
  record("FAIL", name, detail);
}
function skip(name, detail) {
  record("SKIP", name, detail);
}

function expect(name, condition, detail = "") {
  if (condition) pass(name, detail);
  else fail(name, detail);
  return Boolean(condition);
}

// ==================== 带独立会话的 HTTP 客户端 ====================

function createClient() {
  const cookies = new Map();

  function cookieHeader() {
    if (cookies.size === 0) return undefined;
    return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  function storeCookies(response) {
    const raw = response.headers.getSetCookie?.() ?? [];
    for (const line of raw) {
      const [pair] = line.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers ?? {}) };
    const ch = cookieHeader();
    if (ch) headers.cookie = ch;

    const response = await fetch(`${BASE}${path}`, { ...options, headers, redirect: "manual" });
    storeCookies(response);
    return response;
  }

  async function json(path, options = {}) {
    const response = await request(path, options);
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { status: response.status, data };
  }

  function postJson(path, body) {
    return json(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function upload(fileName) {
    const buffer = readFileSync(join(FIXTURES, fileName));
    const form = new FormData();
    form.append("file", new Blob([buffer]), fileName);
    const response = await request("/api/upload", { method: "POST", body: form });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { status: response.status, data };
  }

  return { request, json, postJson, upload };
}

/** 撞上限流时不应判失败 —— 那是 I-10 的正确行为 */
function isRateLimited(status, data) {
  return status === 429 || (data?.error && String(data.error).includes("过于频繁"));
}

// ==================== 1. 岗位数据（不需要服务） ====================

async function checkRoleData() {
  group("1. 岗位数据完整性");

  const { validateRoleData } = await import(
    `file:///${join(ROOT, "src/lib/job-roles/validate.ts").replace(/\\/g, "/")}`
  );

  const rolesDir = join(ROOT, "data", "roles");
  const taxonomy = JSON.parse(readFileSync(join(rolesDir, "taxonomy.json"), "utf8"));

  const contents = [];
  const { readdirSync, statSync } = await import("node:fs");
  for (const categoryId of readdirSync(rolesDir)) {
    const dir = join(rolesDir, categoryId);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json") || file.startsWith("_")) continue;
      contents.push({
        expectedId: `${categoryId}.${file.replace(/\.json$/, "")}`,
        expectedCategoryId: categoryId,
        data: JSON.parse(readFileSync(join(dir, file), "utf8")),
      });
    }
  }

  const outcome = validateRoleData(taxonomy, contents);
  expect(
    "岗位数据通过校验",
    outcome.ok,
    outcome.ok ? `${outcome.stats.implementedSubcategories} 子类 / ${outcome.stats.questionCount} 题` : `${outcome.errors.length} 个错误`
  );
  expect("所有登记的子公司都有内容", outcome.stats.missingSubcategories.length === 0,
    `缺 ${outcome.stats.missingSubcategories.length} 个`);
  expect("没有 skeleton 档残留", outcome.stats.skeletonCount === 0,
    `skeleton ${outcome.stats.skeletonCount}`);

  return { taxonomy, contents };
}

// ==================== 2. 岗位接口 ====================

async function checkRolesApi() {
  group("2. 岗位接口（两级分类 + 数据版本）");

  const client = createClient();
  const { status, data } = await client.json("/api/roles");
  if (!expect("GET /api/roles 返回 200", status === 200, `HTTP ${status}`)) return;

  const categories = data?.categories ?? [];
  expect("返回两级结构 categories", Array.isArray(categories) && categories.length > 0,
    `${categories.length} 个大类`);

  const subCount = categories.reduce((n, c) => n + (c.subcategories?.length ?? 0), 0);
  expect("子类总数 ≥ 64（含自定义岗位）", subCount >= 64, `${subCount} 个子类`);

  const withOffline = (data?.roles ?? []).filter((r) => r.hasOfflineContent).length;
  expect("绝大多数岗位有离线内容", withOffline >= 64, `${withOffline} / ${(data?.roles ?? []).length}`);

  const meta = data?.meta ?? {};
  expect("回传数据版本 meta", typeof meta.version === "number" && meta.version >= 2,
    `v${meta.version} · ${meta.source}`);
  expect("meta 含 remoteEnabled 开关", typeof meta.remoteEnabled === "boolean",
    `remoteEnabled=${meta.remoteEnabled}`);
  expect("岗位条目带 categoryId", categories[0]?.subcategories?.[0]?.categoryId === categories[0]?.id,
    categories[0]?.subcategories?.[0]?.categoryId);
}

// ==================== 3. 简历解析（I-04） ====================

async function checkResumeParsing() {
  group("3. 简历解析（I-04：PDF / DOCX / TXT / 扫描件 / 非简历）");

  const cases = [
    { file: "resume_cn.txt", label: "TXT 中文简历", expectText: true },
    { file: "resume_cn.docx", label: "DOCX 中文简历", expectText: true },
    { file: "resume_en.pdf", label: "PDF 英文简历", expectText: true },
  ];

  for (const c of cases) {
    const client = createClient();
    const { status, data } = await client.upload(c.file);
    const text = data?.rawText ?? "";
    expect(
      `${c.label} 能提取出文本`,
      status === 200 && text.length > 50,
      status === 200 ? `${text.length} 字 · ${data?.fileType}` : `HTTP ${status} ${data?.error ?? ""}`
    );
  }

  // 扫描件：没有可提取文本，必须**明确告知**而不是静默返回空
  {
    const client = createClient();
    const { status, data } = await client.upload("resume_scanned.pdf");
    const rejected = status !== 200 || (data?.warnings ?? []).length > 0;
    expect(
      "扫描版 PDF 被识别为「无可提取文本」并给出提示",
      rejected,
      status === 200
        ? `warnings: ${(data?.warnings ?? []).join(" / ") || "（无，可能有问题）"}`
        : `HTTP ${status} ${data?.error ?? ""}`
    );
  }

  // 非简历：应被拒
  {
    const client = createClient();
    const { status, data } = await client.postJson("/api/resume/diagnose", {
      rawText: readFileSync(join(FIXTURES, "not_a_resume.txt"), "utf8"),
      targetRole: "cs-it.backend",
    });
    const handled = status === 400 || status === 422;
    expect(
      "非简历文本被拒绝（不会硬做诊断）",
      handled,
      `HTTP ${status} ${data?.error ?? ""}`
    );
  }
}

// ==================== 4. 会话隔离（I-05） ====================

async function checkSessionIsolation() {
  group("4. 匿名会话与数据隔离（I-05）");

  const alice = createClient();
  const bob = createClient();

  const created = await alice.postJson("/api/interview/create", {
    config: { role: "后端开发工程师", company: "bytedance", mode: "normal", stressMode: false, stageIndex: 0 },
  });

  if (!expect("会话 A 能创建面试", created.status === 200 && created.data?.interviewId,
    `HTTP ${created.status} ${created.data?.error ?? ""}`)) return;

  const interviewId = created.data.interviewId;

  // 会话 B 拿着 A 的 id 去读复盘 —— 必须 404，且不能泄露"存在但不属于你"
  const bobRead = await bob.json(`/api/interview/review/${interviewId}`);
  expect(
    "会话 B 读他人复盘返回 404（不泄露存在性）",
    bobRead.status === 404,
    `HTTP ${bobRead.status}`
  );

  const bobList = await bob.json(`/api/interview/review/${interviewId}`);
  expect(
    "越权响应体不包含岗位等业务信息",
    !bobList.data?.report,
    bobList.data?.report ? "泄露了 report！" : "无泄露"
  );

  // 本人读自己的：由于尚未生成复盘，应为 404（存在但无报告）—— 至少不应是 403/500
  const aliceRead = await alice.json(`/api/interview/review/${interviewId}`);
  expect(
    "会话 A 读自己的面试不报 5xx",
    aliceRead.status < 500,
    `HTTP ${aliceRead.status}`
  );
}

// ==================== 5. AI 功能 ====================

async function checkAiFeatures(knownRoles) {
  group("5. AI 功能（简历诊断 / 追问链 / 面试排题）");

  if (OFFLINE) {
    skip("简历诊断", "--offline");
    skip("追问链（非计算机岗位）", "--offline");
    skip("面试排题不串岗", "--offline");
    return;
  }

  const weakResume = readFileSync(join(FIXTURES, "resume_weak.txt"), "utf8");

  // --- 简历诊断 ---
  {
    const client = createClient();
    const { status, data } = await client.postJson("/api/resume/diagnose", {
      rawText: weakResume,
      targetRole: "cs-it.frontend",
    });

    if (isRateLimited(status, data)) {
      skip("简历诊断", "撞上限流（I-10 的正常行为）");
    } else if (!expect("简历诊断返回 200", status === 200, `HTTP ${status} ${data?.error ?? ""}`)) {
      // 已记录失败
    } else {
      const fixes = data.fixes ?? [];
      expect("至少给出 1 条修改建议", fixes.length > 0, `${fixes.length} 条`);
      // 字段名以 src/types 的 ResumeFix 为准：original / suggestion
      const withRewrite = fixes.filter(
        (f) => f.original && f.suggestion && f.suggestion !== f.original
      );
      expect(
        "建议含「原句 → 改后句」的可执行内容",
        withRewrite.length > 0,
        `${withRewrite.length} / ${fixes.length} 条带改写对照`
      );
      const withSection = fixes.filter((f) => f.section && f.issue && f.why);
      expect(
        "建议标明所在段落、问题与原因",
        withSection.length === fixes.length,
        `${withSection.length} / ${fixes.length} 条字段完整`
      );
      expect("回传 usage（成本可计量）", typeof data.usage?.cost === "number",
        `cost=¥${data.usage?.cost}`);
      expect("回传 source（ai / fallback）", ["ai", "fallback"].includes(data.source), data.source);
    }
  }

  // --- 追问链：非计算机岗位必须零计算机维度 ---
  {
    const client = createClient();
    const roleId = "edu-research.k12-teacher";
    const { status, data } = await client.postJson("/api/interview/chain", { role: roleId });

    if (isRateLimited(status, data)) {
      skip("追问链（中小学教师）", "撞上限流");
    } else if (!expect("追问链返回 200", status === 200, `HTTP ${status}`)) {
      // 已记录
    } else {
      const dims = (data.dimensions ?? []).map((d) => d.name);
      expect("返回恰好 4 个考察维度", dims.length === 4, `${dims.length} 个：${dims.join(" / ")}`);

      const CS_WORDS = ["并发", "数据库", "索引", "缓存", "系统设计", "分布式", "数据结构", "微服务", "中间件"];
      const leaks = dims.filter((n) => CS_WORDS.some((w) => n.includes(w)));
      expect("教师岗维度零计算机关键词泄漏", leaks.length === 0, leaks.join(" / ") || "无泄漏");

      // 关键：离线与在线两条路径的维度必须一致 —— 都来自 data/roles 的人工整理。
      // 否则同一岗位会"离线 4 维度、在线 6 维度"，人工整理的维度等于白费。
      const teacherFile = JSON.parse(
        readFileSync(join(ROOT, "data", "roles", "edu-research", "k12-teacher.json"), "utf8")
      );
      const fileDims = teacherFile.dimensions.map((d) => d.name);
      const overlap = dims.filter((n) => fileDims.includes(n)).length;

      if (data.source === "fallback") {
        expect(
          "离线维度与 data/roles 定义完全一致",
          overlap === fileDims.length,
          `文件: ${fileDims.join(" / ")}`
        );
      } else {
        expect(
          "AI 路径沿用了 data/roles 中已整理的维度名",
          overlap >= 3,
          `命中 ${overlap}/${fileDims.length}；返回: ${dims.join(" / ")}`
        );
      }
    }
  }

  // --- 旧扁平 key 兼容 ---
  {
    const client = createClient();
    const { status, data } = await client.postJson("/api/interview/chain", { role: "backend" });
    if (isRateLimited(status, data)) {
      skip("旧 key 兼容（backend）", "撞上限流");
    } else {
      expect(
        "旧 key「backend」仍能解析到后端岗位",
        status === 200 && data.role === "cs-it.backend",
        `role=${data?.role} label=${data?.roleLabel}`
      );
    }
  }

  // --- 求职规划：非计算机岗位不该算成计算机技能 ---
  {
    const client = createClient();
    const TEACHER_RESUME = [
      "李小明",
      "教育背景：华南师范大学 小学教育专业 本科 2022-2026",
      "实习经历：2025年3-6月在广州市某小学实习，担任三年级数学实习教师",
      "技能：普通话二级甲等、教师资格证（小学）、熟练使用希沃白板",
      "荣誉：校级师范生教学技能大赛二等奖",
      "项目：参与小学数学校本课程开发，负责教学设计部分",
      "邮箱：lixiaoming@example.com",
    ].join("\n");

    const PROFILE = {
      educationStage: "本科在读",
      major: "小学教育",
      experienceLevel: "有实习经历",
      currentStatus: "大四正在求职",
      targetTimeline: "3-6个月",
      preference: "一线城市公办小学",
      dailyStudyTime: "每天2小时",
      selfRatedStrengths: "教学设计与课堂表达",
      painPoints: "不确定自己的技能差距在哪",
      constraints: "需要兼顾毕业设计",
    };

    const { status, data } = await client.postJson("/api/career/analyze", {
      rawText: TEACHER_RESUME,
      targetRole: "edu-research.k12-teacher",
      fileName: "teacher.txt",
      userProfile: PROFILE,
    });

    if (isRateLimited(status, data)) {
      skip("求职规划（教师岗）", "撞上限流");
    } else if (!expect("求职规划返回 200", status === 200, `HTTP ${status} ${data?.error ?? ""}`)) {
      // 已记录
    } else {
      const required = data.gap?.requiredSkills ?? [];
      expect("给出目标岗位的技能要求", required.length > 0, `${required.length} 项`);

      const CS_ONLY = ["React", "Vue", "JavaScript", "Java", "Spring Boot", "MySQL", "Redis", "PyTorch", "Next.js"];
      const leaks = required.filter((s) => CS_ONLY.some((c) => s.includes(c)));
      expect("教师岗技能要求零计算机泄漏", leaks.length === 0, leaks.join(" / ") || "无泄漏");

      const current = data.gap?.currentSkills ?? [];
      expect("从教师简历里提取出了教师相关技能", current.length > 0, current.slice(0, 3).join(" / "));
    }
  }

  // --- 面试排题不串岗 ---
  {
    const client = createClient();
    const created = await client.postJson("/api/interview/create", {
      config: { role: "中小学教师", company: "generic", mode: "normal", stressMode: false, stageIndex: 0 },
    });

    if (!expect("教师岗能创建面试", created.status === 200, `HTTP ${created.status}`)) return;

    const response = await client.request("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "请开始面试，先出第一道题。" }] }],
        config: { role: "中小学教师", company: "generic", currentStage: 0 },
        mode: "normal",
        interviewId: created.data.interviewId,
      }),
    });

    if (response.status === 429) {
      skip("面试排题不串岗", "撞上限流");
    } else {
      const sse = await response.text();
      const BACKEND = ["LRU", "哈希表", "Redis", "MySQL", "并发编程", "索引优化", "动态规划"];
      const leaks = BACKEND.filter((w) => sse.includes(w));
      expect("教师岗面试排题不出现后端题", leaks.length === 0, leaks.join(" / ") || "无泄漏");

      const TEACH = ["学生", "课堂", "教学", "教师"];
      expect("确实抽到了教师向的题", TEACH.some((w) => sse.includes(w)),
        TEACH.filter((w) => sse.includes(w)).join(" / "));
    }
  }
}


// ==================== 6. 离线能力（I-13） ====================

async function checkOfflineCapability() {
  group("6. 离线能力（题库练习 / AI 状态）");

  const client = createClient();

  // AI 状态：在线离线都要能取到
  {
    const { status, data } = await client.json("/api/ai-status");
    expect("GET /api/ai-status 返回 200", status === 200, `HTTP ${status}`);
    expect("返回 mode 字段（online / offline）", ["online", "offline"].includes(data?.mode), data?.mode);
    expect("不泄露密钥信息", !JSON.stringify(data ?? {}).toLowerCase().includes("sk-"), "无密钥泄漏");
  }

  // 题库练习：**不依赖 AI**，这条是降级模式的核心能力
  {
    const { status, data } = await client.json(
      "/api/practice/questions?role=edu-research.k12-teacher"
    );
    expect("题库练习接口可用", status === 200, `HTTP ${status}`);
    expect("返回该岗位的题目", (data?.questions ?? []).length > 0, `${(data?.questions ?? []).length} 题`);
    expect("返回 4 个考察维度", (data?.dimensions ?? []).length === 4,
      (data?.dimensions ?? []).map((d) => d.name).join(" / "));
    expect("题目带题型与难度", Boolean(data?.questions?.[0]?.stage && data?.questions?.[0]?.difficulty));
  }

  // 参数校验
  {
    const bad = await client.json("/api/practice/questions");
    expect("缺少 role 参数返回 400", bad.status === 400, `HTTP ${bad.status}`);

    const missing = await client.json("/api/practice/questions?role=cs-it.not-exist");
    expect("不存在的岗位返回 404", missing.status === 404, `HTTP ${missing.status}`);
  }

  // 题型筛选
  {
    const { data } = await client.json(
      "/api/practice/questions?role=cs-it.backend&stage=algorithm&difficulty=easy"
    );
    const allMatch = (data?.questions ?? []).every(
      (q) => q.stage === "algorithm" && q.difficulty === "easy"
    );
    expect("题型 + 难度筛选生效", (data?.questions ?? []).length > 0 && allMatch,
      `${(data?.questions ?? []).length} 题符合条件`);
  }

  // 最关键的一条：**每个岗位都有离线内容**，这是降级模式能成立的前提
  {
    const roles = await client.json("/api/roles");
    const all = (roles.data?.categories ?? []).flatMap((c) => c.subcategories);
    const builtin = all.filter((r) => !r.isCustom);
    let missing = [];
    for (const role of builtin) {
      const res = await client.json(`/api/practice/questions?role=${encodeURIComponent(role.id)}`);
      const count = (res.data?.questions ?? []).length;
      const dims = (res.data?.dimensions ?? []).length;
      if (res.status !== 200 || count === 0 || dims === 0) {
        missing.push(`${role.id}(题${count}/维${dims})`);
      }
    }
    expect(
      `全部 ${builtin.length} 个内置岗位都有离线内容`,
      missing.length === 0,
      missing.length === 0 ? "逐岗位校验通过" : `缺失: ${missing.slice(0, 5).join(", ")}`
    );
  }
}

// ==================== 主流程 ====================

console.log("职镜 OPC · 端到端回归");
console.log("─".repeat(56));
console.log(`  目标服务 : ${BASE}`);
console.log(`  模式     : ${OFFLINE ? "offline（跳过 AI 用例）" : "完整"}`);

const knownRoles = await checkRoleData();

// 服务可达性
let serverUp = false;
try {
  const probe = await fetch(BASE, { signal: AbortSignal.timeout(8000) });
  serverUp = probe.status < 500;
} catch {
  serverUp = false;
}

if (!serverUp) {
  group("服务可达性");
  fail("开发服务器不可达", `${BASE} —— 请先跑 pnpm dev`);
} else {
  await checkRolesApi();
  await checkResumeParsing();
  await checkSessionIsolation();
  await checkAiFeatures(knownRoles);
  await checkOfflineCapability();
}

// ---------- 汇总 ----------
const passed = results.filter((r) => r.status === "PASS").length;
const failed = results.filter((r) => r.status === "FAIL").length;
const skipped = results.filter((r) => r.status === "SKIP").length;

console.log(`\n${"─".repeat(56)}`);
console.log(`  通过 ${passed} / 失败 ${failed} / 跳过 ${skipped}`);

if (failed > 0) {
  console.log("\n失败用例：");
  for (const r of results.filter((x) => x.status === "FAIL")) {
    console.log(`  ✗ [${r.group}] ${r.name}${r.detail ? `\n      ${r.detail}` : ""}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
