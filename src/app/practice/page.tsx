"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Check, ChevronDown, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RolePicker } from "@/components/roles/RolePicker";

/**
 * 题库练习。
 *
 * **这个页面完全不需要 AI**：数据全部来自 `data/roles/**`，
 * 不配密钥也能按岗位浏览题目、看考察维度与答题要点。
 *
 * 它是「离线降级模式」的主要载体。降级设计的关键从来不是优雅地失败，
 * 而是**给出替代路径** —— 用户看到"AI 不可用"只会以为产品坏了，
 * 看到"题库练习仍可正常使用"才知道该怎么继续。
 */

/** 题型标签。algorithm 在非技术岗位承载「专业能力题」，所以这里不叫「算法」 */
const STAGE_LABELS: Record<string, string> = {
  algorithm: "专业能力",
  project: "经历深挖",
  cross: "综合应变",
  hr: "HR 综合",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "基础",
  medium: "进阶",
  hard: "挑战",
};

interface PracticeQuestion {
  id: string;
  stage: string;
  difficulty: string;
  title: string;
  content: string;
  tags: string[];
  company?: string;
  source?: { type: string; name: string };
}

interface Probe {
  q: string;
  bar: string;
  red: string;
}

interface Dimension {
  name: string;
  why: string;
  weight: string;
  probes: Probe[];
}

interface PracticePayload {
  role: { id: string; label: string; summary: string; skills: string[] };
  dimensions: Dimension[];
  questions: PracticeQuestion[];
  total: number;
}

const DONE_KEY = "zhijing-practice-done";

function loadDone(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DONE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function PracticePage() {
  const [roleId, setRoleId] = useState("");
  const [payload, setPayload] = useState<PracticePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDone(loadDone()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const fetchQuestions = useCallback(async (id: string, s: string, d: string) => {
    if (!id) {
      setPayload(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ role: id });
      if (s) params.set("stage", s);
      if (d) params.set("difficulty", d);
      const response = await fetch(`/api/practice/questions?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "读取题库失败");
      setPayload(data as PracticePayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取题库失败");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 岗位/筛选变化后重新拉题库 —— 「挂载或依赖变化时拉数据」的标准写法，
    // fetchQuestions 内部会先置 loading 再发请求，属该规则的公认例外
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchQuestions(roleId, stage, difficulty);
  }, [roleId, stage, difficulty, fetchQuestions]);

  function toggleDone(id: string) {
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    setDone(next);
    try {
      window.localStorage.setItem(DONE_KEY, JSON.stringify(next));
    } catch {
      // localStorage 写不了不影响使用
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BookOpen className="h-6 w-6 text-primary" />
          题库练习
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          按岗位浏览面试题与考察维度。<strong className="font-medium text-foreground">不需要 AI 密钥</strong>
          即可使用 —— 断网、没配额、没配密钥时都能正常练习。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">选择岗位</CardTitle>
          <CardDescription>先选一级大类，再选细分岗位</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RolePicker value={roleId} onChange={setRoleId} idPrefix="practice" />

          {roleId ? (
            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                筛选
              </span>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
              >
                <option value="">全部题型</option>
                {Object.entries(STAGE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
              >
                <option value="">全部难度</option>
                {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              {payload ? (
                <span className="text-xs text-muted-foreground">
                  共 {payload.total} 题，当前显示 {payload.questions.length} 题
                  {done.length > 0 ? ` · 已练 ${done.length} 题` : ""}
                </span>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载题库…
        </div>
      ) : null}

      {payload && !loading ? (
        <>
          {/* 考察维度：答题时的参照标准 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{payload.role.label} · 考察维度</CardTitle>
              <CardDescription>
                面试官会从这 4 个方向切入。每题自测时，可以拿下面的「及格线」当尺子
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {payload.dimensions.map((d) => (
                <div key={d.name} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{d.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {d.weight}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{d.why}</p>
                  <p className="mt-2 text-xs leading-5">
                    <span className="text-muted-foreground">及格线：</span>
                    {d.probes[0]?.bar}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 题目列表 */}
          <div className="space-y-3">
            {payload.questions.map((q) => {
              const isDone = done.includes(q.id);
              const isOpen = expanded === q.id;
              return (
                <Card key={q.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleDone(q.id)}
                        aria-label={isDone ? "标记为未练" : "标记为已练"}
                        className={
                          isDone
                            ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-primary bg-primary text-primary-foreground"
                            : "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-transparent transition-colors hover:border-primary"
                        }
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{q.title}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {STAGE_LABELS[q.stage] ?? q.stage}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {DIFFICULTY_LABELS[q.difficulty] ?? q.difficulty}
                          </span>
                          {q.company ? (
                            <span className="text-xs text-muted-foreground">{q.company}</span>
                          ) : null}
                        </div>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {q.content}
                        </p>

                        {q.tags.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {q.tags.map((t) => (
                              <span
                                key={t}
                                className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {isOpen && payload.dimensions.length > 0 ? (
                          <div className="mt-3 space-y-2 rounded-lg bg-muted/50 p-3">
                            <p className="text-xs font-medium">自测参考（来自本岗位考察维度）</p>
                            {payload.dimensions.slice(0, 2).map((d) => (
                              <div key={d.name} className="text-xs leading-5">
                                <span className="text-muted-foreground">{d.name} · 合格表现：</span>
                                {d.probes[1]?.bar}
                              </div>
                            ))}
                            <p className="text-xs leading-5 text-muted-foreground">
                              答完后对照上面的及格线自查；配置 AI 密钥后可以让 AI 面试官实时点评。
                            </p>
                          </div>
                        ) : null}

                        {q.source?.type === "ai-generated" ? (
                          <p className="mt-2 text-xs text-muted-foreground/80">
                            来源：{q.source.name}
                          </p>
                        ) : null}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded(isOpen ? null : q.id)}
                        className="shrink-0 gap-1 text-xs text-muted-foreground"
                      >
                        {isOpen ? "收起" : "自测参考"}
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {payload.questions.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  该筛选条件下暂无题目，换个题型或难度试试。
                </CardContent>
              </Card>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
