"use client";

import type { SkillGap } from "@/types";
import { Badge } from "@/components/ui/badge";

interface SkillGapChartProps {
  gap: SkillGap;
}

export function SkillGapChart({ gap }: SkillGapChartProps) {
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">岗位匹配度</span>
          <span className="font-semibold">{gap.matchRate}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${gap.matchRate}%` }}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-muted-foreground">已具备技能</p>
        <div className="flex flex-wrap gap-2">
          {gap.currentSkills.map((skill) => (
            <Badge key={skill} variant="secondary">
              {skill}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-muted-foreground">目标岗位要求</p>
        <div className="flex flex-wrap gap-2">
          {gap.requiredSkills.map((skill) => (
            <Badge key={skill} variant="outline">
              {skill}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-muted-foreground">优先补齐</p>
        <div className="flex flex-wrap gap-2">
          {(gap.missingSkills.length > 0 ? gap.missingSkills : ["暂无明显短板"]).map((skill) => (
            <Badge key={skill}>{skill}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
