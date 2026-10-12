#!/usr/bin/env node
/**
 * 全链路压测与取数。
 *
 * 用法：
 *   node --experimental-strip-types scripts/e2e-loadtest.mjs
 *   node --experimental-strip-types scripts/e2e-loadtest.mjs --runs 3 --turns 5
 *   node --experimental-strip-types scripts/e2e-loadtest.mjs --base http://127.0.0.1:5000
 *
 * 跑什么：首页 → 简历诊断 → 追问链 → 面试（多轮）→ 复盘 → 看板数据
 * 记什么：每一环的耗时、建议条数、token、成本、AI/离线来源
 *
 * 为什么要跑满 3 次：单次跑通只能说明"此刻能跑"，连续跑才能暴露
 * 偶发问题（限流、模型抖动、超时）。实测就抓到过"重启后首次调用必降级"这种规律。
 *
 * ⚠️ 会真实调用 AI 并产生费用。默认 3 轮 × 每轮 5 个问答，约 ¥1~2。
 * 产出 `tests/reports/loadtest-<时间戳>.json` 与 `.md`。
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const FIXTURES = join(ROOT, "tests", "fixtures");
const REPORTS = join(ROOT, "tests", "reports");

const argv = process.argv.slice(2);
function argValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const BASE = argValue("--base") || "http://127.0.0.1:5000";
const RUNS = Number(argValue("--runs")) || 3;
const TURNS = Number(argValue("--turns")) || 5;

// ==================== HTTP 客户端（独立会话） ====================

function createClient() {
  const cookies = new Map();
  function cookieHeader() {
    if (cookies.size === 0) return undefined;
    return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  function store(response) {
    for (const line of response.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(";");
      const i = pair.indexOf("=");
      if (i > 0) cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  async function request(path, options = {}) {
    const headers = { ...(options.headers ?? {}) };
    const ch = cookieHeader();
    if (ch) headers.cookie = ch;
    const response = await fetch(`${BASE}${path}`, { ...options, headers, redirect: "manual" });
    store(response);
    return response;
  }
  async function json(path, options = {}) {
    const r = await request(path, options);
    let data = null;
    try {
      data = await r.json();
    } catch {
      data = null;
    }
    return { status: r.status, data };
  }
  return {
    request,
    json,
    post: (path, body) =>
      json(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    async upload(name) {
      const buf = readFileSync(join(FIXTURES, name));
      const form = new FormData();
      form.append("file", new Blob([buf]), name);
      const r = await request("/api/upload", { method: "POST", body: form });
      let data = null;
      try {
        data = await r.json();
      } catch {
        data = null;
      }
      return { status: r.status, data };
    },
  };
}

/** 计时包装：返回结果 + 耗时（毫秒） */
async function timed(fn) {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { ok: true, value, ms: Date.now() - t0 };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), ms: Date.now() - t0 };
  }
}

const problems = [];
function noteProblem(where, detail) {
  problems.push({ where, detail });
  console.log(`      ⚠ ${where}: ${detail}`);
}

// ==================== 单轮全链路 ====================

