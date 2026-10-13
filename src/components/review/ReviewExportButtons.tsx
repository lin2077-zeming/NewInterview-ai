"use client";

import { Button } from "@/components/ui/button";
import { FileText, FileDown } from "lucide-react";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { saveAs } from "file-saver";
import type { ReviewReport } from "@/types";

function generateMarkdown(report: ReviewReport): string {
  const l: string[] = [];
  l.push(`# 面试复盘报告`);
  l.push("");
  l.push(`> 由 职镜 生成`);
  l.push("");
  l.push(`## 综合评分`);
  l.push("");
  l.push(`- **总分**：${report.overallScore}/100`);
  l.push(`- **通过判定**：${report.hiringVerdict}`);
  l.push(`- **通过概率**：${report.passProbability}%`);
  l.push(`- **核心诊断**：${report.coreDiagnosis}`);
  l.push("");

  l.push("## 能力维度");
  l.push("");
  const dims = report.dimensionScores;
  if (dims.technical != null) l.push(`- 技术能力：${dims.technical}`);
  if (dims.communication != null) l.push(`- 沟通表达：${dims.communication}`);
  if (dims.logic != null) l.push(`- 思维逻辑：${dims.logic}`);
  if (dims.depth != null) l.push(`- 知识深度：${dims.depth}`);
  if (dims.coding != null) l.push(`- 代码能力：${dims.coding}`);
  l.push("");

  l.push("## 主要优势");
  l.push("");
  report.top3Strengths.forEach((s, i) => {
    l.push(`### ${i + 1}. ${s.point}`);
    l.push(s.example);
    l.push("");
  });

  l.push("## 主要问题");
  l.push("");
  report.top3Weaknesses.forEach((w, i) => {
    l.push(`### ${i + 1}. ${w.point}`);
    l.push(w.example);
    l.push(`**建议**：${w.suggestion}`);
    l.push("");
  });

  l.push("## 逐题复盘");
  l.push("");
  report.perQuestionAnalysis.forEach((q, i) => {
    l.push(`### Q${i + 1}：${q.question}`);
    l.push(`**回答**：${q.yourAnswer}`);
    l.push(`**评分**：${q.score}/10`);
    l.push(`**亮点**：${q.strengths.join("、")}`);
    l.push(`**改进**：${q.weaknesses.join("、")}`);
    l.push(`**示范回答**：${q.suggestedAnswer}`);
    l.push("");
  });

  l.push("## 提升计划");
  l.push("");
  report.improvementPlan.forEach((item, i) => {
    l.push(`### ${i + 1}. ${item.area}`);
    l.push(item.action);
    if (item.resources.length > 0) {
      l.push(`**资源**：${item.resources.join("、")}`);
    }
    l.push("");
  });

  l.push("---");
  l.push(`*生成时间：${new Date().toLocaleString("zh-CN")}*`);
  return l.join("\n");
}

async function generateDocx(report: ReviewReport): Promise<Blob> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: "面试复盘报告",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [new TextRun({ text: "由 职镜 生成", italics: true, color: "888888", size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  children.push(new Paragraph({ text: "综合评分", heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }));
  [
    `总分：${report.overallScore}/100`,
    `通过判定：${report.hiringVerdict}`,
    `通过概率：${report.passProbability}%`,
    `核心诊断：${report.coreDiagnosis}`,
  ].forEach((item) => {
    children.push(new Paragraph({ children: [new TextRun({ text: `• ${item}` })], spacing: { after: 80 } }));
  });

  const dims = report.dimensionScores;
  const dimLabels: [string, number | undefined][] = [
    ["技术能力", dims.technical], ["沟通表达", dims.communication],
    ["思维逻辑", dims.logic], ["知识深度", dims.depth], ["代码能力", dims.coding],
  ];
  children.push(new Paragraph({ text: "能力维度", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
  dimLabels.filter(([, v]) => v != null).forEach(([label, score]) => {
    children.push(new Paragraph({ children: [new TextRun({ text: `• ${label}：${score}` })], spacing: { after: 60 } }));
  });

  children.push(new Paragraph({ text: "主要优势", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
  report.top3Strengths.forEach((s, i) => {
    children.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${s.point}`, bold: true })], spacing: { after: 60 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: s.example })], spacing: { after: 120 } }));
  });

  children.push(new Paragraph({ text: "主要问题", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
  report.top3Weaknesses.forEach((w, i) => {
    children.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${w.point}`, bold: true })], spacing: { after: 60 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: w.example })], spacing: { after: 60 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: `建议：${w.suggestion}`, italics: true })], spacing: { after: 120 } }));
  });

  children.push(new Paragraph({ text: "逐题复盘", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
  report.perQuestionAnalysis.forEach((q, i) => {
    children.push(new Paragraph({ children: [new TextRun({ text: `Q${i + 1}：${q.question}`, bold: true })], spacing: { after: 80 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: `回答：${q.yourAnswer}` })], spacing: { after: 60 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: `评分：${q.score}/10  |  亮点：${q.strengths.join("、")}  |  改进：${q.weaknesses.join("、")}` })], spacing: { after: 60 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: `示范：${q.suggestedAnswer}`, italics: true })], spacing: { after: 160 } }));
  });

  children.push(new Paragraph({ text: "提升计划", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
  report.improvementPlan.forEach((item, i) => {
    children.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${item.area}`, bold: true })], spacing: { after: 60 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: item.action })], spacing: { after: 60 } }));
    if (item.resources.length > 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: `资源：${item.resources.join("、")}`, italics: true, color: "666666" })], spacing: { after: 120 } }));
    }
  });

  children.push(new Paragraph({
    children: [new TextRun({ text: `生成时间：${new Date().toLocaleString("zh-CN")}`, italics: true, color: "888888", size: 18 })],
    alignment: AlignmentType.CENTER, spacing: { before: 400 },
  }));

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return await Packer.toBlob(doc);
}

export function ReviewExportButtons({ report }: { report: ReviewReport }) {
  const handleMD = () => {
    const md = generateMarkdown(report);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    saveAs(blob, "复盘报告.md");
  };

  const handleDOCX = async () => {
    const blob = await generateDocx(report);
    saveAs(blob, "复盘报告.docx");
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleMD} className="gap-1.5">
        <FileText className="h-4 w-4" />
        导出 MD
      </Button>
      <Button variant="outline" size="sm" onClick={handleDOCX} className="gap-1.5">
        <FileDown className="h-4 w-4" />
        导出 Word
      </Button>
    </div>
  );
}
