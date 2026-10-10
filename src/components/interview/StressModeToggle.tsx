"use client";

// TODO: Person B 实现 — 压力面开关

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface StressModeToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function StressModeToggle({ enabled, onToggle }: StressModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <AlertTriangle className={`h-4 w-4 ${enabled ? "text-destructive" : "text-muted-foreground"}`} />
      <Label htmlFor="stress-mode" className="text-sm">
        压力面
      </Label>
      <Switch id="stress-mode" checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}
