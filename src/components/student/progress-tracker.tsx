"use client";

import type { LearningRoadmap, LearningResources } from "@/types/student";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Flag,
  CheckCircle2,
  Circle,
  RotateCcw,
  TrendingUp,
  Download,
  FileText,
  FileDown,
} from "lucide-react";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { saveAs } from "file-saver";

interface ProgressTrackerProps {
  roadmap: LearningRoadmap;
  career: string;
  resources: LearningResources | null;
  completedMilestones: Record<number, number[]>;
  completedPhases: number[];
  onToggleMilestone: (phaseIndex: number, milestoneIndex: number) => void;
  onTogglePhase: (phaseIndex: number) => void;
  onReset: () => void;
}

// ==================== MD Export ====================

function generateMarkdown(
  roadmap: LearningRoadmap,
  career: string,
  resources: LearningResources | null,
  completedMilestones: Record<number, number[]>,
  completedPhases: number[]
): string {
  const lines: string[] = [];

  lines.push(`# ${career} — 学习路线与资源`);
  lines.push("");
  lines.push(`> 由 CodePath AI 职业规划工具生成`);
  lines.push("");

  // Overview
  lines.push("## 概览");
  lines.push("");
  lines.push(`- **职业方向**：${career}`);
  lines.push(`- **预计时长**：${roadmap.totalDuration}`);
  lines.push(`- **路线概述**：${roadmap.overview}`);
  lines.push("");

  // Calculate progress
  const totalMilestones = roadmap.phases.reduce(
    (sum, phase) => sum + phase.milestones.length,
    0
  );
  const completedCount = Object.values(completedMilestones).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  const overallProgress =
    totalMilestones > 0
      ? Math.round((completedCount / totalMilestones) * 100)
      : 0;
  lines.push(`- **当前进度**：${completedCount}/${totalMilestones} 个里程碑（${overallProgress}%）`);
  lines.push("");

  // Roadmap phases
  lines.push("---");
  lines.push("");
  lines.push("## 学习路线");
  lines.push("");

  roadmap.phases.forEach((phase) => {
    const isComplete = completedPhases.includes(phase.phase);
    const status = isComplete ? "✅ 已完成" : "⬜ 进行中";
    lines.push(`### 阶段 ${phase.phase}：${phase.name} ${status}`);
    lines.push("");
    lines.push(`**时长**：${phase.duration}`);
    lines.push("");
    lines.push(`**描述**：${phase.description}`);
    lines.push("");

    // Goals
    if (phase.goals.length > 0) {
      lines.push("**阶段目标**：");
      lines.push("");
      phase.goals.forEach((goal) => {
        lines.push(`- ${goal}`);
      });
      lines.push("");
    }

    // Skills
    if (phase.skills.length > 0) {
      lines.push("**核心技能**：");
      lines.push("");
      phase.skills.forEach((skill) => {
        lines.push(
          `- **${skill.name}**（${skill.priority}优先级）：${skill.description}`
        );
        if (skill.learningMethods.length > 0) {
          skill.learningMethods.forEach((method) => {
            lines.push(`  - ${method}`);
          });
        }
      });
      lines.push("");
    }

    // Milestones
    if (phase.milestones.length > 0) {
      lines.push("**里程碑**：");
      lines.push("");
      phase.milestones.forEach((milestone, i) => {
        const isMilestoneComplete =
          completedMilestones[phase.phase]?.includes(i);
        lines.push(
          `- [${isMilestoneComplete ? "x" : " "}] ${milestone}`
        );
      });
      lines.push("");
    }

    // Projects
    if (phase.projects.length > 0) {
      lines.push("**实践项目**：");
      lines.push("");
      phase.projects.forEach((project) => {
        lines.push(`- ${project}`);
      });
      lines.push("");
    }
  });

  // Tips
  if (roadmap.tips.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## 学习建议");
    lines.push("");
    roadmap.tips.forEach((tip) => {
      lines.push(`- ${tip}`);
    });
    lines.push("");
  }

  // Resources
  if (resources) {
    lines.push("---");
    lines.push("");
    lines.push("## 学习资源");
    lines.push("");

    // Books
    if (resources.books.length > 0) {
      lines.push("### 📚 书籍");
      lines.push("");
      resources.books.forEach((book) => {
        lines.push(
          `- **${book.title}**（${book.author}）— ${book.description} [${book.difficulty}]`
        );
      });
      lines.push("");
    }

    // Articles
    if (resources.articles.length > 0) {
      lines.push("### 📝 文章");
      lines.push("");
      resources.articles.forEach((article) => {
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(article.source + " " + article.title)}`;
        lines.push(
          `- **${article.title}**（${article.source}）— ${article.description} [${article.difficulty}] [搜索](${searchUrl})`
        );
      });
      lines.push("");
    }

    // Videos
    if (resources.videos.length > 0) {
      lines.push("### 🎬 视频");
      lines.push("");
      resources.videos.forEach((video) => {
        const searchUrl = `https://search.bilibili.com/all?keyword=${encodeURIComponent(video.title)}`;
        lines.push(
          `- **${video.title}**（B站）— ${video.description} [${video.difficulty}] [观看](${searchUrl})`
        );
      });
      lines.push("");
    }

    // Tools
    if (resources.tools.length > 0) {
      lines.push("### 🔧 工具");
      lines.push("");
      resources.tools.forEach((tool) => {
        const link = tool.url
          ? ` [官网](${tool.url})`
          : "";
        lines.push(
          `- **${tool.name}** — ${tool.description} [${tool.category}]${link}`
        );
      });
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push(`*生成时间：${new Date().toLocaleString("zh-CN")}*`);

  return lines.join("\n");
}

// ==================== DOCX Export ====================

async function generateDocx(
  roadmap: LearningRoadmap,
  career: string,
  resources: LearningResources | null,
  completedMilestones: Record<number, number[]>,
  completedPhases: number[]
): Promise<Blob> {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: `${career} — 学习路线与资源`,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "由 CodePath AI 职业规划工具生成",
          italics: true,
          color: "888888",
          size: 20,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Overview
  children.push(
    new Paragraph({
      text: "概览",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 200 },
    })
  );

  const overviewItems = [
    `职业方向：${career}`,
    `预计时长：${roadmap.totalDuration}`,
    `路线概述：${roadmap.overview}`,
  ];

  const totalMilestones = roadmap.phases.reduce(
    (sum, phase) => sum + phase.milestones.length,
    0
  );
  const completedCount = Object.values(completedMilestones).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  const overallProgress =
    totalMilestones > 0
      ? Math.round((completedCount / totalMilestones) * 100)
      : 0;
  overviewItems.push(
    `当前进度：${completedCount}/${totalMilestones} 个里程碑（${overallProgress}%）`
  );

  overviewItems.forEach((item) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "• ", bold: true }),
          new TextRun({ text: item }),
        ],
        spacing: { after: 80 },
      })
    );
  });

  // Roadmap
  children.push(
    new Paragraph({
      text: "学习路线",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  roadmap.phases.forEach((phase) => {
    const isComplete = completedPhases.includes(phase.phase);
    const status = isComplete ? "✅ 已完成" : "⬜ 进行中";

    children.push(
      new Paragraph({
        text: `阶段 ${phase.phase}：${phase.name}  ${status}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "时长：", bold: true }),
          new TextRun({ text: phase.duration }),
        ],
        spacing: { after: 80 },
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "描述：", bold: true }),
          new TextRun({ text: phase.description }),
        ],
        spacing: { after: 120 },
      })
    );

    // Goals
    if (phase.goals.length > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "阶段目标：", bold: true })],
          spacing: { after: 60 },
        })
      );
      phase.goals.forEach((goal) => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `  • ${goal}` })],
            spacing: { after: 40 },
          })
        );
      });
    }

    // Skills
    if (phase.skills.length > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "核心技能：", bold: true })],
          spacing: { before: 120, after: 60 },
        })
      );
      phase.skills.forEach((skill) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `  • ${skill.name}`, bold: true }),
              new TextRun({
                text: `（${skill.priority}优先级）：${skill.description}`,
              }),
            ],
            spacing: { after: 40 },
          })
        );
      });
    }

    // Milestones
    if (phase.milestones.length > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "里程碑：", bold: true })],
          spacing: { before: 120, after: 60 },
        })
      );
      phase.milestones.forEach((milestone, i) => {
        const isMilestoneComplete =
          completedMilestones[phase.phase]?.includes(i);
        const check = isMilestoneComplete ? "☑" : "☐";
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `  ${check} ${milestone}` })],
            spacing: { after: 40 },
          })
        );
      });
    }

    // Projects
    if (phase.projects.length > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "实践项目：", bold: true })],
          spacing: { before: 120, after: 60 },
        })
      );
      phase.projects.forEach((project) => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `  • ${project}` })],
            spacing: { after: 40 },
          })
        );
      });
    }
  });

  // Tips
  if (roadmap.tips.length > 0) {
    children.push(
      new Paragraph({
        text: "学习建议",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );
    roadmap.tips.forEach((tip) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `• ${tip}` })],
          spacing: { after: 80 },
        })
      );
    });
  }

  // Resources
  if (resources) {
    children.push(
      new Paragraph({
        text: "学习资源",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    // Books
    if (resources.books.length > 0) {
      children.push(
        new Paragraph({
          text: "📚 书籍",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
      resources.books.forEach((book) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `• ${book.title}`, bold: true }),
              new TextRun({
                text: `（${book.author}）— ${book.description} [${book.difficulty}]`,
              }),
            ],
            spacing: { after: 60 },
          })
        );
      });
    }

    // Articles
    if (resources.articles.length > 0) {
      children.push(
        new Paragraph({
          text: "📝 文章",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
      resources.articles.forEach((article) => {
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(article.source + " " + article.title)}`;
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `• ${article.title}`, bold: true }),
              new TextRun({
                text: `（${article.source}）— ${article.description} [${article.difficulty}]`,
              }),
            ],
            spacing: { after: 40 },
          })
        );
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `  搜索链接：`, size: 18 }),
              new TextRun({
                text: searchUrl,
                color: "0563C1",
                underline: { type: "single" as never },
                size: 18,
              }),
            ],
            spacing: { after: 60 },
          })
        );
      });
    }

    // Videos
    if (resources.videos.length > 0) {
      children.push(
        new Paragraph({
          text: "🎬 视频",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
      resources.videos.forEach((video) => {
        const searchUrl = `https://search.bilibili.com/all?keyword=${encodeURIComponent(video.title)}`;
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `• ${video.title}`, bold: true }),
              new TextRun({
                text: `（B站）— ${video.description} [${video.difficulty}]`,
              }),
            ],
            spacing: { after: 40 },
          })
        );
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `  观看链接：`, size: 18 }),
              new TextRun({
                text: searchUrl,
                color: "0563C1",
                underline: { type: "single" as never },
                size: 18,
              }),
            ],
            spacing: { after: 60 },
          })
        );
      });
    }

    // Tools
    if (resources.tools.length > 0) {
      children.push(
        new Paragraph({
          text: "🔧 工具",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
      resources.tools.forEach((tool) => {
        const displayName = tool.name || "工具";
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `• ${displayName}`, bold: true }),
              new TextRun({
                text: ` — ${tool.description} [${tool.category}]`,
              }),
            ],
            spacing: { after: 40 },
          })
        );
        if (tool.url) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `  官网：`, size: 18 }),
                new TextRun({
                  text: tool.url,
                  color: "0563C1",
                  underline: { type: "single" as never },
                  size: 18,
                }),
              ],
              spacing: { after: 60 },
            })
          );
        }
      });
    }
  }

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `生成时间：${new Date().toLocaleString("zh-CN")}`,
          italics: true,
          color: "888888",
          size: 18,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

