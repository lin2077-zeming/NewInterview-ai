"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OpcMaturity, OpcScorePoint } from "@/lib/opc-metrics";

const AXES: Array<{ key: keyof Omit<OpcMaturity, "overall">; label: string }> = [
  { key: "lowCost", label: "低成本启动" },
  { key: "soloTeam", label: "一人 / 小团队" },
  { key: "aiExecution", label: "AI 辅助执行" },
  { key: "fastValidation", label: "快速验证" },
  { key: "iteration", label: "持续迭代" },
];

/** OPC 五特征成熟度雷达 */
export function OpcRadar({ maturity }: { maturity: OpcMaturity }) {
  const data = AXES.map((axis) => ({ dimension: axis.label, score: maturity[axis.key] }));

  return (
    <div className="w-full aspect-square max-w-sm mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickCount={6}
          />
          <Radar
            name="OPC 成熟度"
            dataKey="score"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.25}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 简历诊断得分随迭代的变化 */
export function OpcScoreTrend({ points }: { points: OpcScorePoint[] }) {
  const data = points.map((point) => ({
    name: `第 ${point.index} 版`,
    score: point.score,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -18 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value) => [`${value} 分`, "简历可投递度"]}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
