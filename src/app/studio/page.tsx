"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Coins,
  Gauge,
  ListChecks,
  Rocket,
  RotateCcw,
  Trash2,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OpcRadar, OpcScoreTrend } from "@/components/studio/OpcCharts";
import {
  KIND_META,
  clearOpcEvents,
  computeOpcMaturity,
  computeOpcMetrics,
  formatCost,
  formatDuration,
  loadOpcEvents,
  loadOpcTeam,
  saveOpcTeam,
  type OpcEvent,
  type OpcTeam,
} from "@/lib/opc-metrics";

const TEAM_SIZES = [1, 2, 3, 4, 5];

export default function StudioPage() {
  const [events, setEvents] = useState<OpcEvent[]>([]);
  const [team, setTeam] = useState<OpcTeam>({ size: 1 });
  const [ready, setReady] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEvents(loadOpcEvents());
      setTeam(loadOpcTeam());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const metrics = useMemo(() => computeOpcMetrics(events), [events]);
  const maturity = useMemo(() => computeOpcMaturity(metrics, team), [metrics, team]);

  function handleTeamSize(size: number) {
    const next = { size };
    setTeam(next);
    saveOpcTeam(next);
  }

  function handleClear() {
    clearOpcEvents();
    setEvents([]);
  }

  async function handleDeleteData() {
    const confirmed = window.confirm(
      "将删除当前匿名会话的全部数据：面试记录、对话、复盘报告、简历、学习路径，以及本机度量记录。\n\n此操作不可恢复，确定继续？"
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteResult("");
    try {
      const response = await fetch("/api/me/data", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "删除失败，请稍后重试。");
      }
      clearOpcEvents();
      setEvents([]);
      const d = data.deleted ?? {};
      setDeleteResult(
        `已删除：面试 ${d.interviews ?? 0} 场 · 对话 ${d.messages ?? 0} 条 · 复盘 ${d.reviews ?? 0} 份 · 简历 ${d.resumes ?? 0} 份 · 学习路径 ${d.learningPaths ?? 0} 条`
      );
    } catch (err) {
      setDeleteResult(err instanceof Error ? err.message : "删除失败，请稍后重试。");
    } finally {
      setDeleting(false);
    }
  }

  if (!ready) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-muted-foreground">加载中…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">OPC 度量看板</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          这里的每一个数字都来自本机的真实操作记录 —— 你做过几次交付、花了多少钱、AI 承担了多少工作。
          <br />
          它要回答的只有一个问题：
          <strong className="font-medium text-foreground">一个人，到底能不能把这家工作室运营起来？</strong>
        </p>
      </div>

      {metrics.deliveries === 0 ? (
        <Card>
          <CardHeader>
            <Gauge className="mb-2 h-8 w-8 text-primary" />
            <CardTitle>还没有交付记录</CardTitle>
            <CardDescription>
              先去做一次简历诊断或生成一条岗位追问链，看板就会开始记录成本与耗时。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href="/resume">
              <Button>去诊断简历 →</Button>
            </Link>
            <Link href="/chain">
              <Button variant="outline">去生成追问链 →</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>OPC 成熟度</CardTitle>
              <CardDescription>
                五个特征各自打分（0-100），综合 {maturity.overall} 分。打分口径见各项指标卡的说明。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-center">
              <OpcRadar maturity={maturity} />
              <div className="space-y-3">
                <MetricRow
                  label="累计交付"
                  value={`${metrics.deliveries} 次`}
                  hint={`覆盖 ${metrics.activeDays} 天 · ${metrics.totalUnits} 项产出`}
                />
                <MetricRow
                  label="累计成本"
                  value={formatCost(metrics.totalCost)}
                  hint={
                    metrics.totalCost === 0 && metrics.aiDeliveries > 0
                      ? "当前使用免费模型，AI 成本为 ¥0"
                      : `单次交付均价 ${formatCost(metrics.avgCostPerDelivery)}`
                  }
                />
                <MetricRow
                  label="累计 token"
                  value={metrics.totalTokens.toLocaleString("zh-CN")}
                  hint={`输入 ${metrics.totalInputTokens.toLocaleString("zh-CN")} / 输出 ${metrics.totalOutputTokens.toLocaleString("zh-CN")}`}
                />
                <MetricRow
                  label="已替代岗位"
                  value={`${metrics.replacedRoles.length} 个`}
                  hint={metrics.replacedRoles.join(" / ") || "—"}
                />
                <MetricRow
                  label="团队规模"
                  value={`${team.size} 人`}
                  hint={team.size <= 1 ? "一人公司" : "小团队"}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              icon={<Coins className="h-5 w-5 text-primary" />}
              title="低成本启动"
              value={formatCost(metrics.avgCostPerDelivery)}
              unit="/ 次交付"
              rows={[
                ["累计成本", formatCost(metrics.totalCost)],
                ["累计 token", metrics.totalTokens.toLocaleString("zh-CN")],
                [
                  "说明",
                  metrics.totalCost === 0 && metrics.aiDeliveries > 0
                    ? "使用免费模型，AI 成本为 ¥0"
                    : "按 token 用量估算",
                ],
              ]}
            />
            <MetricCard
              icon={<Users className="h-5 w-5 text-primary" />}
              title="一人 / 小团队"
              value={`${team.size} 人`}
              unit={`· AI 承担 ${metrics.replacedRoles.length} 个岗位`}
              rows={[
                ["AI 替代岗位", metrics.replacedRoles.join(" / ") || "—"],
                ["说明", "按使用过的模块自动统计"],
              ]}
            />
            <MetricCard
              icon={<UserRound className="h-5 w-5 text-primary" />}
              title="AI 辅助执行"
              value={`${metrics.aiSharePercent}%`}
              unit="交付由 AI 完成"
              rows={[
                ["AI 交付", `${metrics.aiDeliveries} 次`],
                ["离线规则交付", `${metrics.offlineDeliveries} 次`],
              ]}
            />
            <MetricCard
              icon={<Rocket className="h-5 w-5 text-primary" />}
              title="快速验证"
              value={formatDuration(metrics.avgDurationMs)}
              unit="/ 次交付"
              rows={[
                ["总耗时", formatDuration(metrics.totalDurationMs)],
                ["说明", "从提交到拿到结果的端到端耗时"],
              ]}
            />
            <MetricCard
              icon={<RotateCcw className="h-5 w-5 text-primary" />}
              title="持续迭代"
              value={`${metrics.iterations} 轮`}
              unit="简历诊断"
              rows={[
                [
                  "得分变化",
                  metrics.scoreFrom !== null && metrics.scoreTo !== null
                    ? `${metrics.scoreFrom} → ${metrics.scoreTo}`
                    : "—",
                ],
                ["说明", "改一版再诊断一次，轮次 +1"],
              ]}
            />
            <MetricCard
              icon={<ListChecks className="h-5 w-5 text-primary" />}
              title="累计产出"
              value={`${metrics.totalUnits}`}
              unit="项交付物"
              rows={[
                ["其中 AI 路径", `${metrics.aiDeliveries} 次`],
                [
                  "时间跨度",
                  metrics.firstAt && metrics.lastAt
                    ? `${new Date(metrics.firstAt).toLocaleDateString("zh-CN")} 起`
                    : "—",
                ],
              ]}
            />
          </div>

          {metrics.scoreTrend.length >= 2 ? (
            <Card>
              <CardHeader>
                <TrendingUp className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>迭代效果：简历可投递度变化</CardTitle>
                <CardDescription>
                  改完一轮再诊断一次，分数会记录在这条曲线上 —— 这是「持续迭代」最直接的证据
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OpcScoreTrend points={metrics.scoreTrend} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>最近交付记录</CardTitle>
              <CardDescription>每次交付的耗时、成本与产出，按时间倒序</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {events.slice(0, 12).map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {KIND_META[event.kind]?.label ?? event.kind}
                      </span>
                      <span
                        className={
                          event.source === "ai"
                            ? "rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"
                            : "rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        }
                      >
                        {event.source === "ai" ? "AI" : "离线规则"}
                      </span>
                      <span className="truncate text-muted-foreground">{event.label}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                    <span>{formatDuration(event.durationMs)}</span>
                    <span>{formatCost(event.cost)}</span>
                    <span>{new Date(event.at).toLocaleTimeString("zh-CN")}</span>
                  </div>
                </div>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">
                共 {events.length} 条记录（最多保留 300 条）
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>运营设置</CardTitle>
          <CardDescription>团队规模会影响「一人 / 小团队」这一项的评分</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">团队人数（含本人）</p>
              <div className="flex gap-2">
                {TEAM_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => handleTeamSize(size)}
                    className={
                      team.size === size
                        ? "h-9 w-9 rounded-lg border border-primary/40 bg-primary/10 text-sm font-medium text-primary"
                        : "h-9 w-9 rounded-lg border text-sm text-muted-foreground transition-colors hover:bg-muted"
                    }
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="outline" onClick={handleClear} disabled={events.length === 0}>
              <Trash2 className="h-4 w-4" />
              清空度量数据
            </Button>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4 border-t pt-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">隐私：删除我的全部数据</p>
              <p className="text-xs leading-5 text-muted-foreground">
                本项目不要求注册，每位访客有一个独立的匿名会话，数据彼此隔离。
                <br />
                点击右侧按钮会删除当前会话的全部内容，并重置匿名会话。
              </p>
            </div>
            <Button variant="outline" onClick={handleDeleteData} disabled={deleting}>
              <Trash2 className="h-4 w-4" />
              {deleting ? "正在删除…" : "删除我的全部数据"}
            </Button>
          </div>

          {deleteResult ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {deleteResult}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-xs leading-6 text-muted-foreground">
        成本按当前配置的模型单价估算：智谱 GLM-Flash 免费档为 ¥0；DeepSeek 按 V4-Pro 空闲时段
        （输入 ¥4.5 / 输出 ¥13.5 每百万 token，高峰约翻倍）。可用环境变量{" "}
        <code>OPC_PRICE_INPUT_PER_MILLION</code> / <code>OPC_PRICE_OUTPUT_PER_MILLION</code> 覆盖。
        当前度量数据仅保存在本机浏览器，尚未接入服务端会话。
      </p>
    </div>
  );
}

function MetricRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <p className="shrink-0 text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

function MetricCard({
  icon,
  title,
  value,
  unit,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  unit: string;
  rows: Array<[string, string]>;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          {icon}
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>{" "}
          <span className="text-xs">{unit}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-xs">
        {rows.map(([label, content]) => (
          <p key={label} className="flex justify-between gap-3 text-muted-foreground">
            <span className="shrink-0">{label}</span>
            <span className="truncate text-right">{content}</span>
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
