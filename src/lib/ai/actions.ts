"use server";

import { randomUUID } from "crypto";
import { generateObject, generateText } from "ai";
import { and, eq, desc, inArray } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { COMPANY_FLOWS } from "@/config/interview-stages";
import {
  sessions,
  resumes,
  interviews,
  messages,
  reviews,
  learningPaths,
} from "@/lib/db/schema";
import { analysisModel } from "@/lib/ai/client";
import { ensureSessionId, getSessionId } from "@/lib/session";
import { NotFoundError } from "@/lib/errors";
import { maskPii } from "@/lib/privacy";
import { getCareerAdvisorSystemPrompt } from "@/lib/ai/prompts/career-advisor";
import { getReviewerSystemPrompt } from "@/lib/ai/prompts/reviewer";
import {
  parsedResumeSchema,
  skillGapSchema,
  learningPathOutputSchema,
  reviewReportSchema,
} from "@/lib/ai/schemas";
import type {
  InterviewConfig,
  ParsedResume,
  SkillGap,
  LearningPath,
  ReviewReport,
} from "@/types";

/**
 * 校验某场面试属于当前会话。
 * 不通过时抛 NotFoundError —— 对外表现为 404，避免暴露面试 ID 是否存在。
 */
async function assertInterviewOwner(interviewId: string, sessionId: string): Promise<void> {
  const rows = await db
    .select({ id: interviews.id })
    .from(interviews)
    .where(and(eq(interviews.id, interviewId), eq(interviews.sessionId, sessionId)))
    .limit(1);

  if (rows.length === 0) {
    throw new NotFoundError("面试不存在或无权访问。");
  }
}

/** 登记会话（首次写入时落库） */
async function touchSession(sessionId: string): Promise<void> {
  const now = new Date();
  const existing = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(sessions).values({ id: sessionId, createdAt: now, lastSeenAt: now });
  }
}

// ========== 面试会话 ==========

export async function createInterview(
  config: InterviewConfig
): Promise<{ interviewId: string }> {
  await ready();
  const sessionId = await ensureSessionId();
  await touchSession(sessionId);

  const id = randomUUID();
  const flow = COMPANY_FLOWS[config.company] ?? COMPANY_FLOWS.bytedance;
  const stageIndex = Math.min(
    Math.max(config.stageIndex ?? 0, 0),
    flow.stages.length - 1
  );
  const firstStage = flow.stages[stageIndex]?.id ?? "algorithm";

  await db.insert(interviews).values({
    id,
    sessionId,
    role: config.role,
    companyType: config.company,
    mode: config.mode,
    stressMode: config.stressMode,
    status: "in_progress",
    currentStage: firstStage,
    createdAt: new Date(),
    resumeId: config.resumeId || null,
  });

  return { interviewId: id };
}

export async function saveMessage(data: {
  interviewId: string;
  role: "interviewer" | "candidate" | "system";
  content: string;
  stage: string;
  codeSnippet?: string;
  score?: number;
  feedback?: string;
}): Promise<void> {
  await ready();
  const sessionId = await getSessionId();
  if (!sessionId) throw new NotFoundError();

  await assertInterviewOwner(data.interviewId, sessionId);

  await db.insert(messages).values({
    id: randomUUID(),
    interviewId: data.interviewId,
    role: data.role,
    content: data.content,
    stage: data.stage,
    codeSnippet: data.codeSnippet ?? null,
    score: data.score ?? null,
    feedback: data.feedback ?? null,
    createdAt: new Date(),
  });
}

export async function getMessages(interviewId: string, stage?: string) {
  await ready();
  const sessionId = await getSessionId();
  if (!sessionId) throw new NotFoundError();

  await assertInterviewOwner(interviewId, sessionId);

  const whereClause = stage
    ? and(eq(messages.interviewId, interviewId), eq(messages.stage, stage))
    : eq(messages.interviewId, interviewId);

  return db
    .select()
    .from(messages)
    .where(whereClause)
    .orderBy(messages.createdAt);
}

export async function updateInterviewStage(
  interviewId: string,
  stage: string,
  status?: string
): Promise<void> {
  await ready();
  const sessionId = await getSessionId();
  if (!sessionId) throw new NotFoundError();

  await assertInterviewOwner(interviewId, sessionId);
  const updateData: Record<string, unknown> = { currentStage: stage };
  if (status) {
    updateData.status = status;
  }
  await db
    .update(interviews)
    .set(updateData as never)
    .where(eq(interviews.id, interviewId));
}

// ========== 简历解析 ==========

