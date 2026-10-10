"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  CircleX,
  ClipboardList,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReviewExportButtons } from "@/components/review/ReviewExportButtons";
import type { DimensionScores, ReviewReport } from "@/types";

export default function ReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const roleText = searchParams.get("role") || "目标岗位";
  const companyText = searchParams.get("company") || "目标公司";
  const isReversed = searchParams.get("mode") === "reversed";
  const stageIndex = searchParams.get("stage") || "";
  const stageId = searchParams.get("stageId") || "";
  const nextStage = searchParams.get("nextStage") || "";

  const [report, setReport] = useState<ReviewReport | null>(null);
  const [generatedNow, setGeneratedNow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadReview() {
      try {
        // Try to get existing review first
        const getRes = await fetch(`/api/interview/review/${id}`);
        if (getRes.ok) {
          const data = await getRes.json();
          if (data.report) {
            setReport(data.report);
            setLoading(false);
            return;
          }
        }

        // No existing review, generate one
        const genRes = await fetch(`/api/interview/review/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: stageId ? JSON.stringify({ stage: stageId }) : undefined,
        });
        if (!genRes.ok) {
          const errData = await genRes.json().catch(() => ({}));
          throw new Error(errData.error || `生成复盘报告失败 (HTTP ${genRes.status})`);
        }
        const genData = await genRes.json();
        setReport(genData.report);
        setGeneratedNow(true);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "复盘报告生成失败，请稍后重试"
        );
      } finally {
        setLoading(false);
      }
    }
    loadReview();
  }, [id, stageId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">复盘报告</h1>
          <p className="mt-2 text-muted-foreground">正在生成复盘报告，请稍候...</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin" />
            <p>AI 正在分析你的面试表现...</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">复盘报告</h1>
          <p className="mt-2 text-muted-foreground">
            暂时无法生成本次面试复盘
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              生成失败
            </CardTitle>
            <CardDescription>
              {errorMessage || "本次面试记录不足，无法进行有效复盘。"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/interview/new">
              <Button>重新开始面试</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const verdict = getVerdictMeta(report);

  return (
    <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant={generatedNow ? "default" : "secondary"}>
              {generatedNow ? "已生成新报告" : "已读取历史报告"}
            </Badge>
            <Badge variant="outline">
              {companyText} · {roleText}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold">复盘报告</h1>
          <p className="mt-2 text-muted-foreground">
            {isReversed
              ? "基于本次面试对话，评估你的提问质量、追问深度和面试官能力"
              : "基于本次面试对话，评估通过概率、关键短板和下一步提升路径"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReviewExportButtons report={report} />
          <Link href="/interview/new">
            <Button variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              再练一次
            </Button>
          </Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-[1.1fr_1.9fr]">
        <Card className={`border ${verdict.borderClass}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <verdict.icon className={`h-5 w-5 ${verdict.iconClass}`} />
              {isReversed ? "面试官能力结论" : "正式面试结论"}
            </CardTitle>
            <CardDescription>{report.hiringVerdict}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-bold">{report.overallScore}</span>
              <span className="mb-1 text-sm text-muted-foreground">/ 100</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Badge variant={verdict.badgeVariant}>{verdict.label}</Badge>
              <span className="text-sm text-muted-foreground">
                {isReversed ? "有效面试能力" : "通过概率"} {report.passProbability}%
              </span>
            </div>
            <div className="mt-5">
              <p className="text-sm font-medium">核心诊断</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {report.coreDiagnosis}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              能力维度评分
            </CardTitle>
            <CardDescription>
              {isReversed
                ? "重点看问题设计、追问质量、判断逻辑和岗位匹配意识"
                : "判断问题不是只看总分，而是看短板是否命中岗位核心要求"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DimensionBars scores={report.dimensionScores} />
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <SummaryList
          title="主要优势"
          icon={CheckCircle2}
          items={report.top3Strengths.map((item) => ({
            title: item.point,
            body: item.example,
          }))}
        />
        <SummaryList
          title="主要问题"
          icon={AlertTriangle}
          items={report.top3Weaknesses.map((item) => ({
            title: item.point,
            body: `${item.example} 建议：${item.suggestion}`,
          }))}
        />
      </section>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            逐题复盘
          </CardTitle>
          <CardDescription>
            {isReversed
              ? "按「你的提问 → AI 候选人回答 → 提问质量 → 更好追问」拆解"
              : "按「面试官问题 → 你的回答 → 问题定位 → 示范回答」拆解"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {report.perQuestionAnalysis.length > 0 ? (
            report.perQuestionAnalysis.map((item, index) => (
              <div key={`${item.question}-${index}`} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {isReversed ? "你的提问" : "问题"} {index + 1}：
                      {item.question}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {isReversed ? "AI 候选人回答" : "你的回答"}：
                      {item.yourAnswer}
                    </p>
                  </div>
                  <Badge variant={item.score >= 7 ? "secondary" : "destructive"}>
                    {item.score}/10
                  </Badge>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <MiniList
                    title={isReversed ? "提问做得好的地方" : "答得好的地方"}
                    items={item.strengths}
                  />
                  <MiniList title="需要改进" items={item.weaknesses} />
                </div>

                <div className="mt-4 rounded-md bg-muted/50 p-3">
                  <p className="text-sm font-medium">
                    {isReversed ? "更好的追问方式" : "更好的回答方式"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.suggestedAnswer}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              本次对话轮次较少，暂未形成逐题复盘。
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            提升计划
          </CardTitle>
          <CardDescription>
            {isReversed
              ? "按优先级提升提问设计、追问深度和候选人判断能力"
              : "按优先级补齐影响通过率的关键能力"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-3 md:grid-cols-2">
          {report.improvementPlan.map((item, index) => (
            <div
              key={`${item.area}-${index}`}
              className="min-w-0 overflow-hidden rounded-lg border p-4"
            >
              <div className="flex min-w-0 items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <p className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">
                  {item.area}
                </p>
              </div>
              <p className="mt-3 break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                {item.action}
              </p>
              {item.resources.length > 0 && (
                <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                  {item.resources.map((resource) => (
                    <Badge
                      key={resource}
                      variant="outline"
                      className="max-w-full whitespace-normal break-words text-left leading-relaxed [overflow-wrap:anywhere]"
                    >
                      {resource}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 继续 / 返回按钮 */}
      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
        {nextStage && nextStage !== "completed" ? (
          <>
            <Link
              href={`/interview/${id}?mode=${isReversed ? "reversed" : "normal"}&role=${encodeURIComponent(roleText)}&company=${encodeURIComponent(companyText)}&stage=${Number(stageIndex) + 1}`}
            >
              <Button size="lg" className="gap-2 bg-amber-600 hover:bg-amber-700 text-white px-8">
                继续下一轮面试
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.back()}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              返回面试页
            </Button>
          </>
        ) : (
          <Link href="/">
            <Button size="lg" className="gap-2 px-8">
              返回首页
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </main>
  );
}

function DimensionBars({ scores }: { scores: DimensionScores }) {
  const dimensions = [
    ["技术能力", scores.technical],
    ["沟通表达", scores.communication],
    ["思维逻辑", scores.logic],
    ["知识深度", scores.depth],
    ["代码能力", scores.coding],
  ].filter((item): item is [string, number] => typeof item[1] === "number");

  return (
    <div className="space-y-4">
      {dimensions.map(([label, score]) => (
        <div key={label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium">{label}</span>
            <span className="tabular-nums text-muted-foreground">{score}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${Math.max(4, Math.min(score, 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryList({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof CheckCircle2;
  items: Array<{ title: string; body: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <div key={`${item.title}-${index}`} className="rounded-lg border p-3">
            <p className="font-medium">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {item.body}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getVerdictMeta(report: ReviewReport) {
  switch (report.passDecision) {
    case "strong_pass":
      return {
        label: "强通过",
        icon: CheckCircle2,
        iconClass: "text-green-600",
        borderClass: "border-green-500/30",
        badgeVariant: "default" as const,
      };
    case "pass":
      return {
        label: "通过",
        icon: CheckCircle2,
        iconClass: "text-green-600",
        borderClass: "border-green-500/30",
        badgeVariant: "secondary" as const,
      };
    case "borderline":
      return {
        label: "边缘",
        icon: AlertTriangle,
        iconClass: "text-amber-600",
        borderClass: "border-amber-500/30",
        badgeVariant: "outline" as const,
      };
    case "fail":
      return {
        label: "未通过",
        icon: CircleX,
        iconClass: "text-destructive",
        borderClass: "border-destructive/30",
        badgeVariant: "destructive" as const,
      };
  }
}
