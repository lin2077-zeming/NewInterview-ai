import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ScrollAreaProps {
  className?: string;
  children: ReactNode;
}

export function ScrollArea({ className, children }: ScrollAreaProps) {
  return (
    <div className={cn("overflow-auto", className)}>
      {children}
    </div>
  );
}
