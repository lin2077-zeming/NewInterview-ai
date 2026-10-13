"use client";

import type { LearningResource } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Video, Code2 } from "lucide-react";

interface ResourceCardProps {
  resource: LearningResource;
}

/**
 * 图标与标签都按类型查表。
 *
 * ⚠️ **查表必须兜底**：`resource.type` 的类型是联合类型，但数据来自 AI 的
 * 未校验 JSON。原先直接 `iconMap[resource.type]` —— 一旦 AI 给出 `"video"`
 * 这种意外值，React 会抛 "Element type is invalid"，
 * **整个页面变成 "This page couldn't load"**（实测复现过）。
 *
 * 类型系统在这里保护不了我们：声明是联合类型，运行时并不保证。
 * 组件不该有能力把整页打崩，所以这一层也要兜住。
 */
const RESOURCE_META: Record<string, { icon: typeof BookOpen; label: string }> = {
  course: { icon: Video, label: "课程" },
  book: { icon: BookOpen, label: "书籍" },
  project: { icon: Code2, label: "项目" },
};

const FALLBACK_META = { icon: BookOpen, label: "学习资料" };

export function ResourceCard({ resource }: ResourceCardProps) {
  const meta = RESOURCE_META[resource?.type] ?? FALLBACK_META;
  const Icon = meta.icon;
  const url = typeof resource?.url === "string" ? resource.url : "";
  const isExternal = url.startsWith("http");

  return (
    <a href={url || undefined} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noreferrer" : undefined}>
      <Card className="h-full cursor-pointer transition-colors hover:bg-muted/50">
        <CardContent className="flex items-center gap-3 p-4">
          <Icon className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="break-words text-sm font-medium">{resource?.name || "学习资料"}</p>
            <p className="text-xs text-muted-foreground">{meta.label}</p>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
