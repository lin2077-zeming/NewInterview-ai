"use client";

// TODO: Person C 实现 — 改进建议列表

import type { ImprovementAction } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ImprovementListProps {
  items: ImprovementAction[];
}

export function ImprovementList({ items }: ImprovementListProps) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle className="text-base">
              {i + 1}. {item.area}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{item.action}</p>
            <div className="flex flex-wrap gap-1">
              {item.resources.map((r, j) => (
                <Badge key={j} variant="outline">
                  {r}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
