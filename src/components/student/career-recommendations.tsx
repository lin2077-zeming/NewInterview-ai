"use client";

import { useState, useCallback, useRef } from "react";
import type { CareerRecommendations } from "@//types/student";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronRight,
  TrendingUp,
  DollarSign,
  Target,
  Loader2,
} from "lucide-react";

interface CareerRecommendationsProps {
  profile: {
    major: string;
    interests: string[];
    skills: string;
    expectation: string;
  };
  onSelectCareer: (career: string) => void;
  recommendations: CareerRecommendations | null;
  onRecommendationsLoaded: (data: CareerRecommendations) => void;
  isLoading: boolean;
  onSetLoading: (loading: boolean) => void;
}

function parseJSON(text: string): CareerRecommendations | null {
  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(cleaned) as CareerRecommendations;
  } catch {
    return null;
  }
}

export function CareerRecommendationsView({
  profile,
  onSelectCareer,
  recommendations,
  onRecommendationsLoaded,
  isLoading,
  onSetLoading,
}: CareerRecommendationsProps) {
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Keep a ref to the ongoing fetch so it survives remounts
  const fetchingRef = useRef(false);

  const generateRecommendations = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    onSetLoading(true);
    setRawText("");
    setError(null);

    try {
      const response = await fetch("/api/career/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          major: profile.major,
          interests: profile.interests.join("、"),
          skills: profile.skills,
          expectation: profile.expectation,
        }),
      });

      if (!response.ok) {
        throw new Error("请求失败");
      }

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
              // skip malformed chunks
            }
          }
        }
      }

      const result = parseJSON(fullText);
      if (result) {
        onRecommendationsLoaded(result);
      } else {
        setError("AI 返回的数据格式异常，请重试");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成推荐失败");
    } finally {
      fetchingRef.current = false;
      onSetLoading(false);
    }
  }, [profile, onRecommendationsLoaded, onSetLoading]);

  const difficultyColor: Record<string, string> = {
    容易: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
    中等: "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
    较难: "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300",
    困难: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300",
  };

  // If we already have recommendations, show them
  if (recommendations && !isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            为你推荐的职业方向
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{recommendations.analysis}</p>
        </div>

        {recommendations.careers.map((career, index) => (
          <Card
            key={career.name}
            className="hover:shadow-md transition-shadow duration-200 cursor-pointer group"
            onClick={() => onSelectCareer(career.name)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <CardTitle className="text-lg group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                      {career.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="secondary"
                        className={difficultyColor[career.difficulty] || ""}
                      >
                        {career.difficulty}
                      </Badge>
                      {career.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {career.matchScore}%
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">匹配度</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={career.matchScore} className="h-2" />
              <p className="text-slate-600 dark:text-slate-300 text-sm">{career.description}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300">{career.salary}</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300">{career.prospects}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Target className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5" />
                {career.coreSkills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center justify-end pt-1 text-amber-600 dark:text-amber-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                查看学习路线 <ChevronRight className="w-4 h-4" />
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={generateRecommendations}
            disabled={isLoading}
          >
            重新生成推荐
          </Button>
        </div>
      </div>
    );
  }

  // Loading state with streaming text
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
              AI 正在分析你的职业方向...
            </CardTitle>
            <CardDescription>
              根据你的专业和兴趣，正在生成个性化推荐
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
                <span>正在生成中，请稍候...</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Initial state - show generate button
  return (
    <div className="max-w-2xl mx-auto text-center">
      <Card>
        <CardHeader>
          <CardTitle>准备好获取职业推荐了</CardTitle>
          <CardDescription>
            基于「{profile.major}」专业和「
            {profile.interests.join("、")}」兴趣方向
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}
          <Button
            onClick={generateRecommendations}
            size="lg"
            className="bg-amber-600 hover:bg-amber-700 text-white px-8 gap-2"
          >
            <Sparkles className="w-4 h-4" />
            生成 AI 职业推荐
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Sparkles({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
      />
    </svg>
  );
}
