"use client";

import type { CompanyFlow } from "@/types";

interface StageIndicatorProps {
  flow: CompanyFlow;
  currentStage: number;
}

export function StageIndicator({ flow, currentStage }: StageIndicatorProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        {flow.name} 面试模块
      </h3>
      {flow.stages.map((stage, index) => {
        const isCurrent = index === currentStage;

        return (
          <div
            key={`${stage.id}-${index}`}
            className={`flex gap-3 rounded-md border p-3 ${
              isCurrent ? "border-primary bg-primary/5" : "border-transparent"
            }`}
          >
            <div
              className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${
                isCurrent ? "bg-primary ring-2 ring-primary/30" : "bg-muted"
              }`}
            />
            <div>
              <p className="text-sm font-medium">{stage.name}</p>
              <p className="text-xs text-muted-foreground">{stage.focus}</p>
              <p className="text-xs text-muted-foreground">{stage.duration} 分钟</p>
              {isCurrent && (
                <p className="mt-1 text-xs font-medium text-primary">本次面试</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
