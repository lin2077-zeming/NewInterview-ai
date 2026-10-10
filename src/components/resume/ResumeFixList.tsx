"use client";

import { useState } from "react";
import { Check, CheckCircle2, Circle, Copy, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, SEVERITY_LABELS } from "@/lib/resume-fix-labels";
import type { ResumeFix, ResumeFixSeverity } from "@/types";

const SEVERITY_CLASSES: Record<ResumeFixSeverity, string> = {
  high: "border-destructive/40 bg-destructive/10 text-destructive",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  low: "border-border bg-muted text-muted-foreground",
};

interface ResumeFixListProps {
  fixes: ResumeFix[];
  acceptedIds: string[];
  onToggle: (id: string) => void;
}

export function ResumeFixList({ fixes, acceptedIds, onToggle }: ResumeFixListProps) {
  const acceptedCount = fixes.filter((fix) => acceptedIds.includes(fix.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          共 <span className="font-medium text-foreground">{fixes.length}</span> 条建议，已采纳{" "}
          <span className="font-medium text-foreground">{acceptedCount}</span> 条
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            硬伤
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            明显减分
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
            打磨项
          </span>
        </div>
      </div>

      {fixes.map((fix, index) => (
        <FixCard
          key={fix.id}
          fix={fix}
          index={index}
          accepted={acceptedIds.includes(fix.id)}
          onToggle={() => onToggle(fix.id)}
        />
      ))}
    </div>
  );
}

function FixCard({
  fix,
  index,
  accepted,
  onToggle,
}: {
  fix: ResumeFix;
  index: number;
  accepted: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copySuggestion() {
    try {
      await navigator.clipboard.writeText(fix.suggestion);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors",
        accepted ? "border-primary/40 bg-primary/5" : "border-border"
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-xs font-medium",
            SEVERITY_CLASSES[fix.severity]
          )}
        >
          {SEVERITY_LABELS[fix.severity]}
        </span>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {CATEGORY_LABELS[fix.category]}
        </span>
        <span className="text-xs text-muted-foreground">{fix.section}</span>
      </div>

      <div className="space-y-3 text-sm">
        <div className="rounded-md bg-muted/60 p-3">
          <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Quote className="h-3 w-3" />
            简历原句
          </p>
          <p className="leading-6">{fix.original}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border p-3">
            <p className="mb-1 text-xs text-muted-foreground">问题</p>
            <p className="leading-6">{fix.issue}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="mb-1 text-xs text-muted-foreground">为什么是问题</p>
            <p className="leading-6">{fix.why}</p>
          </div>
        </div>

        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">改后原句</p>
            <button
              type="button"
              onClick={copySuggestion}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <p className="leading-6">{fix.suggestion}</p>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
            accepted
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          {accepted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
          {accepted ? "已采纳" : "标记为已采纳"}
        </button>
      </div>
    </div>
  );
}
