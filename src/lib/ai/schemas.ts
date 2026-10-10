import { z } from "zod";

// ========== 简历解析 ==========

export const parsedSkillSchema = z.object({
  name: z.string().describe("技能名称"),
  level: z.enum(["入门", "熟悉", "精通"]).describe("熟悉程度"),
  years: z.number().min(0).describe("使用年限"),
});

export const parsedExperienceSchema = z.object({
  title: z.string().describe("职位名称"),
  company: z.string().describe("公司名称"),
  description: z.string().describe("工作描述"),
  techStack: z.array(z.string()).describe("技术栈"),
});

export const parsedResumeSchema = z.object({
  skills: z.array(parsedSkillSchema).describe("解析出的技能列表"),
  experience: z.array(parsedExperienceSchema).describe("解析出的工作/项目经历"),
  education: z.string().describe("教育背景"),
  rawText: z.string().describe("简历原始文本"),
});

// ========== 复盘报告 ==========

export const dimensionScoresSchema = z.object({
  technical: z.number().min(1).max(100).describe("技术能力评分"),
  communication: z.number().min(1).max(100).describe("沟通表达评分"),
  logic: z.number().min(1).max(100).describe("思维逻辑评分"),
  depth: z.number().min(1).max(100).describe("知识深度评分"),
  coding: z
    .preprocess((value) => (value === null ? undefined : value), z.number().min(1).max(100).optional())
    .describe("代码能力评分"),
});

export const perQuestionAnalysisSchema = z.object({
  question: z.string().describe("面试官的问题"),
  yourAnswer: z.string().describe("候选人的回答概述"),
  score: z.number().min(1).max(10).describe("1-10分评分"),
  strengths: z.array(z.string()).describe("回答的优点"),
  weaknesses: z.array(z.string()).describe("可以改进的地方"),
  suggestedAnswer: z.string().describe("更好的示范回答"),
});

export const reviewReportSchema = z.object({
  overallScore: z.number().min(1).max(100).describe("整体评分"),
  passDecision: z
    .enum(["strong_pass", "pass", "borderline", "fail"])
    .describe("如果这是正式面试，候选人的通过结论"),
  passProbability: z.number().min(0).max(100).describe("正式面试通过概率"),
  hiringVerdict: z.string().describe("一句话录用/通过判断，直接说明能否通过"),
  coreDiagnosis: z.string().describe("本次面试最核心的问题或最关键的通过理由"),
  dimensionScores: dimensionScoresSchema,
  perQuestionAnalysis: z.array(perQuestionAnalysisSchema).describe("逐题分析"),
  top3Strengths: z.array(
    z.object({
      point: z.string().describe("优势点"),
      example: z.string().describe("面试中的具体例子"),
    })
  ).describe("Top3优势"),
  top3Weaknesses: z.array(
    z.object({
      point: z.string().describe("待改进点"),
      example: z.string().describe("具体表现"),
      suggestion: z.string().describe("改进建议"),
    })
  ).describe("Top3待改进"),
  improvementPlan: z.array(
    z.object({
      area: z.string().describe("改进领域"),
      action: z.string().describe("具体行动"),
      resources: z.array(z.string()).describe("推荐资源"),
    })
  ).describe("改进计划"),
});

// ========== 职业规划 ==========

export const skillGapSchema = z.object({
  currentSkills: z.array(z.string()).describe("当前已有技能"),
  requiredSkills: z.array(z.string()).describe("目标岗位要求技能"),
  missingSkills: z.array(z.string()).describe("缺失技能列表"),
  matchRate: z.number().min(0).max(100).describe("技能匹配率"),
});

export const learningResourceSchema = z.object({
  name: z.string().describe("资源名称"),
  url: z.string().describe("资源链接"),
  type: z.enum(["course", "book", "project"]).describe("资源类型"),
});

export const learningStepSchema = z.object({
  order: z.number().int().min(1).describe("步骤序号"),
  title: z.string().describe("步骤标题"),
  description: z.string().describe("步骤描述"),
  resources: z.array(learningResourceSchema).describe("推荐资源"),
  estimatedDuration: z.string().describe("预计耗时"),
});

export const learningPathOutputSchema = z.object({
  steps: z.array(learningStepSchema).describe("学习路径步骤"),
  totalDuration: z.string().describe("总预计耗时"),
});
