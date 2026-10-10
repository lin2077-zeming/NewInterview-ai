"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload } from "lucide-react";
import { COMPANY_FLOWS, ROLES } from "@/config/interview-stages";
import { loadCareerProfile } from "@/lib/career-profile";
import {
  buildCandidateProfileSummary,
  buildResumeSummaryFromFile,
  saveInterviewContext,
} from "@/lib/interview-context";
import type { InterviewMode } from "@/types";

export default function NewInterviewPage() {
  const router = useRouter();
  const [mode, setMode] = useState<InterviewMode>("normal");
  const [company, setCompany] = useState("bytedance");
  const [role, setRole] = useState("");
  const [stageIndex, setStageIndex] = useState(0);
  const [stressMode, setStressMode] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const flow = COMPANY_FLOWS[company] ?? COMPANY_FLOWS.bytedance;

  const handleStart = async () => {
    if (!role) return;
    setLoading(true);

    try {
      const res = await fetch("/api/interview/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: { role, company, mode, stressMode, stageIndex },
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `创建面试失败 (HTTP ${res.status})`);
      }
      const { interviewId } = await res.json();
      const profile = loadCareerProfile();
      const candidateProfileSummary = buildCandidateProfileSummary(profile);
      const resumeSummary = await buildResumeSummaryFromFile(resumeFile);

      saveInterviewContext(interviewId, {
        candidateProfileSummary,
        resumeSummary,
        resumeFileName: resumeFile?.name,
      });

      const params = new URLSearchParams({
        mode,
        role,
        company,
        stage: String(stageIndex),
        stress: String(stressMode),
        profile: candidateProfileSummary ? "1" : "0",
        resume: resumeSummary ? "1" : "0",
      });

      router.push(`/interview/${interviewId}?${params.toString()}`);
    } catch (err) {
      console.error("创建面试失败:", err);
      setLoading(false);
    }
  };

  return (
    <>
      <div className="hidden lg:block">
    <div className="max-w-6xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold gradient-text mb-2">创建新面试</h1>
        <p className="text-muted-foreground">配置你的 AI 模拟面试环境</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ====== 左栏：核心配置 ====== */}
        <div className="flex-1 space-y-6">
          <Card className="glass border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle>面试模式</CardTitle>
              <CardDescription>选择你的角色</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as InterviewMode)} className="flex gap-6">
                <label htmlFor="normal" className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="normal" id="normal" />
                  <span>我是候选人（AI 面试我）</span>
                </label>
                <label htmlFor="reversed" className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="reversed" id="reversed" />
                  <span>我是面试官（我面试 AI）</span>
                </label>
              </RadioGroup>
            </CardContent>
          </Card>

          <Card className="glass border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle>目标公司与岗位</CardTitle>
              <CardDescription>选择你心仪的公司和目标岗位</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>公司</Label>
                  <Select
                    value={company}
                    onValueChange={(v) => {
                      if (!v) return;
                      setCompany(v);
                      setStageIndex(0);
                    }}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue>{COMPANY_FLOWS[company]?.name || "选择公司"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(COMPANY_FLOWS).map(([key, f]) => (
                        <SelectItem key={key} value={key}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>岗位</Label>
                  <Select value={role} onValueChange={(v) => v && setRole(v)}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue>{role || "选择目标岗位"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>面试部分</Label>
                <Select
                  value={String(stageIndex)}
                  onValueChange={(v) => v && setStageIndex(Number(v))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue>{flow.stages[stageIndex]?.name || "选择本次面试部分"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {flow.stages.map((stage, index) => (
                      <SelectItem key={`${stage.id}-${index}`} value={String(index)}>
                        {stage.name} · {stage.duration} 分钟
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Button
            size="lg"
            className="w-full py-6 text-base rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-[1.02]"
            onClick={handleStart}
            disabled={!role || loading}
          >
            {loading ? "创建中..." : "开始面试"}
          </Button>
        </div>

        {/* ====== 右栏：辅助选项 ====== */}
        <div className="lg:w-80 space-y-6">
          <Card className="glass border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle>压力面模式</CardTitle>
              <CardDescription>开启后 AI 将持续追问边界条件和缺陷</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="stress-mode">开启压力面</Label>
                <Switch id="stress-mode" checked={stressMode} onCheckedChange={setStressMode} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle>简历（可选）</CardTitle>
              <CardDescription>
                支持 txt、md 等纯文本简历；其他格式会记录文件名，并由面试官追问补充
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  {resumeFile ? resumeFile.name : "拖拽文件或点击上传"}
                </p>
                <label className="inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium transition-colors h-7 px-2.5 cursor-pointer">
                  选择文件
                  <input
                    type="file"
                    accept=".txt,.md,.markdown,text/plain,text/markdown"
                    className="hidden"
                    onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
      </div>

      <MobileNewInterview
        mode={mode}
        company={company}
        role={role}
        stageIndex={stageIndex}
        stressMode={stressMode}
        resumeFile={resumeFile}
        loading={loading}
        onModeChange={setMode}
        onCompanyChange={(value) => {
          setCompany(value);
          setStageIndex(0);
        }}
        onRoleChange={setRole}
        onStageIndexChange={setStageIndex}
        onStressModeChange={setStressMode}
        onResumeFileChange={setResumeFile}
        onStart={handleStart}
      />
    </>
  );
}

function MobileNewInterview({
  mode,
  company,
  role,
  stageIndex,
  stressMode,
  resumeFile,
  loading,
  onModeChange,
  onCompanyChange,
  onRoleChange,
  onStageIndexChange,
  onStressModeChange,
  onResumeFileChange,
  onStart,
}: {
  mode: InterviewMode;
  company: string;
  role: string;
  stageIndex: number;
  stressMode: boolean;
  resumeFile: File | null;
  loading: boolean;
  onModeChange: (mode: InterviewMode) => void;
  onCompanyChange: (company: string) => void;
  onRoleChange: (role: string) => void;
  onStageIndexChange: (index: number) => void;
  onStressModeChange: (enabled: boolean) => void;
  onResumeFileChange: (file: File | null) => void;
  onStart: () => void;
}) {
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const flow = COMPANY_FLOWS[company] ?? COMPANY_FLOWS.bytedance;
  const selectedStage = flow.stages[stageIndex] ?? flow.stages[0];

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] overflow-x-hidden px-4 py-5 pb-[calc(2rem+env(safe-area-inset-bottom))] lg:hidden">
      <div className="mb-5 text-center">
        <h1 className="text-2xl font-extrabold gradient-text">创建新面试</h1>
        <p className="mt-2 text-sm text-muted-foreground">配置你的 AI 模拟面试环境</p>
      </div>

      <div className="space-y-4">
        <MobileSection title="面试模式" description="选择你的角色">
          <div className="grid gap-2">
            <MobileChoiceCard
              selected={mode === "normal"}
              title="我是候选人"
              description="AI 面试我"
              onClick={() => onModeChange("normal")}
            />
            <MobileChoiceCard
              selected={mode === "reversed"}
              title="我是面试官"
              description="我面试 AI"
              onClick={() => onModeChange("reversed")}
            />
          </div>
        </MobileSection>

        <MobileSection title="目标公司与岗位" description="选择公司、岗位和本次面试部分">
          <MobileLabel>公司</MobileLabel>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(COMPANY_FLOWS).map(([key, item]) => (
              <MobileChoiceButton
                key={key}
                selected={company === key}
                onClick={() => onCompanyChange(key)}
              >
                {item.name}
              </MobileChoiceButton>
            ))}
          </div>

          <MobileLabel className="mt-4">岗位</MobileLabel>
          <div className="grid gap-2">
            {ROLES.map((item) => (
              <MobileChoiceButton
                key={item}
                selected={role === item}
                onClick={() => onRoleChange(item)}
              >
                {item}
              </MobileChoiceButton>
            ))}
          </div>

          <MobileLabel className="mt-4">面试部分</MobileLabel>
          <div className="grid gap-2">
            {flow.stages.map((stage, index) => (
              <MobileChoiceCard
                key={`${stage.id}-${index}`}
                selected={stageIndex === index}
                title={stage.name}
                description={`${stage.focus} · ${stage.duration} 分钟`}
                onClick={() => onStageIndexChange(index)}
              />
            ))}
          </div>
        </MobileSection>

        <MobileSection title="压力面模式" description="开启后 AI 将持续追问边界条件和缺陷">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">开启压力面</p>
              <p className="text-xs text-muted-foreground">
                当前：{stressMode ? "已开启" : "未开启"}
              </p>
            </div>
            <button
              type="button"
              aria-pressed={stressMode}
              aria-label="切换压力面模式"
              onClick={() => onStressModeChange(!stressMode)}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors touch-manipulation ${
                stressMode ? "bg-primary" : "bg-input"
              }`}
            >
              <span
                className={`absolute top-1 size-6 rounded-full bg-background shadow-sm transition-transform ${
                  stressMode ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </MobileSection>

        <MobileSection title="简历（可选）" description="支持 txt、md 等纯文本简历；其他格式会记录文件名，并由面试官追问补充">
          <div className="rounded-lg border-2 border-dashed p-5 text-center">
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="mb-3 text-sm text-muted-foreground">
              {resumeFile ? resumeFile.name : "可选上传简历文本"}
            </p>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium touch-manipulation"
              onClick={() => resumeInputRef.current?.click()}
            >
              选择文件
            </button>
            <input
              ref={resumeInputRef}
              type="file"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              className="sr-only"
              onChange={(event) => onResumeFileChange(event.target.files?.[0] ?? null)}
            />
          </div>
        </MobileSection>
      </div>

      <button
        type="button"
        className="mt-5 flex h-14 w-full items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 touch-manipulation disabled:pointer-events-none disabled:opacity-45"
        onClick={onStart}
        disabled={!role || loading}
      >
        {loading ? "创建中..." : role ? "开始面试" : "请选择目标岗位"}
      </button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {role
          ? `${COMPANY_FLOWS[company]?.name ?? "目标公司"} · ${role} · ${selectedStage?.name ?? "当前模块"}`
          : "选择岗位后即可开始"}
      </p>
    </div>
  );
}

function MobileSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="text-lg font-bold">{title}</h2>
      {description ? (
        <p className="mt-1 mb-4 text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </section>
  );
}

function MobileLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={`mb-2 text-sm font-semibold ${className || ""}`}>{children}</p>;
}

function MobileChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 select-none rounded-lg border px-3 py-2 text-left text-sm font-medium touch-manipulation ${
        selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"
      }`}
    >
      {children}
    </button>
  );
}

function MobileChoiceCard({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-16 w-full select-none items-center gap-3 rounded-lg border p-3 text-left touch-manipulation ${
        selected ? "border-primary bg-primary/5" : "border-border bg-background"
      }`}
    >
      <span
        className={`size-4 shrink-0 rounded-full border ${
          selected ? "border-primary bg-primary shadow-[inset_0_0_0_3px_white]" : "border-input"
        }`}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
