"use client";

import { useState } from "react";
import type { UserProfile } from "@//types/student";
import { MAJOR_OPTIONS, INTEREST_OPTIONS, GRADE_OPTIONS } from "@//types/student";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, ChevronRight } from "lucide-react";

interface ProfileFormProps {
  onSubmit: (profile: UserProfile) => void;
  initialProfile?: UserProfile;
}

export function ProfileForm({ onSubmit, initialProfile }: ProfileFormProps) {
  const [major, setMajor] = useState(initialProfile?.major || "");
  const [customMajor, setCustomMajor] = useState("");
  const [interests, setInterests] = useState<string[]>(
    initialProfile?.interests || []
  );
  const [skills, setSkills] = useState(initialProfile?.skills || "");
  const [expectation, setExpectation] = useState(
    initialProfile?.expectation || ""
  );
  const [grade, setGrade] = useState(initialProfile?.grade || "");

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = () => {
    const finalMajor = major === "其他" ? customMajor : major;
    if (!finalMajor || interests.length === 0) return;
    onSubmit({
      major: finalMajor,
      interests,
      skills,
      expectation,
      grade,
    });
  };

  const isValid =
    (major !== "其他" ? major : customMajor) && interests.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" />
          AI 驱动的职业规划
        </div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          规划你的计算机职业之路
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          填写你的基本信息，AI 将为你量身定制职业发展规划
        </p>
      </div>

      {/* 专业方向 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">专业方向</CardTitle>
          <CardDescription>选择你的专业细分方向</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={major} onValueChange={(v) => v && setMajor(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="请选择你的专业" />
            </SelectTrigger>
            <SelectContent>
              {MAJOR_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {major === "其他" && (
            <Input
              placeholder="请输入你的专业方向"
              value={customMajor}
              onChange={(e) => setCustomMajor(e.target.value)}
            />
          )}
        </CardContent>
      </Card>

      {/* 年级 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">当前年级</CardTitle>
          <CardDescription>帮助我们了解你的学习阶段</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={grade} onValueChange={(v) => v && setGrade(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="请选择你的年级" />
            </SelectTrigger>
            <SelectContent>
              {GRADE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 兴趣偏好 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">兴趣偏好</CardTitle>
          <CardDescription>
            选择你感兴趣的方向（至少选择1个）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => (
              <Badge
                key={interest}
                variant={interests.includes(interest) ? "default" : "outline"}
                className={`cursor-pointer text-sm px-3 py-1.5 transition-all duration-150 ${
                  interests.includes(interest)
                    ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
                    : "hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-400"
                }`}
                onClick={() => toggleInterest(interest)}
              >
                {interest}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 已掌握技能 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">已掌握技能</CardTitle>
          <CardDescription>
            描述你目前已掌握的技术和技能（可选）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="例如：熟悉 Python 基础语法，了解 HTML/CSS，学过数据结构..."
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* 职业期望 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">职业期望</CardTitle>
          <CardDescription>
            你对未来职业有什么期望和想法？（可选）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="例如：希望从事有创造性的工作，薪资前景好，能远程办公..."
            value={expectation}
            onChange={(e) => setExpectation(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* 提交按钮 */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSubmit}
          disabled={!isValid}
          size="lg"
          className="bg-amber-600 hover:bg-amber-700 text-white px-8 gap-2"
        >
          生成职业推荐
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
