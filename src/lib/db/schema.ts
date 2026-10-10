import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * 匿名会话。
 *
 * 不要求注册登录，但每位访客有一个独立会话 ID，
 * 业务表通过 `sessionId` 归属到会话，实现数据隔离。
 */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
});

export const resumes = sqliteTable("resumes", {
  id: text("id").primaryKey(),
  sessionId: text("session_id"),
  userId: text("user_id"),
  rawText: text("raw_text").notNull(),
  parsedSkills: text("parsed_skills"),
  parsedExperience: text("parsed_experience"),
  education: text("education"),
  fileUrl: text("file_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const interviews = sqliteTable("interviews", {
  id: text("id").primaryKey(),
  sessionId: text("session_id"),
  userId: text("user_id"),
  resumeId: text("resume_id").references(() => resumes.id),
  role: text("role").notNull(),
  companyType: text("company_type").notNull(),
  mode: text("mode").notNull().default("normal"),
  stressMode: integer("stress_mode", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("in_progress"),
  currentStage: text("current_stage").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  interviewId: text("interview_id")
    .references(() => interviews.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  stage: text("stage").notNull(),
  codeSnippet: text("code_snippet"),
  score: integer("score"),
  feedback: text("feedback"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  interviewId: text("interview_id")
    .references(() => interviews.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  overallScore: integer("overall_score").notNull(),
  dimensionScores: text("dimension_scores").notNull(),
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  perQuestionAnalysis: text("per_question_analysis"),
  improvementPlan: text("improvement_plan"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const learningPaths = sqliteTable("learning_paths", {
  id: text("id").primaryKey(),
  sessionId: text("session_id"),
  userId: text("user_id"),
  targetRole: text("target_role").notNull(),
  gapAnalysis: text("gap_analysis").notNull(),
  steps: text("steps"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
