"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StopCircle, AlertTriangle } from "lucide-react";

/**
 * 面试进行中的操作条（桌面端）。
 *
 * 这里**不再提供"切换为面试官/候选人"** —— 视角在创建面试时选定，
 * 中途切换既容易误触，也会让对话上下文对不上（AI 的角色设定已经发出去了）。
 * 需要换视角请重新创建一场面试。
 */
interface InterviewControlsProps {
  stressMode: boolean;
  onToggleStress: () => void;
  onEndInterview: () => void;
}

export function InterviewControls({
  stressMode,
  onToggleStress,
  onEndInterview,
}: InterviewControlsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* 按钮文案直接说明开启后的效果，而不是只写一个"压力面"让人猜 */}
      <Button
        variant={stressMode ? "default" : "ghost"}
        size="sm"
        onClick={onToggleStress}
        className="gap-1"
        title={
          stressMode
            ? "已开启：后续 AI 面试官会更主动追问。再点一次可关闭"
            : "开启后，后续 AI 面试官会更主动追问"
        }
      >
        <AlertTriangle className="h-4 w-4" />
        {stressMode ? "已开启：AI 会更主动追问" : "后续 AI 面试官会更主动追问"}
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