// ==================== Component ====================

// Patched for base-ui shadcn v4
export function ProgressTracker({
  roadmap,
  career,
  resources,
  completedMilestones,
  completedPhases,
  onToggleMilestone,
  onTogglePhase,
  onReset,
}: ProgressTrackerProps) {
  // Calculate overall progress
  const totalMilestones = roadmap.phases.reduce(
    (sum, phase) => sum + phase.milestones.length,
    0
  );
  const completedCount = Object.values(completedMilestones).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  const overallProgress =
    totalMilestones > 0
      ? Math.round((completedCount / totalMilestones) * 100)
      : 0;

  const handleExportMD = () => {
    const markdown = generateMarkdown(
      roadmap,
      career,
      resources,
      completedMilestones,
      completedPhases
    );
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const fileName = `${career}-学习路线.md`;
    saveAs(blob, fileName);
  };

  const handleExportDOCX = async () => {
    const blob = await generateDocx(
      roadmap,
      career,
      resources,
      completedMilestones,
      completedPhases
    );
    const fileName = `${career}-学习路线.docx`;
    saveAs(blob, fileName);
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">学习进度</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          「{career}」方向的成长记录
        </p>
      </div>

      {/* Two-column layout: main content + export sidebar */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Main content */}
        <div className="w-full min-w-0 flex-1 space-y-6">
          {/* Overall Progress Card */}
          <Card className="bg-gradient-to-br from-amber-50 dark:from-amber-950 to-white dark:to-slate-900 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-6">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-800">
                    总体进度
                  </h3>
                  <p className="text-sm text-slate-500">
                    已完成 {completedCount} / {totalMilestones} 个里程碑
                  </p>
                </div>
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 sm:text-4xl">
                  {overallProgress}%
                </div>
              </div>
              <Progress value={overallProgress} className="h-3" />
              <div className="flex items-center gap-2 mt-3 text-sm text-slate-500">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                {overallProgress === 0 && "开始你的学习之旅吧！"}
                {overallProgress > 0 &&
                  overallProgress < 50 &&
                  "不错的开始，继续保持！"}
                {overallProgress >= 50 &&
                  overallProgress < 100 &&
                  "已过半程，胜利在望！"}
                {overallProgress === 100 && "恭喜你完成了所有里程碑！"}
              </div>
            </CardContent>
          </Card>

          {/* Phase Progress */}
          {roadmap.phases.map((phase) => {
        const phaseCompleted =
          completedMilestones[phase.phase]?.length || 0;
        const phaseTotal = phase.milestones.length;
        const phaseProgress =
          phaseTotal > 0
            ? Math.round((phaseCompleted / phaseTotal) * 100)
            : 0;
        const isComplete = completedPhases.includes(phase.phase);

        return (
          <Card
            key={phase.phase}
            className={isComplete ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/30" : ""}
          >
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      isComplete ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      phase.phase
                    )}
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base break-words">{phase.name}</CardTitle>
                    <p className="mt-0.5 break-words text-xs text-slate-400">
                      {phase.duration}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Badge
                    variant={isComplete ? "default" : "secondary"}
                    className={
                      isComplete
                        ? "bg-emerald-500 text-white"
                      : "bg-slate-100 text-slate-600"
                    }
                  >
                    {phaseCompleted}/{phaseTotal}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onTogglePhase(phase.phase)}
                    className="shrink-0 text-xs"
                  >
                    {isComplete ? "取消完成" : "标记完成"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={phaseProgress} className="h-2 mb-3" />
              <div className="space-y-2">
                {phase.milestones.map((milestone, i) => {
                  const isMilestoneComplete =
                    completedMilestones[phase.phase]?.includes(i);
                  return (
                    <div
                      key={i}
                      className="flex cursor-pointer items-start gap-2 group"
                      onClick={() => onToggleMilestone(phase.phase, i)}
                    >
                      {isMilestoneComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-amber-400 shrink-0" />
                      )}
                      <span
                        className={`min-w-0 break-words text-sm ${
                          isMilestoneComplete
                            ? "line-through text-slate-400"
                            : "text-slate-600 group-hover:text-slate-800"
                        }`}
                      >
                        {milestone}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Goals reminder */}
              {phase.goals.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <h4 className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                    <Flag className="w-3 h-3" />
                    阶段目标
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {phase.goals.map((goal, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="max-w-full whitespace-normal break-words text-left text-xs text-slate-500"
                      >
                        {goal}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Reset */}
      <div className="flex justify-center pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-slate-400 gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          重置所有进度
        </Button>
      </div>
      </div>

      {/* Export Sidebar */}
      <div className="w-full lg:sticky lg:top-6 lg:w-64 lg:shrink-0">
        <Card className="bg-gradient-to-br from-amber-50 dark:from-amber-950 via-orange-50 dark:via-orange-950 to-rose-50 dark:to-rose-950 border-amber-200 dark:border-amber-800 overflow-hidden relative shadow-md">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-100/30 via-orange-100/20 to-rose-100/30 pointer-events-none" />
          <CardContent className="pt-5 pb-5 relative">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <Download className="w-5 h-5" />
                <span className="font-semibold text-base">导出学习规划</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                将学习路线与资源导出为文件，方便离线查看与分享
              </p>
              <div className="flex flex-col gap-3 w-full mt-1">
                <Button
                  onClick={handleExportMD}
                  className="bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white shadow-lg shadow-slate-300/50 gap-2 h-11 min-w-0 text-sm font-medium transition-all duration-200 hover:shadow-xl hover:scale-[1.03] active:scale-[0.97] w-full"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  导出 Markdown
                </Button>
                <Button
                  onClick={handleExportDOCX}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-300/50 gap-2 h-11 min-w-0 text-sm font-medium transition-all duration-200 hover:shadow-xl hover:scale-[1.03] active:scale-[0.97] w-full"
                >
                  <FileDown className="w-4 h-4 shrink-0" />
                  导出 Word
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}
