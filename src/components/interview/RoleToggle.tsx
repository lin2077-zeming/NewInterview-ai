"use client";

// TODO: Person B 实现 — 反转视角开关

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface RoleToggleProps {
  mode: "normal" | "reversed";
  onToggle: () => void;
}

export function RoleToggle({ mode, onToggle }: RoleToggleProps) {
  return (
    <Button variant="outline" size="sm" onClick={onToggle} className="gap-2">
      <RefreshCw className="h-4 w-4" />
      当前：{mode === "normal" ? "我是候选人" : "我是面试官"}
    </Button>
  );
}
