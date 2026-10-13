"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { computeOpcMetrics, formatCost, loadOpcEvents } from "@/lib/opc-metrics";
import { FEEDBACK_MODULES, isFeedbackModule } from "@/config/feedback-modules";

/**
 * 试用反馈表。
 *
 * 设计目标只有一个：**让同学愿意填**。
 * 所以只问 3 个必答项 + 2 个选填项，一分钟能填完。
 *
 * 隐私：只收化名/编号，不收真名与联系方式；
 * 后台读取需管理员令牌；跟随「删除我的数据」一并清除。
 */

// 场景清单来自共享数据源，避免与结果页的快捷反馈条各写一份而分叉
const MODULES = FEEDBACK_MODULES;

const VERDICTS: Array<{ value: string; label: string; hint: string }> = [
  { value: "good", label: "很有用", hint: "会推荐给同学" },
  { value: "ok", label: "一般", hint: "能用，但没到想推荐" },
  { value: "poor", label: "不好用", hint: "有明确问题" },
];

export default function FeedbackPage() {
  const [participant, setParticipant] = useState("");
  const [participantRole, setParticipantRole] = useState("");
  const [triedModules, setTriedModules] = useState<string[]>([]);
  const [verdict, setVerdict] = useState("");
  const [valuable, setValuable] = useState("");
  const [improvable, setImprovable] = useState("");
  const [wouldReuse, setWouldReuse] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  /** 从本机度量里自动带上一份量化快照 —— 不用试用者手填数字 */
  const metrics = useMemo(() => {
    const m = computeOpcMetrics(loadOpcEvents());
    return {
      交付次数: m.deliveries,
      平均耗时ms: m.avgDurationMs,
      单次成本: formatCost(m.avgCostPerDelivery),
      累计成本: formatCost(m.totalCost),
      AI完成占比: `${m.aiSharePercent}%`,
      覆盖天数: m.activeDays,
    };
  }, []);

  useEffect(() => {
    // 提交成功后滚到顶部，让用户看到成功提示
    if (done) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [done]);

  /**
   * 结果页快捷反馈会带 `?module=xxx` 过来，这里预勾选对应模块 ——
   * 用户从「补充细节 →」点进来时不用再自己找是哪个场景。
   *
   * 用 window.location 而不是 useSearchParams：后者会把整页推到客户端渲染、
   * 还要额外包 Suspense，为一个 query 参数不值得。
   */
  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get("module");
    if (!from || !isFeedbackModule(from)) return;
    // 这里用 effect 而不是在 useState 初始化时读 window，是有原因的：
    // 首屏必须与服务端渲染结果一致，之后再补上 URL 里的参数，
    // 否则 SSR 渲染 [] 而客户端渲染 [module]，会触发 hydration 不匹配。
    // 「挂载后同步外部状态」正是 effect 的适用场景，该规则在此不适用。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTriedModules((prev) => (prev.includes(from) ? prev : [...prev, from]));
  }, []);

  function toggleModule(name: string) {
    setTriedModules((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    );
  }

  async function handleSubmit() {
    setError("");
    if (!participant.trim()) {
      setError("请填一个化名或编号（不用真名）。");
      return;
    }
    if (!verdict) {
      setError("请选一个总体评价。");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participant,
          participantRole,
          triedModules,
          verdict,
          valuable,
          improvable,
          wouldReuse,
          metrics,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "提交失败");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <h1 className="text-xl font-semibold">反馈已收到，谢谢</h1>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              你的反馈会原样进入我们的迭代清单，也会如实写进比赛材料。
              如果是「不好用」的评价，同样会被保留 —— 真实反馈才有价值。
            </p>
            <div className="mt-2 flex gap-3">
              <Link href="/">
                <Button variant="outline">回到首页</Button>
              </Link>
              <Button
                onClick={() => {
                  setDone(false);
                  setParticipant("");
                  setParticipantRole("");
                  setTriedModules([]);
                  setVerdict("");
                  setValuable("");
                  setImprovable("");
                  setWouldReuse(null);
                }}
              >
                再填一条（换人）
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <MessageSquareQuote className="h-6 w-6 text-primary" />
          试用反馈
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          一分钟能填完。我们会<strong className="font-medium text-foreground">原样</strong>保留你的评价并写进比赛材料，
          所以请照实说 —— 不好用的话更需要听。
          <br />
          只收化名与主观评价，请<strong>不要填真实姓名或联系方式</strong>。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">你是谁（选填背景，方便我们看样本是否偏科）</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="fb-name">
              化名 / 编号 <span className="text-destructive">*</span>
            </label>
            <input
              id="fb-name"
              value={participant}
              onChange={(e) => setParticipant(e.target.value)}
              placeholder="如：同学 A"
              maxLength={30}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="fb-role">
              年级与专业
            </label>
            <input
              id="fb-role"
              value={participantRole}
              onChange={(e) => setParticipantRole(e.target.value)}
              placeholder="如：大四 · 计算机"
              maxLength={40}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">你试了哪些模块</CardTitle>
          <CardDescription>可多选</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {MODULES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleModule(m)}
              className={
                triedModules.includes(m)
                  ? "rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                  : "rounded-lg border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
              }
            >
              {m}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            总体评价 <span className="text-destructive">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {VERDICTS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setVerdict(v.value)}
              className={
                verdict === v.value
                  ? "rounded-lg border border-primary/40 bg-primary/10 p-3 text-left"
                  : "rounded-lg border p-3 text-left transition-colors hover:bg-muted"
              }
            >
              <div className="text-sm font-medium">{v.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{v.hint}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">具体说说（选填，但最有价值）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="fb-valuable">
              哪一点对你最有用？
            </label>
            <textarea
              id="fb-valuable"
              value={valuable}
              onChange={(e) => setValuable(e.target.value)}
              rows={2}
              maxLength={800}
              placeholder="如：简历诊断给出的改后句子能直接抄"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="fb-improvable">
              哪一点最该改？
            </label>
            <textarea
              id="fb-improvable"
              value={improvable}
              onChange={(e) => setImprovable(e.target.value)}
              rows={2}
              maxLength={800}
              placeholder="如：等待时间太长 / 某道题看不懂 / 找不到入口"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">会继续用它准备面试吗？</span>
            <div className="flex gap-2">
              {[
                { v: true, label: "会" },
                { v: false, label: "不会" },
              ].map((opt) => (
                <button
                  key={String(opt.v)}
                  type="button"
                  onClick={() => setWouldReuse(opt.v)}
                  className={
                    wouldReuse === opt.v
                      ? "rounded-lg border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
                      : "rounded-lg border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">本次试用自动记录的量化数据</CardTitle>
          <CardDescription>
            由系统自动采集，不用你填。会随反馈一起存下来，用于统计
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.交付次数 === 0 ? (
            <p className="text-sm text-muted-foreground">
              本次会话还没有可统计的交付记录 —— 先试用几个功能再来填，数据会更有参考价值。
            </p>
          ) : (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {Object.entries(metrics).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b pb-1.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            提交中
          </>
        ) : (
          "提交反馈"
        )}
      </Button>
    </div>
  );
}
