"use client";

import type { ParsedResume } from "@/types";
import { Badge } from "@/components/ui/badge";

interface ResumePreviewProps {
  resume: ParsedResume | null;
}

export function ResumePreview({ resume }: ResumePreviewProps) {
  if (!resume) return null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground mb-2">技能标签</p>
        <div className="flex flex-wrap gap-2">
          {resume.skills.map((s) => (
            <Badge key={s.name} variant="secondary">
              {s.name} ({s.level})
            </Badge>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-2">教育经历</p>
        <p className="text-sm">{resume.education}</p>
      </div>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">项目/工作经历</p>
        {resume.experience.map((item, index) => (
          <div key={`${item.title}-${index}`} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{item.title}</p>
              <span className="text-xs text-muted-foreground">{item.company}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {item.techStack.map((tech) => (
                <Badge key={tech} variant="outline">
                  {tech}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
