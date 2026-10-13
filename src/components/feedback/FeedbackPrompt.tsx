"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, MessageSquareQuote, ThumbsDown, ThumbsUp } from "lucide-react";
import type { FeedbackModule } from "@/config/feedback-modules";

/**
 * 结果页的快捷反馈条。
 *
 * ## 为什么放在结果旁边，而不是只留一个入口
 * 反馈入口原先只在运营看板里，而看板有口令门 —— **试用者根本进不去**，
 * 等于没有入口。更根本的问题是时机：用户刚看完结果的那几秒，
 * 是唯一愿意评价的时刻；等他切到另一个页面填表，意愿已经掉光了。
 *
 * 所以这里做两件事：
 * 1. **贴着结果出现** —— 只有 AI 真的产出结果后才渲染（见调用方的条件）
 * 2. **两次点击就能完成** —— 👍/👎 直接落库，不强制填表；
 *    想细说再点「补充细节」去完整表单
 *
 * ## 触发时机与位置（由调用方保证）
 * - 时机：结果**渲染成功后**。加载中、报错、空结果都不显示
 * - 位置：结果内容块的**末尾** —— 用户读完正好是判断"有没有用"的时刻
 *
 * ## 每次结果都会重新询问，这是有意的
 * 反馈是按"交付次数"统计的，每份结果是一次独立交付，
 * 所以在组件内用局部 state 而不是 localStorage 持久化"已反馈"。
 */

export type FeedbackVerdict = "good" | "poor";

interface Props {
  /**
   * 场景名，用于统计与回填。
   *
   * 类型来自共享清单而不是 string —— 写错场景名会在**编译期**报错。
   * 之前「求职规划」就因为清单不同步而静默失效过。
   */
  module: FeedbackModule;
  className?: string;
}

export function FeedbackPrompt({ module, className = "" }: Props) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [sent, setSent] = useState<FeedbackVerdict | null>(null);
  const [error, setError] = useState("");

  async function send(verdict: FeedbackVerdict) {
    if (state === "sending") return;
    setState("sending");
    setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "inline",
          verdict,
          triedModules: [module],
          metrics: { 来源: "结果页快捷反馈", 场景: module },
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "提交失败");
      }
      setSent(verdict);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm ${className}`}
      >
        <span className="inline-flex items-center gap-1.5 text-primary">
          <Check className="h-4 w-4" />
          已记录（{sent === "good" ? "有用" : "没用"}），谢谢 —— 这条会进我们的迭代清单
        </span>
        <Link
          href={`/feedback?module=${encodeURIComponent(module)}`}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          想补充细节 →
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/30 px-4 py-2.5 text-sm ${className}`}
    >
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <MessageSquareQuote className="h-4 w-4" />
        这份结果对你有帮助吗？
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void send("good")}
          disabled={state === "sending"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:opacity-60"
        >
          {state === "sending" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ThumbsUp className="h-3.5 w-3.5" />
          )}
          有用
        </button>
        <button
          type="button"
          onClick={() => void send("poor")}
          disabled={state === "sending"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive disabled:opacity-60"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          没用
        </button>
        <Link
          href={`/feedback?module=${encodeURIComponent(module)}`}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          补充细节 →
        </Link>
      </div>

      {error ? <span className="w-full text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
