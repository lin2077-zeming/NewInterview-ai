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
import type { ParsedResume, CareerDiagnosis, SkillGap, LearningPath as LearningPathType } from "@/types";

interface CareerExportData {
  resume: ParsedResume;
  diagnosis: CareerDiagnosis;
  gap: SkillGap;
  path: LearningPathType;
  roleLabel: string;
}

function generateMarkdown(data: CareerExportData): string {
  const l: string[] = [];
  l.push(`# ${data.roleLabel} — 求职规划报告`);
  l.push("");
  l.push(`> 由 职镜 生成`);
  l.push("");

  l.push("## 简历解析");
  l.push("");
  if (data.resume.skills.length > 0) {
    l.push("### 技能");
    data.resume.skills.forEach((s) => l.push(`- **${s.name}**（${s.level}，${s.years}年）`));
    l.push("");
  }
  if (data.resume.experience.length > 0) {
    l.push("### 经历");
    data.resume.experience.forEach((e) => {
      l.push(`- **${e.title}** @ ${e.company}`);
      l.push(`  ${e.description}`);
      if (e.techStack.length > 0) l.push(`  技术栈：${e.techStack.join("、")}`);
    });
    l.push("");
  }
  if (data.resume.education) {
    l.push(`### 教育背景`);
    l.push(data.resume.education);
    l.push("");
  }

  l.push("## 技能差距分析");
  l.push("");
  l.push(`- **匹配率**：${data.gap.matchRate}%`);
  l.push(`- **已有技能**：${data.gap.currentSkills.join("、")}`);
  l.push(`- **目标要求**：${data.gap.requiredSkills.join("、")}`);
  l.push(`- **需要补齐**：${data.gap.missingSkills.join("、")}`);
  l.push("");

  l.push("## 关键诊断");
  l.push("");
  l.push(`**核心问题**：${data.diagnosis.coreProblem}`);
  l.push("");
  if (data.diagnosis.evidence.length > 0) {
    l.push("**证据**：");
    data.diagnosis.evidence.forEach((e) => l.push(`- ${e}`));
    l.push("");
  }
  if (data.diagnosis.blindSpots.length > 0) {
    l.push("**盲区**：");
    data.diagnosis.blindSpots.forEach((b) => l.push(`- ${b}`));
    l.push("");
  }
  if (data.diagnosis.quickWins.length > 0) {
    l.push("**短期突破点**：");
    data.diagnosis.quickWins.forEach((w) => l.push(`- ${w}`));
    l.push("");
  }

  l.push("## 学习路径");
  l.push("");
  data.path.steps.forEach((step) => {
    l.push(`### 步骤 ${step.order}：${step.title}`);
    l.push(step.description);
    l.push(`**预计耗时**：${step.estimatedDuration}`);
    if (step.resources.length > 0) {
      l.push("**推荐资源**：");
      step.resources.forEach((r) => l.push(`- ${r.name}（${r.type === "course" ? "课程" : r.type === "book" ? "书籍" : "项目"}）：${r.url}`));
    }
    l.push("");
  });

  l.push("---");
  l.push(`*生成时间：${new Date().toLocaleString("zh-CN")}*`);
  return l.join("\n");
}

async function generateDocx(data: CareerExportData): Promise<Blob> {
  const children: Paragraph[] = [];

  children.push(new Paragraph({ text: `${data.roleLabel} — 求职规划报告`, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: "由 职镜 生成", italics: true, color: "888888", size: 20 })], alignment: AlignmentType.CENTER, spacing: { after: 400 } }));

  children.push(new Paragraph({ text: "简历解析", heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }));
  if (data.resume.skills.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: "技能", bold: true })], spacing: { after: 80 } }));
    data.resume.skills.forEach((s) => children.push(new Paragraph({ children: [new TextRun({ text: `• ${s.name}（${s.level}，${s.years}年）` })], spacing: { after: 60 } })));
  }

  children.push(new Paragraph({ text: "技能差距分析", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
  [`匹配率：${data.gap.matchRate}%`, `已有技能：${data.gap.currentSkills.join("、")}`, `目标要求：${data.gap.requiredSkills.join("、")}`, `需要补齐：${data.gap.missingSkills.join("、")}`].forEach((item) => {
    children.push(new Paragraph({ children: [new TextRun({ text: `• ${item}` })], spacing: { after: 80 } }));
  });

  children.push(new Paragraph({ text: "关键诊断", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: `核心问题：${data.diagnosis.coreProblem}` })], spacing: { after: 120 } }));

  children.push(new Paragraph({ text: "学习路径", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
  data.path.steps.forEach((step) => {
    children.push(new Paragraph({ children: [new TextRun({ text: `步骤 ${step.order}：${step.title}`, bold: true })], spacing: { after: 80 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: step.description })], spacing: { after: 60 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: `预计耗时：${step.estimatedDuration}`, italics: true })], spacing: { after: 120 } }));
  });

  children.push(new Paragraph({ children: [new TextRun({ text: `生成时间：${new Date().toLocaleString("zh-CN")}`, italics: true, color: "888888", size: 18 })], alignment: AlignmentType.CENTER, spacing: { before: 400 } }));

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return await Packer.toBlob(doc);
}

export function CareerExportButtons({ data }: { data: CareerExportData }) {
  const handleMD = () => {
    const md = generateMarkdown(data);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    saveAs(blob, `${data.roleLabel}-求职规划.md`);
  };

  const handleDOCX = async () => {
    const blob = await generateDocx(data);
    saveAs(blob, `${data.roleLabel}-求职规划.docx`);
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
