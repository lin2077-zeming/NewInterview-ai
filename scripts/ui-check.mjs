#!/usr/bin/env node
/**
 * 界面交互检查（可选）。
 *
 * 用法：
 *   pnpm ui-check
 *   pnpm ui-check -- --base http://127.0.0.1:5000
 *
 * 为什么单独成脚本：它依赖 Playwright，而 Playwright 不是本项目的依赖
 * （安装体积大、还要下浏览器）。所以设计成**能用就跑、不能用就跳过**，
 * 不阻塞 `pnpm regression` 那条无依赖的主链路。
 *
 * 覆盖的是 HTTP 层测不到的问题 —— 纯前端交互逻辑的 bug。
 * 起因：简历诊断的「不指定」复选框曾因为缺少取消分支，导致下拉永远解不开，
 * 用户根本没法选具体岗位。这类 bug 只能靠真实浏览器点出来。
 */

import { readFileSync } from "node:fs";
const argv = process.argv.slice(2);
function argValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const BASE = argValue("--base") || "http://127.0.0.1:5000";

// ---------- 解析 Playwright（项目内 → 托管环境 → 放弃） ----------
async function loadPlaywright() {
  /** CJS 模块用动态 import 载入时，导出可能挂在 default 上，两种形状都要认 */
  function normalize(mod) {
    if (!mod) return null;
    if (mod.chromium) return mod;
    if (mod.default?.chromium) return mod.default;
    return null;
  }

  try {
    const mod = normalize(await import("playwright"));
    if (mod) return mod;
  } catch {
    // 项目内没装，走下面的兜底
  }

  const candidates = [
    "C:/Users/LinZeming/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js",
    "C:/Users/LinZeming/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs",
  ];
  for (const path of candidates) {
    try {
      const mod = normalize(await import(`file:///${path}`));
      if (mod) return mod;
    } catch {
      // 试下一个
    }
  }
  return null;
}

const playwright = await loadPlaywright();

if (!playwright) {
  console.log("界面交互检查：SKIP");
  console.log("  未找到 Playwright —— 该检查为可选项，不影响主回归。");
  console.log("  需要时安装：pnpm add -D playwright && npx playwright install msedge");
  process.exit(0);
}

