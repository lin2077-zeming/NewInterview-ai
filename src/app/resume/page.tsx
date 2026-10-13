"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, FileSearch, Loader2, RotateCcw, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResumeUploader } from "@/components/resume/ResumeUploader";
import { ResumeFixList } from "@/components/resume/ResumeFixList";
import { FeedbackPrompt } from "@/components/feedback/FeedbackPrompt";
import { RolePicker } from "@/components/roles/RolePicker";
import { uploadResumeFile } from "@/lib/upload-client";
import { recordOpcEvent } from "@/lib/opc-metrics";
import type { UsageCost } from "@/lib/ai/cost";
import {
  clearResumeDiagnosis,
  loadResumeDiagnosis,
  saveResumeDiagnosis,
  setAcceptedFixes,
  type SavedResumeDiagnosis,
} from "@/lib/resume-diagnosis-store";
import type { ResumeDiagnosis } from "@/types";

type AiUsage = Pick<UsageCost, "inputTokens" | "outputTokens" | "cost">;

export default function ResumePage() {
  const [fileName, setFileName] = useState("");
  const [rawText, setRawText] = useState("");
  // 默认「不指定」：不预选任何专业方向，避免对非计算机用户产生偏差
  const [targetRole, setTargetRole] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<ResumeDiagnosis | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
  const [showPaste, setShowPaste] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved: SavedResumeDiagnosis | null = loadResumeDiagnosis();
      if (saved) {
        setResult(saved.diagnosis);
        setAcceptedIds(saved.acceptedIds);
        setFileName(saved.fileName ?? "");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleUpload(file: File) {
    setError("");
    setWarnings([]);
    setResult(null);
    setIsReading(true);
    try {
      const uploaded = await uploadResumeFile(file);
      setFileName(uploaded.fileName);
      setRawText(uploaded.rawText);
      setWarnings(uploaded.warnings);
    } catch (err) {
      setFileName("");
      setRawText("");
      setError(err instanceof Error ? err.message : "简历读取失败");
    } finally {
      setIsReading(false);
    }
  }

  async function handleDiagnose() {
    setError("");
    if (!rawText.trim()) {
      setError("请先上传简历，或直接把简历文字粘贴到下方。");
      return;
    }
    setIsDiagnosing(true);
    const startedAt = performance.now();
    try {
      const response = await fetch("/api/resume/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, targetRole: targetRole || undefined, fileName }),
      });
      const durationMs = performance.now() - startedAt;
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "诊断失败，请稍后重试。");
      }
      const { usage, ...diagnosisData } = data as ResumeDiagnosis & { usage?: AiUsage };
      const diagnosis = diagnosisData as ResumeDiagnosis;
      setResult(diagnosis);
      const saved = saveResumeDiagnosis({ diagnosis, fileName, targetRole });
      setAcceptedIds(saved.acceptedIds);

      // 记录一次交付，用于 OPC 度量看板
      recordOpcEvent({
        kind: "resume_diagnose",
        durationMs,
        source: diagnosis.source,
        usage,
        units: diagnosis.fixes.length,
        label: `${fileName || "粘贴的简历"} · ${diagnosis.fixes.length} 条建议`,
        score: diagnosis.score,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "诊断失败，请稍后重试。");
    } finally {
      setIsDiagnosing(false);
    }
  }

  function toggleAccepted(id: string) {
    const next = acceptedIds.includes(id)
      ? acceptedIds.filter((item) => item !== id)
      : [...acceptedIds, id];
    setAcceptedIds(next);
    setAcceptedFixes(next);
  }

  function handleReset() {
    clearResumeDiagnosis();
    setResult(null);
    setAcceptedIds([]);
    setFileName("");
    setRawText("");
    setWarnings([]);
    setError("");
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">简历诊断</h1>
        <p className="text-sm text-muted-foreground">
          上传简历，得到一份<strong className="font-medium text-foreground">可执行的修改清单</strong>
          ：每一条都引用你的原句，并给出可以直接替换进去的改后句子。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <Upload className="mb-2 h-8 w-8 text-primary" />
            <CardTitle>上传简历</CardTitle>
            <CardDescription>支持 PDF、DOCX、TXT、MD，单文件不超过 5MB</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ResumeUploader onUpload={handleUpload} disabled={isReading || isDiagnosing} fileName={fileName} />
            {isReading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在解析简历内容
              </div>
            ) : null}
            {rawText && !isReading ? (
              <p className="text-sm text-muted-foreground">
                已读取 {rawText.replace(/\s/g, "").length} 字
              </p>
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
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setShowPaste((prev) => !prev)}
            >
              {showPaste ? "收起" : "或者直接把简历文字粘贴进来"}
            </button>
            {showPaste ? (
              <textarea
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                placeholder="把简历全文粘贴到这里…"
                className="min-h-40 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus-visible:border-ring"
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <FileSearch className="mb-2 h-8 w-8 text-primary" />
            <CardTitle>目标岗位</CardTitle>
            <CardDescription>指定岗位后，会额外检查岗位关键词缺口</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RolePicker
              value={targetRole}
              onChange={setTargetRole}
              disabled={isDiagnosing || isReading}
              idPrefix="resume"
              allowEmpty
              emptyLabel="不指定（按通用标准）"
            />
            <Button className="w-full" onClick={handleDiagnose} disabled={isReading || isDiagnosing}>
              {isDiagnosing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在诊断
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  生成修改清单
                </>
              )}
            </Button>
            {result ? (
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

      {result ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                诊断结论
                <span
                  className={
                    result.source === "ai"
                      ? "rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                      : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {result.source === "ai" ? "AI 诊断" : "离线规则诊断"}
                </span>
                {result.score < 80 ? (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                    修改后可重新诊断对比
                  </span>
                ) : null}
              </CardTitle>
              <CardDescription>
                {result.targetRole ? `目标岗位：${result.targetRole}` : "未指定目标岗位"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
                <div className="rounded-xl border px-6 py-4 text-center">
                  <p className="text-xs text-muted-foreground">简历可投递度</p>
                  <p className="text-3xl font-bold tabular-nums">{result.score}</p>
                </div>
                <div>
                  <p className="font-medium leading-7">{result.verdict}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.summary}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <ResumeFixList fixes={result.fixes} acceptedIds={acceptedIds} onToggle={toggleAccepted} />

          {/* 快捷反馈：紧贴 AI 输出之后。只有 result 存在时才渲染，因此
              加载中 / 报错 / 空结果都不会出现 */}
          <FeedbackPrompt module="简历诊断" />

          {result.source === "fallback" ? (
            <p className="text-xs text-muted-foreground">
              当前为离线规则诊断（未配置 AI 密钥或调用超时）。配置密钥后可获得逐句重写的 AI 建议。
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 border-t pt-4">
            <Link href="/interview/new">
              <Button variant="outline">按目标岗位练习面试 →</Button>
            </Link>
            <Link href="/career">
              <Button variant="outline">看技能差距与学习路径 →</Button>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
