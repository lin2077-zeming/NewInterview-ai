"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * 全局返回键。
 *
 * ## 为什么需要它
 * 原先唯一"回上一步"的办法是点左上角的 logo —— 而**没有任何提示说明它能点**，
 * 用户不知道。在结果页与反馈表之间来回看的时候尤其难受：
 * 只能回首页再重新进对应功能，路径完全绕远。
 *
 * ## 返回目标怎么定
 * 优先回到**真实来源页**（比如从简历诊断进反馈表，就回简历诊断），
 * 而不是死板地回首页。做法是在 sessionStorage 里记一条本标签页的导航轨迹：
 * - 有轨迹 → 回到上一页
 * - 没有轨迹（用户是直接打开链接进来的）→ 回首页兜底
 *
 * 放在 sessionStorage 而不是内存里，是因为刷新一下不该把来路弄丢。
 *
 * ## 为什么不用 router.back()
 * 浏览器的历史里混着站外页面（比如从搜索引擎点进来），
 * `router.back()` 可能把用户甩出站点。自己记轨迹更可控。
 */

const STACK_KEY = "zhijing-nav-stack";
/** 轨迹最多记这么多层，防止长会话无限增长 */
const MAX_DEPTH = 20;

function readStack(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]) {
  try {
    window.sessionStorage.setItem(STACK_KEY, JSON.stringify(stack));
  } catch {
    // 无痕模式等场景写不了也无所谓，退化成"只能回首页"
  }
}

/**
 * 某些路由的「逻辑上级」不是导航轨迹里的上一页，而是语义上的父页面。
 *
 * 典型：面试复盘（/interview/review/[id]）是面试的**终点**，它的上级是
 * 「创建新面试」（/interview/new），而不是已经结束的面试对话页。
 * 否则返回键会把用户重新拽进一场已经结束的面试。
 */
const PARENT_OVERRIDES: { match: (path: string) => boolean; parent: string }[] = [
  { match: (path) => /^\/interview\/review\//.test(path), parent: "/interview/new" },
];

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";

  // 只写 sessionStorage（外部系统），不碰 state —— 因此不需要额外渲染，也不会有级联渲染问题
  useEffect(() => {
    if (pathname === "/") return;
    const stack = readStack();
    if (stack[stack.length - 1] !== pathname) {
      writeStack([...stack, pathname].slice(-MAX_DEPTH));
    }
  }, [pathname]);

  const handleBack = useCallback(() => {
    // 语义上级覆盖：复盘 → 创建新面试（见 PARENT_OVERRIDES）
    const override = PARENT_OVERRIDES.find((item) => item.match(pathname));
    if (override) {
      const stack = readStack();
      const idx = stack.lastIndexOf(override.parent);
      // 轨迹收敛到该父页面，后面的中间页（面试页、复盘页）一并清掉
      writeStack(idx >= 0 ? stack.slice(0, idx + 1) : [override.parent]);
      router.push(override.parent);
      return;
    }

    const stack = readStack();
    // 先把当前页从轨迹里去掉，剩下的最后一层就是来源页
    const trimmed = stack[stack.length - 1] === pathname ? stack.slice(0, -1) : stack;
    const target = trimmed[trimmed.length - 1];

    if (target && target !== pathname) {
      writeStack(trimmed);
      router.push(target);
      return;
    }
    // 没有来路（直接打开的链接）→ 回首页兜底
    writeStack(["/"]);
    router.push("/");
  }, [pathname, router]);

  // 首页无处可返回，不显示
  if (isHome) return null;

  return (
    <button
      type="button"
      onClick={handleBack}
      title="返回上一页"
      aria-label="返回上一页"
      className="mr-1 inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {/* 带文字而不是只给图标：图标本身不足以让人发现"这里能返回" */}
      <span className="hidden sm:inline">返回</span>
    </button>
  );
}
