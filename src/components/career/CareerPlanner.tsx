"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Clock3, FileText, Loader2, Target, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { ResumeUploader } from "@/components/resume/ResumeUploader";
import { SkillGapChart } from "@/components/career/SkillGapChart";
import { LearningPath } from "@/components/career/LearningPath";
import { CareerExportButtons } from "@/components/career/CareerExportButtons";
import { RolePicker } from "@/components/roles/RolePicker";
import { FeedbackPrompt } from "@/components/feedback/FeedbackPrompt";
import { useRoleTaxonomy } from "@/hooks/use-role-taxonomy";
import {
  EMPTY_CAREER_PROFILE,
  isCareerProfileComplete,
  loadCareerProfile,
} from "@/lib/career-profile";
import {
  clearCareerAnalysisHistory,
  getLatestCareerAnalysis,
  saveCareerAnalysis,
  type SavedCareerAnalysis,
} from "@/lib/career-analysis-history";
import { uploadResumeFile } from "@/lib/upload-client";
import type {
  CareerDiagnosis,
  CareerUserProfile,
  LearningPath as LearningPathType,
  ParsedResume,
  SkillGap,
} from "@/types";

interface CareerAnalysis {
  resume: ParsedResume;
  diagnosis: CareerDiagnosis;
  gap: SkillGap;
  path: LearningPathType;
  source: "ai" | "fallback";
}