async function runOnce(index) {
  console.log(`\n${"─".repeat(56)}\n第 ${index} 轮`);
  const client = createClient();
  const steps = [];

  // ---- 1. 首页 ----
  {
    const r = await timed(async () => {
      const res = await client.request("/");
      const html = await res.text();
      return { status: res.status, bytes: html.length };
    });
    steps.push({ step: "首页加载", ms: r.ms, status: r.value?.status, bytes: r.value?.bytes });
    console.log(`  [1/6] 首页          ${r.ms}ms  HTTP ${r.value?.status}  ${r.value?.bytes} 字节`);
    if (!r.ok || r.value?.status !== 200) noteProblem("首页", r.error ?? `HTTP ${r.value?.status}`);
  }

  // ---- 2. 岗位/看板接口（看板的数据来源）----
  {
    const r = await timed(() => client.json("/api/roles"));
    const subs = (r.value?.data?.categories ?? []).flatMap((c) => c.subcategories);
    steps.push({ step: "看板/岗位数据", ms: r.ms, subcategories: subs.length, version: r.value?.data?.meta?.version });
    console.log(`  [2/6] 岗位数据      ${r.ms}ms  ${subs.length} 个子类  v${r.value?.data?.meta?.version}`);
    if (!r.ok || !subs.length) noteProblem("岗位数据", r.error ?? "返回为空");
  }

  // ---- 3. 简历上传 + 诊断 ----
  {
    const up = await timed(() => client.upload("resume_weak.docx"));
    if (!up.ok || up.value.status !== 200) {
      noteProblem("简历上传", up.error ?? `HTTP ${up.value?.status}`);
      steps.push({ step: "简历上传", ms: up.ms, ok: false });
    } else {
      console.log(`  [3/6] 简历上传      ${up.ms}ms  ${up.value.data.fileType} ${up.value.data.rawText.length} 字`);
      const raw = up.value.data.rawText;

      const diag = await timed(() =>
        client.post("/api/resume/diagnose", { rawText: raw, targetRole: "cs-it.frontend" })
      );
      const d = diag.value?.data;
      steps.push({
        step: "简历诊断",
        ms: diag.ms,
        status: diag.value?.status,
        source: d?.source,
        fixes: d?.fixes?.length ?? 0,
        inputTokens: d?.usage?.inputTokens ?? 0,
        outputTokens: d?.usage?.outputTokens ?? 0,
        cost: d?.usage?.cost ?? 0,
      });
      console.log(
        `  [3/6] 简历诊断      ${diag.ms}ms  source=${d?.source}  ${d?.fixes?.length ?? 0} 条建议  ` +
          `¥${d?.usage?.cost ?? 0}  (${d?.usage?.inputTokens ?? 0}+${d?.usage?.outputTokens ?? 0} token)`
      );
      if (!diag.ok || diag.value?.status !== 200 || !d?.fixes?.length) {
        noteProblem("简历诊断", diag.error ?? `HTTP ${diag.value?.status}`);
      }
    }
  }

  // ---- 4. 追问链 ----
  {
    const r = await timed(() =>
      client.post("/api/interview/chain", { role: "edu-research.k12-teacher" })
    );
    const d = r.value?.data;
    steps.push({
      step: "岗位追问链",
      ms: r.ms,
      status: r.value?.status,
      source: d?.source,
      dimensions: d?.dimensions?.length ?? 0,
      tracks: (d?.dimensions ?? []).reduce((n, x) => n + (x.tracks?.length ?? 0), 0),
      inputTokens: d?.usage?.inputTokens ?? 0,
      outputTokens: d?.usage?.outputTokens ?? 0,
      cost: d?.usage?.cost ?? 0,
    });
    console.log(
      `  [4/6] 追问链        ${r.ms}ms  source=${d?.source}  ${d?.dimensions?.length ?? 0} 维度  ¥${d?.usage?.cost ?? 0}`
    );
    if (!r.ok || r.value?.status !== 200 || (d?.dimensions?.length ?? 0) !== 4) {
      noteProblem("追问链", r.error ?? `HTTP ${r.value?.status} 维度数 ${d?.dimensions?.length}`);
    }
  }

  // ---- 5. 面试：创建 → 多轮问答 ----
  let interviewId = null;
  {
    const created = await timed(() =>
      client.post("/api/interview/create", {
        config: { role: "中小学教师", company: "generic", mode: "normal", stressMode: false, stageIndex: 0 },
      })
    );
    interviewId = created.value?.data?.interviewId;
    if (!interviewId) {
      noteProblem("创建面试", created.error ?? `HTTP ${created.value?.status}`);
      steps.push({ step: "创建面试", ms: created.ms, ok: false });
    } else {
      steps.push({ step: "创建面试", ms: created.ms, ok: true });
      console.log(`  [5/6] 创建面试      ${created.ms}ms  id=${interviewId.slice(0, 8)}`);

      // 多轮问答：每轮把上一轮助手的文本当作上下文继续
      const messages = [
        { id: "m1", role: "user", parts: [{ type: "text", text: "请开始面试，先出第一道题。" }] },
      ];
      const turnTimings = [];
      let firstQuestion = "";

      for (let t = 1; t <= TURNS; t++) {
        const turn = await timed(async () => {
          const res = await client.request("/api/chat", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              messages,
              config: { role: "中小学教师", company: "generic", currentStage: 0 },
              mode: "normal",
              interviewId,
            }),
          });
          const text = await res.text();
          return { status: res.status, text };
        });
        turnTimings.push(turn.ms);

        if (!turn.ok || turn.value.status !== 200) {
          noteProblem(`面试第 ${t} 轮`, turn.error ?? `HTTP ${turn.value?.status}`);
          break;
        }

        // 从 SSE 里粗略提取助手文本，作为下一轮的上下文
        const chunks = [...turn.value.text.matchAll(/"delta":"((?:[^"\\]|\\.)*)"/g)].map((m) =>
          m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
        );
        const assistantText = chunks.join("").slice(0, 600);
        if (t === 1) firstQuestion = assistantText;

        messages.push({ id: `a${t}`, role: "assistant", parts: [{ type: "text", text: assistantText }] });
        messages.push({
          id: `u${t + 1}`,
          role: "user",
          parts: [{ type: "text", text: "我会先明确教学目标，再设计活动和评价方式，注意照顾不同水平的学生。" }],
        });

        console.log(`        第 ${t} 轮问答   ${turn.ms}ms  ${turn.value.text.length} 字节`);
      }

      steps.push({
        step: "面试多轮问答",
        turns: turnTimings.length,
        totalMs: turnTimings.reduce((a, b) => a + b, 0),
        avgMs: turnTimings.length ? Math.round(turnTimings.reduce((a, b) => a + b, 0) / turnTimings.length) : 0,
        gotQuestion: firstQuestion.length > 0,
      });

      if (turnTimings.length < TURNS) {
        noteProblem("面试问答", `只完成 ${turnTimings.length}/${TURNS} 轮`);
      }
    }
  }

  // ---- 6. 复盘报告 ----
  if (interviewId) {
    const r = await timed(() => client.post(`/api/interview/review/${interviewId}`, {}));
    const report = r.value?.data?.report;
    steps.push({
      step: "复盘报告",
      ms: r.ms,
      status: r.value?.status,
      ok: Boolean(report),
      overallScore: report?.overallScore,
    });
    console.log(
      `  [6/6] 复盘报告      ${r.ms}ms  HTTP ${r.value?.status}  ${report ? `综合得分 ${report.overallScore}` : "未生成"}`
    );
    if (!r.ok || r.value?.status !== 200 || !report) {
      noteProblem("复盘报告", r.error ?? `HTTP ${r.value?.status}`);
    }
  } else {
    steps.push({ step: "复盘报告", ok: false, skipped: true });
    console.log("  [6/6] 复盘报告      跳过（面试未创建成功）");
  }

  return { run: index, steps };
}

