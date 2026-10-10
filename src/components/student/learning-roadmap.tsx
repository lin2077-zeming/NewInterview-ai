"use client";

import { useState, useCallback, useRef } from "react";
import type { LearningRoadmap } from "@//types/student";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  Wrench,
  Flag,
  FolderOpen,
  Loader2,
  Lightbulb,
} from "lucide-react";

interface LearningRoadmapProps {
  career: string;
  profile: {
    major: string;
    skills: string;
  };
  roadmap: LearningRoadmap | null;
  onRoadmapLoaded: (roadmap: LearningRoadmap) => void;
  completedMilestones: Record<number, number[]>;
  onToggleMilestone: (phaseIndex: number, milestoneIndex: number) => void;
  isLoading: boolean;
  onSetLoading: (loading: boolean) => void;
}

function parseJSON(text: string): LearningRoadmap | null {
  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return parsed.roadmap as LearningRoadmap;
  } catch {
    return null;
  }
}

const phaseColors = [
  {
    bg: "bg-amber-50 dark:bg-amber-950",
    border: "border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
    badge: "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
  },
  {
    bg: "bg-blue-50 dark:bg-blue-950",
    border: "border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
    badge: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
  },
  {
    bg: "bg-purple-50 dark:bg-purple-950",
    border: "border-purple-200 dark:border-purple-800",
    dot: "bg-purple-500",
    badge: "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
  },
  {
    bg: "bg-emerald-50 dark:bg-emerald-950",
    border: "border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
  },
];

export function LearningRoadmapView({
  career,
  profile,
  roadmap,
  onRoadmapLoaded,
  completedMilestones,
  onToggleMilestone,
  isLoading,
  onSetLoading,
}: LearningRoadmapProps) {
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([1]));
  const fetchingRef = useRef(false);

  const togglePhase = (phase: number) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  };

  const generateRoadmap = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    onSetLoading(true);
    setRawText("");
    setError(null);

    try {
      const response = await fetch("/api/career/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          career,
          major: profile.major,
          skills: profile.skills,
        }),
      });

      if (!response.ok) throw new Error("请求失败");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as { content?: string; error?: string };
              if (parsed.error) {
                setError(parsed.error);
                continue;
              }
              if (parsed.content) {
                fullText += parsed.content;
                setRawText(fullText);
              }
            } catch {
              // skip
            }
          }
        }
      }

      const result = parseJSON(fullText);
      if (result) {
        onRoadmapLoaded(result);
      } else {
        setError("AI 返回的数据格式异常，请重试");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成学习路线失败");
    } finally {
      fetchingRef.current = false;
      onSetLoading(false);
    }
  }, [career, profile, onRoadmapLoaded, onSetLoading]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
              AI 正在制定学习路线...
            </CardTitle>
            <CardDescription>
              为「{career}」方向量身定制学习计划
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rawText ? (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-sm text-slate-600 dark:text-slate-300 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                {rawText}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
                <Spinner className="w-5 h-5" />
                <span>正在深度思考中，这可能需要一些时间...</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <Card>
          <CardHeader>
            <CardTitle>为「{career}」生成学习路线</CardTitle>
            <CardDescription>
              AI 将为你制定从基础到进阶的完整学习规划
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}
            <Button
              onClick={generateRoadmap}
              size="lg"
              className="bg-amber-600 hover:bg-amber-700 text-white px-8 gap-2"
            >
              <Lightbulb className="w-4 h-4" />
              生成学习路线
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          {roadmap.career} 学习路线
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{roadmap.overview}</p>
        <div className="flex items-center justify-center gap-2 mt-2 text-sm text-slate-400 dark:text-slate-500">
          <Clock className="w-4 h-4" />
          预计总时长：{roadmap.totalDuration}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative space-y-0">
        {roadmap.phases.map((phase, index) => {
          const colors = phaseColors[index % phaseColors.length];
          const isExpanded = expandedPhases.has(phase.phase);
          const completedCount =
            completedMilestones[phase.phase]?.length || 0;
          const totalMilestones = phase.milestones.length;
          const isPhaseComplete = completedCount === totalMilestones && totalMilestones > 0;

          return (
            <div key={phase.phase}>
              <Card
                className={`mb-4 ${colors.border} transition-all duration-200`}
              >
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => togglePhase(phase.phase)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full ${colors.dot} flex items-center justify-center text-white font-bold text-sm`}
                      >
                        {isPhaseComplete ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          phase.phase
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {phase.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={colors.badge}>
                            <Clock className="w-3 h-3 mr-1" />
                            {phase.duration}
                          </Badge>
                          {totalMilestones > 0 && (
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              {completedCount}/{totalMilestones} 里程碑
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    )}
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-4 pt-0">
                    <p className="text-slate-600 dark:text-slate-300 text-sm">
                      {phase.description}
                    </p>

                    {/* Goals */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-2">
                        <Target className="w-4 h-4 text-amber-500" />
                        阶段目标
                      </h4>
                      <ul className="space-y-1">
                        {phase.goals.map((goal, i) => (
                          <li
                            key={i}
                            className="text-sm text-slate-600 flex items-start gap-2"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                            {goal}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Skills */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-2">
                        <Wrench className="w-4 h-4 text-blue-500" />
                        核心技能
                      </h4>
                      <div className="space-y-2">
                        {phase.skills.map((skill, i) => (
                          <div
                            key={i}
                            className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {skill.name}
                              </span>
                              <Badge
                                variant="outline"
                                className={
                                  skill.priority === "高"
                                    ? "border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
                                    : skill.priority === "中"
                                      ? "border-amber-200 dark:border-amber-700 text-amber-600 dark:text-amber-400"
                                      : "border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400"
                                }
                              >
                                {skill.priority}优先
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {skill.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Milestones */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-2">
                        <Flag className="w-4 h-4 text-emerald-500" />
                        里程碑
                      </h4>
                      <div className="space-y-1.5">
                        {phase.milestones.map((milestone, i) => {
                          const isCompleted =
                            completedMilestones[phase.phase]?.includes(i);
                          return (
                            <label
                              key={i}
                              className="flex items-center gap-2 text-sm cursor-pointer group"
                            >
                              <input
                                type="checkbox"
                                checked={isCompleted || false}
                                onChange={() =>
                                  onToggleMilestone(phase.phase, i)
                                }
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500"
                              />
                              <span
                                className={
                                  isCompleted
                                    ? "line-through text-slate-400 dark:text-slate-500"
                                    : "text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-slate-200"
                                }
                              >
                                {milestone}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Projects */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-2">
                        <FolderOpen className="w-4 h-4 text-purple-500" />
                        实践项目
                      </h4>
                      <ul className="space-y-1">
                        {phase.projects.map((project, i) => (
                          <li
                            key={i}
                            className="text-sm text-slate-600 flex items-start gap-2"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                            {project}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          );
        })}
      </div>

      {/* Tips */}
      {roadmap.tips && roadmap.tips.length > 0 && (
        <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              学习建议
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {roadmap.tips.map((tip, i) => (
                <li
                  key={i}
                  className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2"
                >
                  <span className="text-amber-500 font-bold">
                    {i + 1}.
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center gap-3">
        <Button
          variant="outline"
          onClick={generateRoadmap}
          disabled={isLoading}
        >
          重新生成路线
        </Button>
      </div>
    </div>
  );
}
