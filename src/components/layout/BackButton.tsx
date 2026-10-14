"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * 全局返回键：**固定返回路径**，不依赖浏览历史。
 *
 * ## 为什么改掉原来的做法
 * 之前用 sessionStorage 记一条"访问轨迹"，返回时回退到上一个访问过的页面。
 * 结果是**不可预测**：从面试岗位返回可能落到个人信息页，甚至继续回退到更早
 * 打开过的模块 —— 因为返回目标取决于"用户是怎么走到这里的"，
 * 而不是"这个页面在结构上属于哪里"。
 *
 * 现在改成**写死的父级映射**：每个页面的返回目标固定，与来路无关。
 * 点几次都一样，试用者不会迷路，录屏演示也不会出意外。
 *
 * ## 固定路径表
 * | 页面 | 返回目标 |
 * |---|---|
 * | 简历诊断 / 岗位追问链 / 题库练习 / 求职规划 / 运营看板 / 创建新面试 / 试用反馈 / 个人信息 | 主界面 |
 * | 面试进行中 / 面试复盘 / 历史复盘 | 创建新面试 |
 * | 求职规划的子页面（学习路径详情） | 求职规划 |
 */

interface RouteParent {
  test: (pathname: string) => boolean;
  /** 返回目标；`null` 表示没有上级（主界面自身） */
  parent: string | null;
  /** 目标页面的显示名，用于按钮文案与无障碍标签 */
  label?: string;
}

/**
 * 顺序有意义：先匹配先生效。
 * 例如 `/interview/new` 必须在 `/interview/<id>` 之前判断，
 * 否则 "new" 会被当成一个面试 id。
 */
const ROUTE_PARENTS: RouteParent[] = [
  // 主界面自身：无处可返回
  { test: (p) => p === "/", parent: null },

  // ── 面试线 ──
  { test: (p) => p === "/interview/new", parent: "/", label: "主界面" },
  { test: (p) => p === "/interview/reviews", parent: "/interview/new", label: "创建新面试" },
  { test: (p) => p.startsWith("/interview/review/"), parent: "/interview/new", label: "创建新面试" },
  { test: (p) => /^\/interview\/[^/]+$/.test(p), parent: "/interview/new", label: "创建新面试" },

  // ── 求职规划的子页面（如学习路径详情）回上级模块 ──
  { test: (p) => p.startsWith("/career/"), parent: "/career", label: "求职规划" },

  // ── 其余模块页一律回主界面 ──
  { test: () => true, parent: "/", label: "主界面" },
];

function resolveBack(pathname: string): { parent: string; label: string } | null {
  for (const route of ROUTE_PARENTS) {
    if (!route.test(pathname)) continue;
    if (route.parent === null) return null;
    return { parent: route.parent, label: route.label ?? "上一页" };
  }
  return null;
}

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const target = resolveBack(pathname);

  // 主界面及未登记的路由：不显示
  if (!target) return null;

  return (
    <button
      type="button"
      data-testid="nav-back"
      onClick={() => router.push(target.parent)}
      title={`返回${target.label}`}
      aria-label={`返回${target.label}`}
      className="mr-1 inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {/* 带上目的地文字：用户点之前就知道会去哪，不用猜也符合预期 */}
      <span className="hidden sm:inline">返回{target.label}</span>
    </button>
  );
}