// ==================== 主流程 ====================

console.log("职镜 OPC · 全链路压测");
console.log("═".repeat(56));
console.log(`  目标服务 : ${BASE}`);
console.log(`  轮次     : ${RUNS} 轮 × 每轮 ${TURNS} 个问答`);
console.log(`  提醒     : 会真实调用 AI 并产生费用`);

// 服务可达性
try {
  const probe = await fetch(BASE, { signal: AbortSignal.timeout(8000) });
  if (probe.status >= 500) throw new Error(`HTTP ${probe.status}`);
} catch (error) {
  console.error(`\n✗ 服务不可达：${BASE}（${error.message}）请先跑 pnpm dev`);
  process.exit(1);
}

const runs = [];
for (let i = 1; i <= RUNS; i++) {
  runs.push(await runOnce(i));
}

// ==================== 汇总 ====================

const allSteps = runs.flatMap((r) => r.steps);
function sum(stepName, field) {
  const vals = allSteps
    .filter((s) => s.step === stepName && typeof s[field] === "number")
    .map((s) => s[field]);
  // 注意别写成 reducer(vals)：那会把整个数组当成累加初值，
  // 结果是 "[0.04] + undefined" 这种字符串拼接，最后算出 NaN。
  return vals.length ? vals.reduce((a, b) => a + b, 0) : 0;
}
function avg(stepName, field) {
  const vals = allSteps.filter((s) => s.step === stepName && typeof s[field] === "number").map((s) => s[field]);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
}

const diagSteps = allSteps.filter((s) => s.step === "简历诊断");
const chainSteps = allSteps.filter((s) => s.step === "岗位追问链");
const chatSteps = allSteps.filter((s) => s.step === "面试多轮问答");

