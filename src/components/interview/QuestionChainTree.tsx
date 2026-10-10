"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Copy, Crosshair, ShieldAlert, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionChain, QuestionChainDimension, QuestionChainNode, QuestionChainTrack } from "@/types";

const LEVEL_LABELS: Record<1 | 2 | 3, string> = {
  1: "首问",
  2: "深挖",
  3: "边界 · 反例",
};

const WEIGHT_CLASSES: Record<"高" | "中" | "低", string> = {
  高: "border-destructive/40 bg-destructive/10 text-destructive",
  中: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  低: "border-border bg-muted text-muted-foreground",
};

interface QuestionChainTreeProps {
  chain: QuestionChain;
  /** 用于「去练习」链接的公司 key */
  companyKey?: string;
}

export function QuestionChainTree({ chain, companyKey }: QuestionChainTreeProps) {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const totalNodes = chain.dimensions.reduce(
    (sum, dimension) => sum + dimension.tracks.reduce((count, track) => count + track.nodes.length, 0),
    0
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          共 <span className="font-medium text-foreground">{chain.dimensions.length}</span> 个考察维度 ·{" "}
          <span className="font-medium text-foreground">{totalNodes}</span> 个追问节点
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs underline-offset-4 hover:underline"
            onClick={() => setCollapsed({})}
          >
            全部展开
          </button>
          <span className="text-border">|</span>
          <button
            type="button"
            className="text-xs underline-offset-4 hover:underline"
            onClick={() =>
              setCollapsed(
                Object.fromEntries(chain.dimensions.map((_, index) => [index, true]))
              )
            }
          >
            全部折叠
          </button>
        </div>
      </div>

      {chain.dimensions.map((dimension, index) => (
        <DimensionCard
          key={`${dimension.name}-${index}`}
          dimension={dimension}
          index={index}
          collapsed={Boolean(collapsed[index])}
          onToggle={() => setCollapsed((prev) => ({ ...prev, [index]: !prev[index] }))}
          roleLabel={chain.roleLabel}
          companyKey={companyKey}
        />
      ))}
    </div>
  );
}

function DimensionCard({
  dimension,
  index,
  collapsed,
  onToggle,
  roleLabel,
  companyKey,
}: {
  dimension: QuestionChainDimension;
  index: number;
  collapsed: boolean;
  onToggle: () => void;
  roleLabel: string;
  companyKey?: string;
}) {
  const nodeCount = dimension.tracks.reduce((sum, track) => sum + track.nodes.length, 0);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/40"
      >
        <span className="mt-0.5 text-muted-foreground">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
        <span className="flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">维度 {index + 1}</span>
            <span className="font-medium">{dimension.name}</span>
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs font-medium",
                WEIGHT_CLASSES[dimension.weight]
              )}
            >
              重要度 {dimension.weight}
            </span>
            <span className="text-xs text-muted-foreground">{nodeCount} 个节点</span>
          </span>
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">{dimension.why}</span>
        </span>
      </button>

      {collapsed ? null : (
        <div className="space-y-6 border-t px-4 py-4">
          {dimension.tracks.map((track, trackIndex) => (
            <TrackBlock
              key={`${track.topic}-${trackIndex}`}
              track={track}
              roleLabel={roleLabel}
              companyKey={companyKey}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TrackBlock({
  track,
  roleLabel,
  companyKey,
}: {
  track: QuestionChainTrack;
  roleLabel: string;
  companyKey?: string;
}) {
  const practiceHref = `/interview/new?role=${encodeURIComponent(roleLabel)}${
    companyKey ? `&company=${encodeURIComponent(companyKey)}` : ""
  }`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Crosshair className="h-3.5 w-3.5 text-primary" />
          追问链：{track.topic}
        </p>
        <Link
          href={practiceHref}
          className="text-xs text-primary underline-offset-4 hover:underline"
        >
          带着这条链去练习 →
        </Link>
      </div>

      <ol className="relative space-y-3 border-l border-border pl-5">
        {track.nodes.map((node) => (
          <ChainNodeItem key={`${node.level}-${node.question}`} node={node} />
        ))}
      </ol>
    </div>
  );
}

function ChainNodeItem({ node }: { node: QuestionChainNode }) {
  const [copied, setCopied] = useState(false);

  async function copyQuestion() {
    try {
      await navigator.clipboard.writeText(node.question);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <li className="relative">
      <span className="absolute -left-[26px] top-3 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background text-[10px] font-medium text-muted-foreground">
        {node.level}
      </span>
      <div className="rounded-lg border bg-card p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            L{node.level} · {LEVEL_LABELS[node.level]}
          </span>
          <button
            type="button"
            onClick={copyQuestion}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "已复制" : "复制问法"}
          </button>
        </div>

        <p className="font-medium leading-6">{node.question}</p>

        <div className="mt-3 space-y-2 text-sm">
          <p className="flex items-start gap-1.5 text-muted-foreground">
            <Target className="mt-1 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="text-xs">考察：</span>
              {node.focus}
            </span>
          </p>
          <p className="flex items-start gap-1.5 text-muted-foreground">
            <Check className="mt-1 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="text-xs">及格线：</span>
              {node.passingBar}
            </span>
          </p>
          {node.redFlags.length > 0 ? (
            <div className="flex items-start gap-1.5 rounded-md border border-destructive/25 bg-destructive/5 p-2 text-destructive">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <ul className="space-y-1">
                {node.redFlags.map((flag) => (
                  <li key={flag} className="leading-5">
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
