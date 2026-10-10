"use client";

// TODO: Person C 实现 — 逐题分析卡片

import type { PerQuestionAnalysis } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AnswerAnalysisProps {
  data: PerQuestionAnalysis;
  index: number;
}

export function AnswerAnalysis({ data, index }: AnswerAnalysisProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Q{index + 1}: {data.question}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <span className="font-semibold">评分：</span>
          <span>{data.score}/10</span>
        </div>
        <div>
          <span className="font-semibold">你的回答：</span>
          <p className="text-sm text-muted-foreground mt-1">{data.yourAnswer}</p>
        </div>
        <div>
          <span className="font-semibold text-green-600">亮点：</span>
          <ul className="list-disc list-inside text-sm">
            {data.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <span className="font-semibold text-amber-600">改进点：</span>
          <ul className="list-disc list-inside text-sm">
            {data.weaknesses.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
        <div>
          <span className="font-semibold text-blue-600">示范回答：</span>
          <p className="text-sm mt-1 p-2 bg-muted rounded">
            {data.suggestedAnswer}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