export function CareerPlanner() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<CareerUserProfile>(EMPTY_CAREER_PROFILE);
  const [fileName, setFileName] = useState("");
  const [resumeText, setResumeText] = useState("");
  // 默认不预选：岗位体系覆盖 11 大类 / 64 个岗位，预选一个计算机岗位是有偏的
  const [targetRole, setTargetRole] = useState("");
  const [analysis, setAnalysis] = useState<CareerAnalysis | null>(null);
  const [savedAnalysis, setSavedAnalysis] = useState<SavedCareerAnalysis | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parseInfo, setParseInfo] = useState<{ fileType: string; pages?: number } | null>(null);

  // 岗位名一律从 data/roles 的岗位数据解析 —— 不再维护第二份岗位清单
  const { resolveRole } = useRoleTaxonomy();
  const selectedRoleLabel = useMemo(
    () => resolveRole(targetRole)?.label ?? "目标岗位",
    [targetRole, resolveRole]
  );

  const profileComplete = useMemo(() => isCareerProfileComplete(userProfile), [userProfile]);
  const analysisFileName = analysis && savedAnalysis && analysis === savedAnalysis ? savedAnalysis.fileName : fileName;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUserProfile(loadCareerProfile());
      const latest = getLatestCareerAnalysis();
      if (latest) {
        setSavedAnalysis(latest);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleUpload(file: File) {
    setError("");
    setWarnings([]);
    setParseInfo(null);
    setAnalysis(null);
    setIsReading(true);
    try {
      // 交由服务端解析：PDF / DOCX 需专用解析器，浏览器端直接读会得到乱码
      const result = await uploadResumeFile(file);
      if (!isResumeLike(result.rawText)) {
        throw new Error("这份文件不像简历，请上传包含教育经历、项目经历、技能栈或工作经历的简历。");
      }
      setFileName(result.fileName);
      setResumeText(result.rawText);
      setWarnings(result.warnings ?? []);
      setParseInfo({ fileType: result.fileType, pages: result.pages });
    } catch (err) {
      setFileName("");
      setResumeText("");
      setError(err instanceof Error ? err.message : "简历读取失败");
    } finally {
      setIsReading(false);
    }
  }

  async function handleAnalyze() {
    setError("");
    setAnalysis(null);

    if (!profileComplete) {
      router.push("/profile?redirect=/career&reason=career");
      return;
    }

    if (!resumeText.trim()) {
      setError("请先上传一份可读取文本的简历。");
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/career/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: resumeText, targetRole, fileName, userProfile }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "分析失败");
      }
      setAnalysis(data);
      const saved = saveCareerAnalysis({
          fileName,
          targetRole,
          source: data.source,
          resume: data.resume,
          diagnosis: data.diagnosis,
          gap: data.gap,
          path: data.path,
      });
      setSavedAnalysis(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败，请稍后重试。");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6">
      {savedAnalysis ? (
        <Card>
          <CardHeader>
            <Clock3 className="h-8 w-8 text-primary mb-2" />
            <CardTitle>最近一次职业规划</CardTitle>
            <CardDescription>
              {formatDate(savedAnalysis.createdAt)} 生成，目标岗位：{savedAnalysis.path.targetRole}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              已保存最近一次技能差距、关键诊断和学习路径。默认不展开，避免和新的上传分析混淆。
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAnalysis(savedAnalysis);
                  setTargetRole(savedAnalysis.targetRole);
                }}
              >
                查看最近规划
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  clearCareerAnalysisHistory();
                  setSavedAnalysis(null);
                  setAnalysis(null);
                }}
              >
                <Trash2 className="h-4 w-4" />
                清空规划
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <Upload className="h-8 w-8 text-primary mb-2" />
            <CardTitle>上传简历</CardTitle>
            <CardDescription>支持 PDF、DOCX、TXT、MD，系统会提取技能与项目经历</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ResumeUploader onUpload={handleUpload} disabled={isReading || isAnalyzing} fileName={fileName} />
            {isReading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                 正在解析简历内容
              </div>
            ) : null}
            {parseInfo && !isReading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>
                  已解析 {parseInfo.fileType.toUpperCase()} 简历
                  {parseInfo.pages ? ` · 共 ${parseInfo.pages} 页` : ""}
                  {` · ${resumeText.replace(/\s/g, "").length} 字`}
                </span>
              </div>
            ) : null}
            {warnings.map((warning) => (
              <div
                key={warning}
                className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Target className="h-8 w-8 text-primary mb-2" />
            <CardTitle>选择目标岗位</CardTitle>
            <CardDescription>
              {profileComplete
                ? `将结合 ${userProfile.currentStatus}、${userProfile.targetTimeline} 和简历分析技能差距`
                : "未完善个人信息时，点击分析会跳转到个人信息页"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RolePicker
              value={targetRole}
              onChange={setTargetRole}
              disabled={isAnalyzing}
              idPrefix="career"
            />
            <Button
              className="w-full"
              onClick={handleAnalyze}
              disabled={isReading || isAnalyzing || !targetRole}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在分析
                </>
              ) : (
                `分析 ${selectedRoleLabel} 差距`
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {analysis ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">分析结果</h2>
            <CareerExportButtons
              data={{
                resume: analysis.resume,
                diagnosis: analysis.diagnosis,
                gap: analysis.gap,
                path: analysis.path,
                roleLabel: selectedRoleLabel,
              }}
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>简历解析</CardTitle>
              <CardDescription>
                {analysisFileName} {analysis.source === "fallback" ? "，当前使用本地兜底分析结果" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResumePreview resume={analysis.resume} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>技能差距</CardTitle>
              <CardDescription>目标岗位：{analysis.path.targetRole}</CardDescription>
            </CardHeader>
            <CardContent>
              <SkillGapChart gap={analysis.gap} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>关键诊断</CardTitle>
              <CardDescription>
                风险等级：
                {analysis.diagnosis.riskLevel === "high"
                  ? "高"
                  : analysis.diagnosis.riskLevel === "medium"
                    ? "中"
                    : "低"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <div className="rounded-lg border p-4">
                <p className="mb-2 text-sm text-muted-foreground">核心问题</p>
                <p className="font-medium leading-7">{analysis.diagnosis.coreProblem}</p>
              </div>
              <ListBlock title="证据" items={analysis.diagnosis.evidence} />
              <ListBlock title="容易忽略的盲区" items={analysis.diagnosis.blindSpots} />
              <ListBlock title="短期突破点" items={analysis.diagnosis.quickWins} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>个性化学习路径</CardTitle>
              <CardDescription>按阶段补齐缺口技能，并沉淀可展示项目</CardDescription>
            </CardHeader>
            <CardContent>
              <LearningPath steps={analysis.path.steps} />
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            <FeedbackPrompt module="求职规划" />
          </div>
        </div>
        </div>
      ) : null}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="mb-2 text-sm text-muted-foreground">{title}</p>
      <ul className="space-y-2 text-sm">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="leading-6">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function isResumeLike(rawText: string) {
  const text = rawText.toLowerCase();
  const cleanLength = text.replace(/\s/g, "").length;
  const signals = [
    "简历",
    "教育",
    "学历",
    "本科",
    "硕士",
    "博士",
    "大学",
    "学院",
    "专业",
    "项目",
    "实习",
    "工作",
    "经历",
    "技能",
    "求职",
    "公司",
    "负责",
    "开发",
    "邮箱",
    "电话",
    "手机",
    "github",
    "experience",
    "education",
    "project",
    "skill",
    "resume",
  ];
  const skills = [
    "javascript",
    "typescript",
    "react",
    "vue",
    "next.js",
    "node.js",
    "java",
    "python",
    "mysql",
    "redis",
    "docker",
    "linux",
    "算法",
    "数据结构",
  ];
  const signalCount = signals.filter((keyword) => text.includes(keyword)).length;
  const skillCount = skills.filter((keyword) => text.includes(keyword)).length;
  const hasContactSignal = /[\w.-]+@[\w.-]+\.\w+|1[3-9]\d{9}/.test(rawText);

  if (cleanLength < 80) return false;
  if (signalCount >= 3) return true;
  return signalCount >= 2 && (skillCount >= 1 || hasContactSignal);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
