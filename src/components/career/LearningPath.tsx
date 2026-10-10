"use client";

import type { LearningStep } from "@/types";
import { ResourceCard } from "@/components/career/ResourceCard";

interface LearningPathProps {
  steps: LearningStep[];
}

export function LearningPath({ steps }: LearningPathProps) {
  return (
    <div className="relative pl-6 space-y-6">
      {steps.map((step) => (
        <div key={step.order} className="relative">
          <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-primary" />
          <h4 className="font-semibold">
            步骤 {step.order}: {step.title}
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            预计用时：{step.estimatedDuration}
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {step.resources.map((resource) => (
              <ResourceCard key={`${step.order}-${resource.name}`} resource={resource} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
