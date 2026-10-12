import Link from "next/link";
import { Gauge } from "lucide-react";

/**
 * OPC 运营看板的右下角入口。
 *
 * 为什么和别的功能不一样：看板**不是给用户使用的功能**，
 * 它是评委核验 OPC 成果（成本、耗时、AI 完成占比、迭代轮次）的工具。
 * 所以它不进首页的功能列表，只在右下角留一个小入口。
 *
 * 做得克制是有意的：有权限的人知道它在哪，普通用户几乎不会注意到，
 * 也不会挤占正常功能的视觉位置。页面本身还有一道口令门。
 */
export function StudioEntry() {
  return (
    <Link
      href="/studio"
      title="OPC 运营看板（内部工具，需口令）"
      aria-label="OPC 运营看板"
      className="group fixed bottom-4 right-4 z-40 flex h-9 items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 text-muted-foreground/60 shadow-sm backdrop-blur transition-all hover:border-primary/40 hover:bg-background hover:px-3 hover:text-primary"
    >
      <Gauge className="h-4 w-4" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium opacity-0 transition-all duration-200 group-hover:max-w-[6rem] group-hover:opacity-100">
        运营看板
      </span>
    </Link>
  );
}
