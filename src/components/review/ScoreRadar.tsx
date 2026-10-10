"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import type { DimensionScores } from "@/types";

interface ScoreRadarProps {
  scores: DimensionScores;
}

const LABELS: Record<string, string> = {
  technical: "技术能力",
  communication: "沟通表达",
  logic: "思维逻辑",
  depth: "知识深度",
  coding: "代码能力",
};

export function ScoreRadar({ scores }: ScoreRadarProps) {
  const data = Object.entries(scores)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => ({
      dimension: LABELS[key] || key,
      score: value,
    }));

  if (data.length === 0) {
    return (
      <div className="w-full aspect-square max-w-xs mx-auto flex items-center justify-center">
        <p className="text-sm text-muted-foreground">暂无评分数据</p>
      </div>
    );
  }

  return (
    <div className="w-full aspect-square max-w-sm mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fontSize: 13, fill: "hsl(var(--foreground))" }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickCount={6}
          />
          <Radar
            name="评分"
            dataKey="score"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
