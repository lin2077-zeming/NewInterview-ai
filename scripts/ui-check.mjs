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

// ========== 3. 题库练习：无 AI 也能用 ==========
console.log("\n3. 题库练习（离线模式的主要载体）");
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