// ---------- 迷你断言 ----------
const results = [];
function expect(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? `  ${detail}` : ""}`);
}

// ---------- 主流程 ----------
let browser;
try {
  browser = await playwright.chromium.launch({ channel: "msedge" });
} catch (error) {
  console.log("界面交互检查：SKIP");
  console.log(`  启动浏览器失败（${error.message.split("\n")[0]}）。`);
  console.log("  需要时执行：npx playwright install msedge");
  process.exit(0);
}

const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

// 反馈数据基线（见文末的污染护栏）
let feedbackCountBefore = null;
{
  const token =
    process.env.ADMIN_TOKEN?.trim() ||
    (() => {
      try {
        const line = readFileSync(".env.local", "utf8")
          .split(/\r?\n/)
          .find((l) => l.startsWith("ADMIN_TOKEN="));
        return line ? line.slice("ADMIN_TOKEN=".length).trim() : null;
      } catch {
        return null;
      }
    })();
  if (token) {
    try {
      const r = await fetch(`${BASE}/api/feedback`, { headers: { authorization: `Bearer ${token}` } });
      if (r.ok) feedbackCountBefore = (await r.json())?.summary?.total ?? null;
    } catch {
      // 取不到就跳过护栏
    }
  }
}
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(`console: ${m.text()}`);
});

console.log("界面交互检查");
console.log("─".repeat(52));

// ========== 1. 简历诊断：两级选岗 + 「不指定」可取消 ==========
console.log("\n1. 简历诊断 · 两级选岗（回归：曾因复选框缺取消分支而锁死）");
{
  await page.goto(`${BASE}/resume`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelectorAll("#resume-category option").length > 5,
    { timeout: 30000 }
  );

  const cb = 'input[type="checkbox"]';
  const cascade = "#resume-category";
  const sub = "#resume-sub";

  expect("默认勾选「不指定」", await page.isChecked(cb));
  expect("默认状态下下拉被禁用（不指定时不该能选）", await page.$eval(cascade, (e) => e.disabled));

  await page.uncheck(cb);
  await page.waitForTimeout(300);
  const unlocked = !(await page.$eval(cascade, (e) => e.disabled));
  expect("取消勾选后大类下拉解锁", unlocked, unlocked ? "" : "❌ 下拉仍被锁死 —— 用户无法选岗位");

  if (unlocked) {
    await page.selectOption(cascade, "edu-research");
    await page.waitForTimeout(300);
    const subs = await page.$$eval(`${sub} option`, (els) => els.map((e) => e.textContent.trim()));
    expect("选择大类后列出子类", subs.length > 1, subs.slice(1, 4).join(" / "));

    await page.selectOption(sub, "edu-research.k12-teacher");
    await page.waitForTimeout(300);
    expect("能选中具体岗位", (await page.$eval(sub, (e) => e.value)) === "edu-research.k12-teacher");

    await page.check(cb);
    await page.waitForTimeout(300);
    expect(
      "重新勾选「不指定」后清空已选",
      (await page.$eval(sub, (e) => e.value)) === "" &&
        (await page.$eval(cascade, (e) => e.value)) === ""
    );

    await page.uncheck(cb);
    await page.waitForTimeout(300);
    expect("再次取消勾选仍可解锁（可反复切换）", !(await page.$eval(cascade, (e) => e.disabled)));
  }
}

// ========== 2. 追问链：默认不预选岗位，未选时禁止生成 ==========
console.log("\n2. 岗位追问链");
{
  await page.goto(`${BASE}/chain`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelectorAll("#chain-category option").length > 5,
    { timeout: 30000 }
  );

  expect("默认不预选岗位（避免对非计算机专业有偏）", (await page.$eval("#chain-sub", (e) => e.value)) === "");

  const disabled = await page.$eval('button:has-text("生成追问链")', (e) => e.disabled);
  expect("未选岗位时禁止生成", disabled);

  await page.selectOption("#chain-category", "law-public");
  await page.waitForTimeout(300);
  await page.selectOption("#chain-sub", "law-public.lawyer-legal");
  await page.waitForTimeout(300);
  expect(
    "选中岗位后允许生成",
    !(await page.$eval('button:has-text("生成追问链")', (e) => e.disabled))
  );

  await page.selectOption("#chain-category", "finance-econ");
  await page.waitForTimeout(300);
  expect("切换大类会清空子类选择", (await page.$eval("#chain-sub", (e) => e.value)) === "");
}

// ========== 3. 求职规划：岗位体系已换成两级分类 ==========
console.log("\n3. 求职规划 · 两级选岗（回归：曾只支持 5 个计算机岗位）");
{
  await page.goto(`${BASE}/career`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelectorAll("#career-category option").length > 5,
    { timeout: 30000 }
  );

  const catCount = (await page.$$eval("#career-category option", (els) => els.length)) - 1;
  expect("一级大类 ≥ 11（不再是 5 个计算机岗位）", catCount >= 11, `${catCount} 个大类`);
  expect("默认不预选岗位", (await page.$eval("#career-sub", (e) => e.value)) === "");

  const analyzeBtn = 'button:has-text("分析")';
  expect("未选岗位时禁止分析", await page.$eval(analyzeBtn, (e) => e.disabled));

  await page.selectOption("#career-category", "edu-research");
  await page.waitForTimeout(300);
  await page.selectOption("#career-sub", "edu-research.k12-teacher");
  await page.waitForTimeout(300);

  const btnText = (await page.textContent(analyzeBtn)).trim();
  expect("按钮文案带出所选岗位名", btnText.includes("中小学教师"), btnText);
  expect("选中岗位后允许分析", !(await page.$eval(analyzeBtn, (e) => e.disabled)));

  await page.selectOption("#career-category", "finance-econ");
  await page.waitForTimeout(300);
  expect("切换大类清空子类", (await page.$eval("#career-sub", (e) => e.value)) === "");
}

// ========== 4. OPC 看板：右下角入口 + 口令门 ==========
console.log("\n4. OPC 运营看板（内部工具）");
{
  const PASSWORD = process.env.STUDIO_PASSWORD?.trim() || "Mind@123";

  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(600);

  const entry = page.locator('a[aria-label="OPC 运营看板"]');
  expect("首页有右下角入口", (await entry.count()) === 1);

  const box = await entry.boundingBox();
  const vp = page.viewportSize();
  expect(
    "入口位于右下角",
    Boolean(box) && vp.width - (box.x + box.width) < 60 && vp.height - (box.y + box.height) < 60,
    box ? `右下角 ${Math.round(vp.width - box.x - box.width)}px / ${Math.round(vp.height - box.y - box.height)}px` : "找不到元素"
  );

  const heroBtns = await page.$$eval("section:first-of-type a button", (els) =>
    els.map((e) => e.textContent.trim())
  );
  expect("主入口列表里没有看板", !heroBtns.some((t) => t.includes("运营看板")));

  // 未登录 → 口令门
  await page.goto(`${BASE}/studio`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(500);
  expect("直接访问被口令门拦住", (await page.textContent("body")).includes("访问口令"));

  // 错误口令
  await page.fill("#studio-password", "wrong-password");
  await page.click('button:has-text("进入看板")');
  await page.waitForTimeout(1200);
  expect("错误口令被拒绝", (await page.textContent("body")).includes("口令不正确"));

  // 上面这一步是**故意**用错口令，浏览器必然会为那次 401 记一条控制台错误。
  // 那是预期的，不是缺陷 —— 清掉它，免得污染后面的「零控制台错误」门禁。
  consoleErrors.length = 0;

  // 正确口令
  await page.fill("#studio-password", PASSWORD);
  await page.click('button:has-text("进入看板")');
  await page.waitForTimeout(3500);
  const unlocked = await page.textContent("body");
  expect("正确口令进入看板", unlocked.includes("运营设置") || unlocked.includes("岗位数据"));
  expect("口令门已消失", !unlocked.includes("进入看板"));
}

// ========== 5. 题库练习：无 AI 也能用 ==========
console.log("\n5. 题库练习（离线模式的主要载体）");
{
  await page.goto(`${BASE}/practice`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelectorAll("#practice-category option").length > 5,
    { timeout: 30000 }
  );

  await page.selectOption("#practice-category", "med-life");
  await page.waitForTimeout(300);
  await page.selectOption("#practice-sub", "med-life.nursing");
  await page.waitForTimeout(1800);

  const text = await page.textContent("body");
  expect("加载出该岗位题目", /共 \d+ 题/.test(text), (text.match(/共 \d+ 题[^，]*/) ?? [""])[0]);
  expect("展示 4 个考察维度", text.includes("考察维度"));

  const toggles = await page.$$('button:has-text("自测参考")');
  expect("每题可展开自测参考", toggles.length > 0, `${toggles.length} 个可展开`);
}

// ========== 6. 全局返回键（固定路径，不跟随浏览历史）==========
console.log("\n6. 全局返回键（固定路径）");
{
  const backBtn = 'button[data-testid="nav-back"]';

  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(500);
  expect("首页不显示返回键（无处可返回）", (await page.locator(backBtn).count()) === 0);
  expect(
    "logo 带「返回首页」提示",
    (await page.locator('a[aria-label="返回首页"]').count()) === 1
  );

  // ── 模块页 → 主界面 ──
  const toHome = [
    ["/resume", "简历诊断"], ["/chain", "岗位追问链"], ["/practice", "题库练习"],
    ["/career", "求职规划"], ["/studio", "运营看板"], ["/interview/new", "创建新面试"],
    ["/feedback", "试用反馈"], ["/profile", "个人信息"],
  ];
  let wrong = [];
  for (const [path, name] of toHome) {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(400);
    const btn = page.locator(backBtn);
    if ((await btn.count()) === 0) {
      wrong.push(`${name}(无按钮)`);
      continue;
    }
    await btn.click();
    await page.waitForTimeout(1200);
    if (new URL(page.url()).pathname !== "/") wrong.push(`${name}→${new URL(page.url()).pathname}`);
  }
  expect(
    "模块页返回键均回主界面",
    wrong.length === 0,
    wrong.join(" / ") || `${toHome.length} 个页面全部正确`
  );

  // ── 面试线 → 创建新面试 ──
  {
    const ctxI = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pI = await ctxI.newPage();
    // 造一场面试，拿到「面试进行中」页面
    await pI.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const created = await pI.evaluate(async (base) => {
      const r = await fetch(base + "/api/interview/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          config: { role: "后端开发工程师", company: "generic", mode: "normal", stressMode: false, stageIndex: 0 },
        }),
      });
      return (await r.json().catch(() => ({})))?.interviewId ?? null;
    }, BASE);

    if (!created) {
      expect("面试线返回键：可创建面试（前置条件）", false, "创建失败");
    } else {
      // 面试页有持续连接，networkidle 永远不会满足，用 domcontentloaded
      await pI.goto(`${BASE}/interview/${created}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await pI.waitForTimeout(2500);
      // 面试底栏：模式切换按钮已移除；压力面文案说明开启后的效果
      const interviewText = await pI.evaluate(() => document.body.innerText);
      expect("面试底栏已无「切换为候选人」", !interviewText.includes("切换为候选人"));
      expect("面试底栏已无「切换为面试官」", !interviewText.includes("切换为面试官"));
      expect(
        "压力面按钮文案为「后续 AI 面试官会更主动追问」",
        interviewText.includes("后续 AI 面试官会更主动追问")
      );

      // 切压力面不能重挂载对话区（key 里带 mode/stressMode 会整棵卸载重建 → 对话丢失）
      // 在对话输入框上做个标记，切换后标记应仍在：节点没被重建即证明未重挂载
      await pI.evaluate(() => {
        const el = document.querySelector("#chat-input");
        if (el) el.dataset.remountProbe = "alive";
      });
      await pI.click('button:has-text("后续 AI 面试官会更主动追问")');
      await pI.waitForTimeout(1800);
      const survived = await pI.evaluate(
        () => document.querySelector("#chat-input")?.dataset.remountProbe === "alive"
      );
      expect("切换压力面未重挂载对话区（会话内容不会丢）", survived, survived ? "节点存活" : "❌ 被重建");
      expect("切换后按钮进入开启态", (await pI.evaluate(() => document.body.innerText)).includes("已开启"));

      await pI.click(backBtn);
      await pI.waitForTimeout(1200);
      expect("面试进行中 → 创建新面试", new URL(pI.url()).pathname === "/interview/new", pI.url().replace(BASE, ""));
    }

    await pI.goto(`${BASE}/interview/reviews`, { waitUntil: "networkidle", timeout: 60000 });
    await pI.waitForTimeout(600);
    await pI.click(backBtn);
    await pI.waitForTimeout(1200);
    expect("历史复盘列表 → 创建新面试", new URL(pI.url()).pathname === "/interview/new", pI.url().replace(BASE, ""));

    await ctxI.close();
  }

  // ── 关键：返回目标与"来路"无关（这正是本次改动的目的）──
  // 先绕去简历诊断，再进反馈表；旧的"跟随历史"会回简历诊断，固定路径应回主界面
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.goto(`${BASE}/resume`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/feedback?module=简历诊断`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(700);
  await page.click(backBtn);
  await page.waitForTimeout(1200);
  expect(
    "返回目标与来路无关：反馈页 → 主界面（不是简历诊断/个人信息）",
    new URL(page.url()).pathname === "/",
    page.url().replace(BASE, "")
  );

  // ── 按钮文案应写明目的地 ──
  await page.goto(`${BASE}/practice`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(500);
  const practiceLabel = await page.locator(backBtn).getAttribute("aria-label");
  expect("返回键写明目的地", practiceLabel === "返回主界面", practiceLabel ?? "(空)");

  await page.goto(`${BASE}/interview/new`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(500);
  expect(
    "创建新面试的返回键指向主界面",
    (await page.locator(backBtn).getAttribute("aria-label")) === "返回主界面"
  );
}

// ========== 7. 结果页快捷反馈条（需 --ai，会调 AI）==========
//
// 这一组要真的生成 AI 结果才能验证"反馈条出现在结果旁边"，
// 因此**默认跳过**：它既慢又要花钱，不该拖累常规检查。
// 开启方式：pnpm ui-check -- --ai
//
// 刻意只验证"是否出现"，**不点击提交** —— 点了会在 iterations 表里留下
// 一条非真实用户的记录，而那张表的数据要用于赛事材料，不能被测试污染。
if (argv.includes("--ai")) {
  console.log("\n7. 结果页快捷反馈条（--ai）");

  const RESUME_TEXT = [
    "张三",
    "教育背景：中山大学 计算机科学与技术 本科 2022-2026",
    "实习经历：2025年暑期在某互联网公司实习，参与订单系统后端开发",
    "项目经历：使用 Java 与 Spring Boot 开发校园二手交易平台后端，熟悉 MySQL 索引与 Redis 缓存",
    "技能：Java、Spring Boot、MySQL、Redis、Docker、Git",
    "邮箱：zhangsan@example.com",
  ].join("\n");

  const promptShown = async () => {
    const el = page.locator("text=这份结果对你有帮助吗？");
    return (await el.count()) > 0 && (await el.first().isVisible());
  };

  // --- 简历诊断 ---
  {
    await page.goto(`${BASE}/resume`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll("#resume-category option").length > 5, { timeout: 30000 });
    expect("简历诊断 · 出结果前不显示反馈条", !(await promptShown()));

    await page.click('button:has-text("直接把简历文字粘贴进来")');
    await page.waitForTimeout(300);
    await page.fill("textarea", RESUME_TEXT);
    await page.click('button:has-text("生成修改清单")');
    await page.waitForSelector("text=诊断结论", { timeout: 120000 });
    await page.waitForTimeout(1000);
    expect("简历诊断 · 出结果后显示反馈条", await promptShown());
  }

  // --- 岗位追问链 ---
  // 等待条件用结果树里的层级标签：页面说明文字里也有「及格线」，会误判
  {
    await page.goto(`${BASE}/chain`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll("#chain-category option").length > 5, { timeout: 30000 });
    expect("岗位追问链 · 出结果前不显示反馈条", !(await promptShown()));

    await page.selectOption("#chain-category", "finance-econ");
    await page.waitForTimeout(300);
    await page.selectOption("#chain-sub", "finance-econ.accounting-audit");
    await page.waitForTimeout(300);
    await page.click('button:has-text("生成追问链")');
    await page.waitForSelector("text=边界 · 反例", { timeout: 120000 });
    await page.waitForTimeout(1000);
    expect("岗位追问链 · 出结果后显示反馈条", await promptShown());
  }

  // --- 求职规划 ---
  {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
    await page.evaluate((p) => localStorage.setItem("zhijing-opc-career-profile", JSON.stringify(p)), {
      educationStage: "本科在读", major: "计算机科学与技术", experienceLevel: "有实习经历",
      currentStatus: "大四正在求职", targetTimeline: "3-6个月", targetCity: "广州",
      preference: "互联网公司", dailyStudyTime: "每天3小时", selfRatedStrengths: "编程与调试",
      painPoints: "不清楚技能差距", constraints: "要兼顾毕业设计",
    });
    await page.goto(`${BASE}/career`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll("#career-category option").length > 5, { timeout: 30000 });
    expect("求职规划 · 出结果前不显示反馈条", !(await promptShown()));

    await page.setInputFiles('input[type="file"]', "tests/fixtures/resume_weak.txt");
    await page.waitForTimeout(2500);
    await page.selectOption("#career-category", "cs-it");
    await page.waitForTimeout(300);
    await page.selectOption("#career-sub", "cs-it.backend");
    await page.waitForTimeout(300);
    await page.click('button:has-text("分析")');
    await page.waitForSelector("text=分析结果", { timeout: 150000 });
    await page.waitForTimeout(1200);
    expect("求职规划 · 出结果后显示反馈条", await promptShown());
    // 这条曾经真的崩过整页：AI 返回的资源 type 意外时 ResourceCard 抛
    // "Element type is invalid"，页面变成 "This page couldn't load"
    expect("求职规划 · 页面未崩溃", !(await page.textContent("body")).includes("This page couldn"));
  }

  // --- 面试复盘 ---
  // 复盘页需要先有一场面试，所以先用接口造数据（create → 5 轮问答 → 生成复盘），
  // 再用浏览器验证位置。这一段最贵（约 7 次 AI 调用），但复盘页版式最复杂，
  // 反馈条的位置最容易出问题，值得覆盖。
  {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const setup = await page.evaluate(async (base) => {
      const post = async (url, body) => {
        const r = await fetch(base + url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        return { status: r.status, data: await r.json().catch(() => null) };
      };
      const created = await post("/api/interview/create", {
        config: { role: "后端开发工程师", company: "generic", mode: "normal", stressMode: false, stageIndex: 0 },
      });
      const id = created.data?.interviewId;
      if (!id) return { error: `创建面试失败 HTTP ${created.status}` };

      const messages = [{ id: "m1", role: "user", parts: [{ type: "text", text: "请开始面试" }] }];
      for (let t = 1; t <= 5; t++) {
        const r = await fetch(base + "/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages,
            config: { role: "后端开发工程师", company: "generic", currentStage: 0 },
            mode: "normal",
            interviewId: id,
          }),
        });
        if (!r.ok) break;
        const text = await r.text();
        const delta = [...text.matchAll(/"delta":"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\n/g, "\n"));
        const assistant = delta.join("").slice(0, 400);
        messages.push({ id: `a${t}`, role: "assistant", parts: [{ type: "text", text: assistant }] });
        messages.push({ id: `u${t + 1}`, role: "user", parts: [{ type: "text", text: "我会先梳理需求边界，再设计表结构与接口，注意索引与缓存一致性。" }] });
      }
      const review = await post(`/api/interview/review/${id}`, {});
      return {
        id,
        hasReport: Boolean(review.data?.report),
        reviewStatus: review.status,
        role: "后端开发工程师",
      };
    }, BASE);

    if (!setup.id || !setup.hasReport) {
      expect("面试复盘 · 复盘报告已生成（前置条件）", false, JSON.stringify(setup));
    } else {
      await page.goto(`${BASE}/interview/review/${setup.id}`, { waitUntil: "networkidle", timeout: 90000 });
      await page.waitForTimeout(2000);

      const shown = await promptShown();
      expect("面试复盘 · 显示反馈条", shown);

      const order = await page.evaluate(() => {
        const body = document.body.innerText;
        return { title: body.indexOf("复盘报告"), prompt: body.indexOf("这份结果对你有帮助吗") };
      });
      expect("面试复盘 · 反馈条位于报告内容之后", order.prompt > order.title && order.title >= 0,
        `标题@${order.title} 反馈@${order.prompt}`);

      // 复盘是面试终点：返回键应回到「创建新面试」，而不是重新进入已结束的面试
      await page.click('button[data-testid="nav-back"]');
      await page.waitForTimeout(1500);
      expect(
        "面试复盘 · 返回键回到创建新面试",
        new URL(page.url()).pathname === "/interview/new",
        page.url().replace(BASE, "")
      );

      // 历史列表：本会话已有复盘，应能看到自己那份
      await page.goto(`${BASE}/interview/reviews`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(800);
      const mine = await page.evaluate(() => document.body.innerText);
      expect("复盘历史 · 本会话能看到自己的报告", mine.includes(setup.role), mine.includes("共 1 份报告") ? "共 1 份" : "");

      // 用户隔离：另开一个全新会话（独立 cookie），**不该看到上面那份报告**。
      // 复用已有数据、不额外调 AI。
      const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const pB = await ctxB.newPage();
      await pB.goto(`${BASE}/interview/reviews`, { waitUntil: "networkidle", timeout: 60000 });
      await pB.waitForTimeout(700);
      const other = await pB.evaluate(() => document.body.innerText);
      expect(
        "复盘历史 · 另一会话看不到本会话的报告（用户隔离）",
        !other.includes(setup.role),
        other.includes(setup.role) ? "❌ 越权可见" : "隔离正常"
      );
      await ctxB.close();
    }
  }
}

// ========== 反馈数据污染护栏 ==========
//
// `iterations` 表的数据要用于赛事材料，**不得混入测试产生的记录**。
// 这个检查在运行前后各读一次样本数，涨了就判定失败 —— 比靠人记得清理可靠。
//
// 需要 ADMIN_TOKEN（读环境变量，或从 .env.local 兜底读）。
// 拿不到令牌就跳过并说明，不阻塞检查。
{
  const readToken = () => {
    if (process.env.ADMIN_TOKEN?.trim()) return process.env.ADMIN_TOKEN.trim();
    try {
      const raw = readFileSync(".env.local", "utf8");
      const line = raw.split(/\r?\n/).find((l) => l.startsWith("ADMIN_TOKEN="));
      return line ? line.slice("ADMIN_TOKEN=".length).trim() : null;
    } catch {
      return null;
    }
  };

  const token = readToken();
  const countFeedback = async () => {
    if (!token) return null;
    try {
      const r = await fetch(`${BASE}/api/feedback`, { headers: { authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      return (await r.json())?.summary?.total ?? null;
    } catch {
      return null;
    }
  };

  const after = await countFeedback();
  if (after === null) {
    console.log("\n反馈数据护栏：SKIP（未取到 ADMIN_TOKEN，无法读取样本数）");
  } else if (feedbackCountBefore === null) {
    console.log(`\n反馈数据护栏：本次运行前未能读取，当前样本数 ${after}`);
  } else {
    const grew = after - feedbackCountBefore;
    expect(
      "本次检查未污染真实反馈数据",
      grew === 0,
      grew === 0 ? `样本数保持 ${after}` : `❌ 增加了 ${grew} 条（${feedbackCountBefore} → ${after}）`
    );
  }
}

console.log(`\n${"─".repeat(52)}`);
const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log(`  通过 ${passed} / 失败 ${failed}`);
console.log(`  控制台错误：${consoleErrors.length === 0 ? "无" : consoleErrors.slice(0, 3).join(" ;; ")}`);

if (failed > 0) {
  console.log("\n失败用例：");
  for (const r of results.filter((x) => !x.ok)) console.log(`  ✗ ${r.name}${r.detail ? `  ${r.detail}` : ""}`);
}

await browser.close();
process.exit(failed > 0 || consoleErrors.length > 0 ? 1 : 0);