export async function analyzeResume(
  resumeText: string,
  options: { persist?: boolean } = {}
): Promise<ParsedResume> {
  const result = await generateObject({
    model: analysisModel,
    system: getCareerAdvisorSystemPrompt(),
    schema: parsedResumeSchema,
    prompt: `请分析以下简历内容，提取技能、工作经历和教育背景：

简历内容：
${resumeText}`,
  });

  const parsed = result.object;

  if (options.persist) {
    await ready();
    const sessionId = await ensureSessionId();
    await touchSession(sessionId);

    await db.insert(resumes).values({
      id: randomUUID(),
      sessionId,
      // 手机号 / 邮箱 / 身份证对分析没有价值，落库前脱敏
      rawText: maskPii(resumeText),
      parsedSkills: JSON.stringify(parsed.skills),
      parsedExperience: JSON.stringify(parsed.experience),
      education: parsed.education,
      createdAt: new Date(),
    });
  }

  return { ...parsed, rawText: resumeText };
}

// ========== 技能差距分析 ==========

export async function analyzeSkillGap(
  currentSkills: string[],
  targetRole: string
): Promise<SkillGap> {
  const skillsText = currentSkills.join("、");

  const result = await generateObject({
    model: analysisModel,
    system: getCareerAdvisorSystemPrompt(),
    schema: skillGapSchema,
    prompt: `请分析以下技能与目标岗位的差距。

当前技能：${skillsText}
目标岗位：${targetRole}

请输出技能差距分析，包括当前已有技能、目标岗位要求技能、缺失技能和匹配率。`,
  });

  return result.object;
}

// ========== 学习路径生成 ==========

export async function generateLearningPath(
  targetRole: string,
  skillGap: SkillGap
): Promise<LearningPath> {
  const result = await generateObject({
    model: analysisModel,
    system: getCareerAdvisorSystemPrompt(),
    schema: learningPathOutputSchema,
    prompt: `请根据以下技能差距分析，生成一份分阶段的学习路径。

目标岗位：${targetRole}
当前已有技能：${skillGap.currentSkills.join("、")}
缺失技能：${skillGap.missingSkills.join("、")}
技能匹配率：${skillGap.matchRate}%

请设计3-4个阶段的学习计划，每个阶段2-4周，推荐具体学习资源。`,
  });

  await ready();
  const sessionId = await ensureSessionId();
  await touchSession(sessionId);

  const id = randomUUID();

  await db.insert(learningPaths).values({
    id,
    sessionId,
    targetRole,
    gapAnalysis: JSON.stringify(skillGap),
    steps: JSON.stringify(result.object.steps),
    createdAt: new Date(),
  });

  return {
    id,
    userId: sessionId,
    targetRole,
    gapAnalysis: skillGap,
    steps: result.object.steps.map((s) => ({
      ...s,
      resources: s.resources,
    })),
    createdAt: new Date(),
  };
}

export async function getLearningPath(pathId: string) {
  await ready();
  const sessionId = await getSessionId();
  if (!sessionId) return null;

  const rows = await db
    .select()
    .from(learningPaths)
    .where(and(eq(learningPaths.id, pathId), eq(learningPaths.sessionId, sessionId)));

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    userId: row.sessionId ?? "",
    targetRole: row.targetRole,
    gapAnalysis: JSON.parse(row.gapAnalysis) as SkillGap,
    steps: JSON.parse(row.steps || "[]"),
    createdAt: new Date(row.createdAt),
  } as LearningPath;
}

// ========== 复盘报告生成 ==========

