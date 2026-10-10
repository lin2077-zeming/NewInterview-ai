"use client";

import { cn } from "@/lib/utils";
import type { AppStep } from "@//types/student";
import {
  User,
  Compass,
  Map,
  BookOpen,
  BarChart3,
} from "lucide-react";

interface StepIndicatorProps {
  currentStep: AppStep;
  onStepClick: (step: AppStep) => void;
  disabledSteps: AppStep[];
}

const steps: { key: AppStep; label: string; icon: React.ElementType }[] = [
  { key: "profile", label: "个人信息", icon: User },
  { key: "careers", label: "职业推荐", icon: Compass },
  { key: "roadmap", label: "学习路线", icon: Map },
  { key: "resources", label: "学习资源", icon: BookOpen },
  { key: "progress", label: "进度跟踪", icon: BarChart3 },
];

export function StepIndicator({
  currentStep,
  onStepClick,
  disabledSteps,
}: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.key === currentStep;
          const isCompleted = index < currentIndex;
          const isDisabled = disabledSteps.includes(step.key);

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => !isDisabled && onStepClick(step.key)}
                disabled={isDisabled}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive && "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200",
                  isCompleted && "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950",
                  !isActive && !isCompleted && !isDisabled && "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
                  isDisabled && "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                    isActive && "bg-amber-600 text-white",
                    isCompleted && "bg-emerald-500 text-white",
                    !isActive && !isCompleted && "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
                    isDisabled && "bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600"
                  )}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 transition-colors duration-300",
                    index < currentIndex ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-700"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
