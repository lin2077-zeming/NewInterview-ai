"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, RotateCcw, Sparkles, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuestionChainTree } from "@/components/interview/QuestionChainTree";
import { COMPANY_FLOWS } from "@/config/interview-stages";
import { ROLE_LABELS } from "@/config/question-chains";
import { recordOpcEvent } from "@/lib/opc-metrics";
import { clearQuestionChain, loadQuestionChain, saveQuestionChain } from "@/lib/question-chain-store";
import type { UsageCost } from "@/lib/ai/cost";
import type { QuestionChain } from "@/types";

type AiUsage = Pick<UsageCost, "inputTokens" | "outputTokens" | "cost">;

const LEVELS = ["校招 / 实习", "社招 1-3 年", "资深 / 3 年以上"];

const COMPANY_OPTIONS = [
  { key: "", name: "通用互联网公司" },
  ...Object.entries(COMPANY_FLOWS).map(([key, flow]) => ({ key, name: flow.name })),
];

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([key, label]) => ({ key, label }));

export default function ChainPage() {
  const [role, setRole] = useState("frontend");
  const [company, setCompany] = useState("");
  const [level, setLevel] = useState(LEVELS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chain, setChain] = useState<QuestionChain | null>(null);
  const [companyKey, setCompanyKey] = useState<string | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = loadQuestionChain();
      if (saved) {
        setChain(saved.chain);
        setCompanyKey(saved.companyKey);
        setRole(saved.chain.role);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleGenerate() {
    setError("");
    setLoading(true);
    const startedAt = performance.now();
    try {
      const response = await fetch("/api/interview/chain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, company: company || undefined, level }),
      });
      const durationMs = performance.now() - startedAt;
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "追问链生成失败，请稍后重试。");
      }
      const { usage, ...chainData } = data as QuestionChain & { usage?: AiUsage };
      const next = chainData as QuestionChain;
      setChain(next);
      setCompanyKey(company || undefined);
      saveQuestionChain({ chain: next, companyKey: company || undefined });

      // 记录一次交付，用于 OPC 度量看板
      const nodeCount = next.dimensions.reduce(
        (sum, dimension) =>
          sum + dimension.tracks.reduce((count, track) => count + track.nodes.length, 0),
        0
      );
      recordOpcEvent({
        kind: "chain_generate",
        durationMs,
        source: next.source,
        usage,
        units: nodeCount,
        label: `${next.roleLabel} · ${next.dimensions.length} 维度 / ${nodeCount} 节点`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "追问链生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    clearQuestionChain();
    setChain(null);
    setCompanyKey(undefined);
    setError("");
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">岗位追问链</h1>
        <p className="text-sm text-muted-foreground">
          选定目标岗位，看清面试官会<strong className="font-medium text-foreground">怎么一层层追问</strong>
          ：每个考察维度拆成首问 → 深挖 → 边界，并标注及格线与常见错误回答。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <Waypoints className="mb-2 h-8 w-8 text-primary" />
            <CardTitle>选择目标岗位</CardTitle>
            <CardDescription>追问链会按岗位的真实考察重点生成</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="chain-role">
                岗位
              </label>
              <select
                id="chain-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                disabled={loading}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="chain-level">
                候选人层次
              </label>
              <select
                id="chain-level"
                value={level}
                onChange={(event) => setLevel(event.target.value)}
                disabled={loading}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
              >
                {LEVELS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Sparkles className="mb-2 h-8 w-8 text-primary" />
            <CardTitle>面试公司（可选）</CardTitle>
            <CardDescription>选定后追问链会贴合该公司的面试风格</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              aria-label="面试公司"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              disabled={loading}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
            >
              {COMPANY_OPTIONS.map((option) => (
                <option key={option.key || "general"} value={option.key}>
                  {option.name}
                </option>
              ))}
            </select>
            <Button className="w-full" onClick={handleGenerate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在生成追问链
                </>
              ) : (
                <>
                  <Waypoints className="h-4 w-4" />
                  生成追问链
                </>
              )}
            </Button>
            {chain ? (
              <Button variant="outline" className="w-full" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
                清空重来
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {chain ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {chain.roleLabel}
                {chain.company ? (
                  <span className="text-muted-foreground">· {chain.company}</span>
                ) : null}
                <span
                  className={
                    chain.source === "ai"
                      ? "rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                      : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {chain.source === "ai" ? "AI 生成" : "离线配置"}
                </span>
              </CardTitle>
              <CardDescription>{chain.intro}</CardDescription>
            </CardHeader>
          </Card>

          <QuestionChainTree chain={chain} companyKey={companyKey} />

          {chain.source === "fallback" ? (
            <p className="text-xs text-muted-foreground">
              当前为离线配置版追问链（未配置 AI 密钥或调用超时）。配置密钥后可由 AI 按公司与岗位定制生成。
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