export async function generateReview(
  interviewId: string,
  stage?: string,
): Promise<ReviewReport> {
  await ready();
  // getMessages 内部已校验该面试属于当前会话，越权会抛 NotFoundError
  const messageList = await getMessages(interviewId, stage);
  const interviewRows = await db
    .select()
    .from(interviews)
    .where(eq(interviews.id, interviewId));
  const interview = interviewRows[0];

  if (messageList.length === 0) {
    throw new Error("该面试没有对话记录");
  }

  const conversationText = messageList
    .map(
      (m) =>
        `[${m.role === "interviewer" ? "面试官" : "候选人"}]: ${m.content}`
    )
    .join("\n\n");

  const reviewPrompt = `请分析以下面试对话，生成详细的复盘报告。

面试信息：
- 目标公司：${interview?.companyType || "未知"}
- 目标岗位：${interview?.role || "未知"}
- 面试模式：${interview?.mode === "reversed" ? "用户作为面试官" : "用户作为候选人"}
- 本次面试模块：${interview?.currentStage || "未知"}

评价对象：
${interview?.mode === "reversed"
  ? "用户是面试官，请评价用户的提问质量、追问深度、判断能力和面试节奏控制，不要评价 AI 候选人是否能通过。"
  : "用户是候选人，请评价用户作为候选人的回答质量、岗位匹配度和正式面试通过概率。"}

${conversationText}

请严格只输出一个 JSON 对象，不要使用 Markdown 代码块，不要添加任何解释文字。
必须使用英文 key，禁止使用中文字段名。JSON 结构必须完全符合下面模板：
{
  "overallScore": 72,
  "passDecision": "borderline",
  "passProbability": 65,
  "hiringVerdict": "正式面试处于边缘状态，需要补充考察项目深度。",
  "coreDiagnosis": "最大问题是表现停留在表层，缺少具体证据支撑。",
  "dimensionScores": {
    "technical": 70,
    "communication": 75,
    "logic": 68,
    "depth": 62,
    "coding": 60
  },
  "perQuestionAnalysis": [
    {
      "question": "面试官原问题",
      "yourAnswer": "候选人回答概述，或 AI 候选人的回答概述",
      "score": 6,
      "strengths": ["优点1"],
      "weaknesses": ["问题1"],
      "suggestedAnswer": "更好的示范回答，或更好的面试官追问示例"
    }
  ],
  "top3Strengths": [
    { "point": "优势点", "example": "面试中的具体证据" }
  ],
  "top3Weaknesses": [
    { "point": "问题点", "example": "面试中的具体表现", "suggestion": "改进建议" }
  ],
  "improvementPlan": [
    { "area": "改进领域", "action": "具体行动", "resources": ["资源1", "资源2"] }
  ]
}
passDecision 只能是 strong_pass、pass、borderline、fail。resources 必须是字符串数组。`;

  const result = await generateText({
    model: analysisModel,
    system: getReviewerSystemPrompt(),
    prompt: reviewPrompt,
  });

  const report = await parseReviewReportWithRepair(result.text);

  const existingRows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.interviewId, interviewId));
  const existing = existingRows[0];

  if (existing) {
    await db
      .update(reviews)
      .set({
        overallScore: report.overallScore,
        dimensionScores: JSON.stringify(report.dimensionScores),
        perQuestionAnalysis: JSON.stringify(report.perQuestionAnalysis),
        strengths: JSON.stringify(report.top3Strengths),
        weaknesses: JSON.stringify(report.top3Weaknesses),
        improvementPlan: JSON.stringify(report.improvementPlan),
      })
      .where(eq(reviews.id, existing.id));
  } else {
    await db.insert(reviews).values({
      id: randomUUID(),
      interviewId,
      overallScore: report.overallScore,
      dimensionScores: JSON.stringify(report.dimensionScores),
      perQuestionAnalysis: JSON.stringify(report.perQuestionAnalysis),
      strengths: JSON.stringify(report.top3Strengths),
      weaknesses: JSON.stringify(report.top3Weaknesses),
      improvementPlan: JSON.stringify(report.improvementPlan),
      createdAt: new Date(),
    });
  }

  await db
    .update(interviews)
    .set({ status: "completed" as never })
    .where(eq(interviews.id, interviewId));

  return report;
}

export async function getReview(interviewId: string) {
  await ready();
  const sessionId = await getSessionId();
  if (!sessionId) return null;

  // 先确认这场面试属于当前会话，否则一律当作不存在
  await assertInterviewOwner(interviewId, sessionId);

  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.interviewId, interviewId));

  const row = rows[0];
  if (!row) return null;

  const baseReport = {
    overallScore: row.overallScore,
    dimensionScores: JSON.parse(row.dimensionScores),
    perQuestionAnalysis: JSON.parse(row.perQuestionAnalysis || "[]"),
    top3Strengths: JSON.parse(row.strengths || "[]"),
    top3Weaknesses: JSON.parse(row.weaknesses || "[]"),
    improvementPlan: JSON.parse(row.improvementPlan || "[]"),
  };

  return {
    ...baseReport,
    ...derivePassAssessment(baseReport as ReviewReport),
  } as ReviewReport;
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced?.[1] ?? trimmed;
  const start = jsonText.indexOf("{");
  const end = jsonText.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI 未返回可解析的 JSON 复盘报告");
  }

  return JSON.parse(jsonText.slice(start, end + 1));
}

async function parseReviewReportWithRepair(text: string): Promise<ReviewReport> {
  const parsed = reviewReportSchema.safeParse(parseJsonObject(text));
  if (parsed.success) {
    return parsed.data;
  }

  const repair = await generateText({
    model: analysisModel,
    system: "你是一个严格的 JSON 修复器，只能输出合法 JSON，不要输出解释。",
    prompt: `下面是一个面试复盘 JSON，但它不符合目标 schema。请把它改成完全符合 schema 的 JSON。

修复要求：
- 只能使用英文 key
- coding 如果没有考察，也给出 1-100 的估计分数
- perQuestionAnalysis 每一项必须包含 question、yourAnswer、score、strengths、weaknesses、suggestedAnswer
- top3Strengths 每一项必须包含 point、example
- top3Weaknesses 每一项必须包含 point、example、suggestion
- improvementPlan 每一项必须包含 area、action、resources，其中 resources 必须是字符串数组
- passDecision 只能是 strong_pass、pass、borderline、fail
- 只输出 JSON 对象

原始内容：
${text}

校验错误：
${parsed.error.message}`,
  });

  return reviewReportSchema.parse(parseJsonObject(repair.text));
}