const summary = {
  base: BASE,
  startedAt: new Date().toISOString(),
  runs: RUNS,
  turnsPerRun: TURNS,
  problems,
  metrics: {
    totalCost: Math.round((sum("简历诊断", "cost") + sum("岗位追问链", "cost")) * 10000) / 10000,
    avgDiagnoseMs: avg("简历诊断", "ms"),
    avgDiagnoseFixes: diagSteps.length ? Math.round(diagSteps.reduce((n, s) => n + s.fixes, 0) / diagSteps.length) : 0,
    avgChainMs: avg("岗位追问链", "ms"),
    avgChatTurnMs: chatSteps.length
      ? Math.round(chatSteps.reduce((n, s) => n + s.avgMs, 0) / chatSteps.length)
      : 0,
    roleDataMs: avg("看板/岗位数据", "ms"),
    aiSourceCount: diagSteps.filter((s) => s.source === "ai").length,
    fallbackSourceCount: diagSteps.filter((s) => s.source === "fallback").length,
    totalDeliveries: diagSteps.length + chainSteps.length + chatSteps.length,
  },
  rawRuns: runs,
};

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
if (!existsSync(REPORTS)) mkdirSync(REPORTS, { recursive: true });
writeFileSync(join(REPORTS, `loadtest-${stamp}.json`), JSON.stringify(summary, null, 2), "utf8");

const m = summary.metrics;
const md = `# 全链路压测记录

- 时间：${summary.startedAt}
- 目标：${BASE}
- 轮次：${RUNS} 轮 × 每轮 ${TURNS} 个问答

## 结果概览

| 指标 | 数值 |
|---|---|
| 全链路轮次 | ${RUNS} |
| 中断 / 报错 | ${problems.length} |
| 简历诊断平均耗时 | ${m.avgDiagnoseMs} ms |
| 简历诊断平均建议条数 | ${m.avgDiagnoseFixes} 条 |
| 岗位追问链平均耗时 | ${m.avgChainMs} ms |
| 面试单轮问答平均耗时 | ${m.avgChatTurnMs} ms |
| 岗位数据查询平均耗时 | ${m.roleDataMs} ms |
| 单轮可计量 AI 成本 | ¥${m.totalCost}（诊断 + 追问链） |
| AI 路径 / 离线回退 | ${m.aiSourceCount} / ${m.fallbackSourceCount} |

## 各轮明细

${runs
  .map(
    (r) => `### 第 ${r.run} 轮

| 环节 | 耗时 | 状态 | 备注 |
|---|---|---|---|
${r.steps
  .map((s) => {
    const msText = s.ms ?? (s.avgMs !== undefined ? `平均 ${s.avgMs}` : "-");
    const note = s.source
      ? `source=${s.source}${s.fixes !== undefined ? ` · ${s.fixes} 条建议` : ""}${s.dimensions !== undefined ? ` · ${s.dimensions} 维度` : ""}${s.cost ? ` · ¥${s.cost}` : ""}`
      : s.status
        ? `HTTP ${s.status}`
        : (s.turns ? `${s.turns} 轮 · 平均 ${s.avgMs}ms` : "");
    const ok = s.ok === false || (s.status && s.status !== 200) ? "✗" : "✓";
    return `| ${s.step} | ${msText} ms | ${ok} | ${note} |`;
  })
  .join("\n")}
`
  )
  .join("\n")}

## 发现的问题

${problems.length === 0 ? "无 —— 全链路无中断、无报错、无超时。" : problems.map((p) => `- **${p.where}**：${p.detail}`).join("\n")}
`;

writeFileSync(join(REPORTS, `loadtest-${stamp}.md`), md, "utf8");

console.log(`\n${"═".repeat(56)}`);
console.log(`  中断 / 报错 : ${problems.length}`);
console.log(`  诊断平均    : ${m.avgDiagnoseMs}ms · ${m.avgDiagnoseFixes} 条建议`);
console.log(`  追问链平均  : ${m.avgChainMs}ms`);
console.log(`  面试单轮平均: ${m.avgChatTurnMs}ms`);
console.log(`  可计量成本  : ¥${m.totalCost}`);
console.log(`  AI / 离线   : ${m.aiSourceCount} / ${m.fallbackSourceCount}`);
console.log(`\n报告已写入 tests/reports/loadtest-${stamp}.md`);

process.exit(problems.length > 0 ? 1 : 0);
