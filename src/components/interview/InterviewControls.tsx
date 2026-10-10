"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StopCircle, RefreshCw, AlertTriangle } from "lucide-react";

interface InterviewControlsProps {
  mode: "normal" | "reversed";
  stressMode: boolean;
  onToggleMode: () => void;
  onToggleStress: () => void;
  onEndInterview: () => void;
}

export function InterviewControls({
  mode,
  stressMode,
  onToggleMode,
  onToggleStress,
  onEndInterview,
}: InterviewControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={onToggleMode} className="gap-1">
        <RefreshCw className="h-4 w-4" />
        {mode === "normal" ? "切换为面试官" : "切换为候选人"}
      </Button>
      <Separator orientation="vertical" className="h-6" />
      <Button
        variant={stressMode ? "default" : "ghost"}
        size="sm"
        onClick={onToggleStress}
        className="gap-1"
      >
        <AlertTriangle className="h-4 w-4" />
        压力面
      </Button>
      <Separator orientation="vertical" className="h-6" />
      <Button
        variant="destructive"
        size="sm"
        onClick={onEndInterview}
        className="gap-1"
      >
        <StopCircle className="h-4 w-4" />
        结束面试
      </Button>
    </div>
  );
}