function derivePassAssessment(report: Pick<
  ReviewReport,
  "overallScore" | "top3Strengths" | "top3Weaknesses"
>) {
  if (report.overallScore >= 85) {
    return {
      passDecision: "strong_pass" as const,
      passProbability: Math.min(95, report.overallScore + 5),
      hiringVerdict: "正式面试大概率通过，表现已经达到较强候选人水平。",
      coreDiagnosis:
        report.top3Strengths[0]?.point || "整体表现稳定，关键能力匹配目标岗位。",
    };
  }

  if (report.overallScore >= 75) {
    return {
      passDecision: "pass" as const,
      passProbability: report.overallScore,
      hiringVerdict: "正式面试有较大机会通过，但需要补足关键短板。",
      coreDiagnosis:
        report.top3Weaknesses[0]?.point || "存在局部短板，但未明显影响整体胜任度。",
    };
  }

  if (report.overallScore >= 65) {
    return {
      passDecision: "borderline" as const,
      passProbability: report.overallScore,
      hiringVerdict: "正式面试处于边缘状态，是否通过取决于追问表现和竞争情况。",
      coreDiagnosis:
        report.top3Weaknesses[0]?.point || "部分回答缺少深度或证据，需要补充考察。",
    };
  }

  return {
    passDecision: "fail" as const,
    passProbability: Math.max(10, report.overallScore),
    hiringVerdict: "正式面试不建议通过，当前表现与岗位要求仍有明显差距。",
    coreDiagnosis:
      report.top3Weaknesses[0]?.point || "核心能力呈现不足，回答质量无法支撑通过判断。",
  };
}

/** 当前会话的面试列表 */
export async function getSessionInterviews() {
  await ready();
  const sessionId = await getSessionId();
  if (!sessionId) return [];

  return db
    .select()
    .from(interviews)
    .where(eq(interviews.sessionId, sessionId))
    .orderBy(desc(interviews.createdAt));
}

// ========== 数据删除（隐私）==========

export interface DeletionSummary {
  interviews: number;
  messages: number;
  reviews: number;
  resumes: number;
  learningPaths: number;
  sessions: number;
}

/**
 * 删除当前会话的全部数据。
 *
 * 逐表显式删除而不是依赖外键级联 —— SQLite 需要开启 PRAGMA foreign_keys 才生效，
 * 这里不假设它已开启。
 */
export async function deleteSessionData(): Promise<DeletionSummary> {
  await ready();
  const sessionId = await getSessionId();

  const summary: DeletionSummary = {
    interviews: 0,
    messages: 0,
    reviews: 0,
    resumes: 0,
    learningPaths: 0,
    sessions: 0,
  };

  if (!sessionId) return summary;

  const ownedInterviews = await db
    .select({ id: interviews.id })
    .from(interviews)
    .where(eq(interviews.sessionId, sessionId));
  const interviewIds = ownedInterviews.map((row) => row.id);

  if (interviewIds.length > 0) {
    const removedReviews = await db
      .delete(reviews)
      .where(inArray(reviews.interviewId, interviewIds))
      .returning({ id: reviews.id });
    const removedMessages = await db
      .delete(messages)
      .where(inArray(messages.interviewId, interviewIds))
      .returning({ id: messages.id });

    summary.reviews = removedReviews.length;
    summary.messages = removedMessages.length;
  }

  const removedInterviews = await db
    .delete(interviews)
    .where(eq(interviews.sessionId, sessionId))
    .returning({ id: interviews.id });
  const removedResumes = await db
    .delete(resumes)
    .where(eq(resumes.sessionId, sessionId))
    .returning({ id: resumes.id });
  const removedPaths = await db
    .delete(learningPaths)
    .where(eq(learningPaths.sessionId, sessionId))
    .returning({ id: learningPaths.id });
  const removedSessions = await db
    .delete(sessions)
    .where(eq(sessions.id, sessionId))
    .returning({ id: sessions.id });

  summary.interviews = removedInterviews.length;
  summary.resumes = removedResumes.length;
  summary.learningPaths = removedPaths.length;
  summary.sessions = removedSessions.length;

  return summary;
}
