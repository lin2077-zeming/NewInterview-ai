"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EMPTY_CAREER_PROFILE,
  isCareerProfileComplete,
  loadCareerProfile,
  saveCareerProfile,
} from "@/lib/career-profile";
import type { CareerUserProfile } from "@/types";

export function CareerProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const reason = searchParams.get("reason");
  const [profile, setProfile] = useState<CareerUserProfile>(EMPTY_CAREER_PROFILE);
  const [saved, setSaved] = useState(false);
  const complete = useMemo(() => isCareerProfileComplete(profile), [profile]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProfile(loadCareerProfile());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updateProfile(field: keyof CareerUserProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  function handleSave() {
    if (!complete) return;
    saveCareerProfile(profile);
    setSaved(true);
    if (redirect) {
      router.push(redirect);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">个人信息</h1>
        <p className="mt-2 text-muted-foreground">
          这些信息会用于职业规划分析，让系统识别简历之外的真实状态、限制和痛点。
        </p>
      </div>

      {reason === "career" ? (
        <div className="mb-6 flex items-start gap-2 rounded-lg border bg-muted p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>请先完善并保存个人信息，然后再使用职业规划分析功能。</span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>完善个人信息</CardTitle>
          <CardDescription>带星号的字段会影响分析质量，保存后会留在当前浏览器中。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="教育阶段" required>
              <select
                value={profile.educationStage}
                onChange={(event) => updateProfile("educationStage", event.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">请选择</option>
                <option value="本科在读">本科在读</option>
                <option value="硕士在读">硕士在读</option>
                <option value="应届毕业生">应届毕业生</option>
                <option value="已工作">已工作</option>
                <option value="转专业/转行">转专业/转行</option>
              </select>
            </Field>
            <Field label="专业背景" required>
              <input
                value={profile.major}
                onChange={(event) => updateProfile("major", event.target.value)}
                placeholder="例如：软件工程 / 计算机科学 / 自动化"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </Field>
            <Field label="经验水平" required>
              <select
                value={profile.experienceLevel}
                onChange={(event) => updateProfile("experienceLevel", event.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">请选择</option>
                <option value="无实习经验">无实习经验</option>
                <option value="1段实习/项目经验">1段实习/项目经验</option>
                <option value="2段及以上实习/项目经验">2段及以上实习/项目经验</option>
                <option value="1-3年工作经验">1-3年工作经验</option>
                <option value="跨方向转岗">跨方向转岗</option>
              </select>
            </Field>
            <Field label="当前状态" required>
              <select
                value={profile.currentStatus}
                onChange={(event) => updateProfile("currentStatus", event.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">请选择</option>
                <option value="准备找实习">准备找实习</option>
                <option value="准备秋招/春招">准备秋招/春招</option>
                <option value="已经投递但反馈少">已经投递但反馈少</option>
                <option value="面试多次但通过率低">面试多次但通过率低</option>
                <option value="想转岗或换方向">想转岗或换方向</option>
              </select>
            </Field>
            <Field label="目标周期" required>
              <select
                value={profile.targetTimeline}
                onChange={(event) => updateProfile("targetTimeline", event.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">请选择</option>
                <option value="1个月内">1个月内</option>
                <option value="3个月内">3个月内</option>
                <option value="6个月内">6个月内</option>
                <option value="长期规划">长期规划</option>
              </select>
            </Field>
            <Field label="每日可投入时间" required>
              <select
                value={profile.dailyStudyTime}
                onChange={(event) => updateProfile("dailyStudyTime", event.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">请选择</option>
                <option value="每天少于1小时">每天少于1小时</option>
                <option value="每天1-2小时">每天1-2小时</option>
                <option value="每天2-4小时">每天2-4小时</option>
                <option value="每天4小时以上">每天4小时以上</option>
              </select>
            </Field>
            <Field label="求职偏好" required>
              <select
                value={profile.preference}
                onChange={(event) => updateProfile("preference", event.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">请选择</option>
                <option value="优先大厂">优先大厂</option>
                <option value="优先成长和技术深度">优先成长和技术深度</option>
                <option value="优先稳定和地点">优先稳定和地点</option>
                <option value="先拿 offer，再优化选择">先拿 offer，再优化选择</option>
              </select>
            </Field>
            <Field label="目标城市">
              <input
                value={profile.targetCity}
                onChange={(event) => updateProfile("targetCity", event.target.value)}
                placeholder="例如：北京 / 上海 / 杭州 / 不限"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </Field>
            <Field label="自认为优势" className="md:col-span-2">
              <textarea
                value={profile.selfRatedStrengths}
                onChange={(event) => updateProfile("selfRatedStrengths", event.target.value)}
                placeholder="例如：项目执行力强、前端基础较好、能快速学习"
                className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </Field>
            <Field label="当前最大困惑/痛点" required className="md:col-span-2">
              <textarea
                value={profile.painPoints}
                onChange={(event) => updateProfile("painPoints", event.target.value)}
                placeholder="例如：投递没反馈、项目讲不深、算法薄弱、面试紧张、不知道该补什么"
                className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </Field>
            <Field label="现实限制" className="md:col-span-2">
              <textarea
                value={profile.constraints}
                onChange={(event) => updateProfile("constraints", event.target.value)}
                placeholder="例如：课程压力大、没有实习、英语薄弱、只能远程、时间很紧"
                className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSave} disabled={!complete}>
              保存个人信息
            </Button>
            {saved ? (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                已保存
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  required = false,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block space-y-2 ${className}`}>
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
