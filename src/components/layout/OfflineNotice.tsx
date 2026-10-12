"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
import { useAiStatus } from "@/hooks/use-ai-status";

/**
 * 离线模式提示条。
 *
 * 只在未配置 AI 密钥时出现。存在的意义不是"报错"，而是**说清还能做什么** ——
 * 用户看到"AI 不可用"只会以为产品坏了，看到"题库练习仍可正常使用"
 * 才知道该怎么继续。降级设计的关键从来不是优雅地失败，而是**给出替代路径**。
 */
export function OfflineNotice() {
  const { status, loading, offline } = useAiStatus();

  if (loading || !offline || !status) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <WifiOff className="h-4 w-4" />
          当前为离线模式
        </span>
        <span className="text-amber-800/80 dark:text-amber-300/80">
          {status.reason}
        </span>
        <Link
          href="/practice"
          className="font-medium underline underline-offset-2 hover:no-underline"
        >
          去题库练习 →
        </Link>
      </div>
    </div>
  );
}
