import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

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

/**
 * 岗位。
 *
 * 内置岗位（8 个）仍由代码配置提供，保持现状不动；
 * 本表只存管理员新增的岗位 —— 录入元信息（描述 + 技能要求），
 * 面试风格与追问链由 AI 按描述实时生成。
 */
export const jobRoles = sqliteTable("job_roles", {
  id: text("id").primaryKey(),
  /** 稳定标识，入库后不可修改（历史数据依赖它） */
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  category: text("category"),
  /** 岗位描述：AI 生成面试内容的唯一依据 */
  description: text("description").notNull(),
  /** 技能要求，JSON 字符串数组 */
  skills: text("skills").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * LLM 调用成本流水。
 *
 * 每完成一次 AI 调用记一条：谁调用（会话）、调什么（kind）、
 * 由哪条链路完成（主/备用，单价不同）、消耗多少 token、估算多少钱。
 *
 * 这张表同时支撑三件事：
 * - **成本论证**：OPC 赛道要举证「低成本」，得有真实流水而不是估算口径
 * - **限流**：会话维度的滑动窗口直接查这里，服务重启也不丢
 * - **日预算**：汇总当日开销做告警阈值
 */
export const costLogs = sqliteTable("cost_logs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id"),
  /** 调用来源，如 resume_diagnose / chain_generate */
  kind: text("kind").notNull(),
  /** 实际使用的模型名 */
  model: text("model").notNull(),
  /** 实际完成请求的链路：primary / fallback */
  channel: text("channel").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  /** 估算成本（元） */
  cost: real("cost").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * 迭代记录（真实试用反馈）。
 *
 * 存在的意义：产品迭代不能只有"我觉得应该改"，得有真实用户的原话。
 * 这张表存的是**试用者本人填写**的反馈，不是我们编的 ——
 * 赛事材料里的"应用成效"必须以这里的数据为准。
 *
 * 隐私约束：
 * - 只存**化名 / 编号**，不存真名、不存联系方式
 * - 后台读取需管理员令牌（这是别人的数据，不能公开）
 * - 跟随「删除我的数据」一并清除
 */
export const iterations = sqliteTable("iterations", {
  id: text("id").primaryKey(),
  sessionId: text("session_id"),
  /** 试用者化名或编号，如「同学 A」 */
  participant: text("participant").notNull(),
  /** 试用者背景，如「大四 · 计算机」「研一 · 教育学」 */
  participantRole: text("participant_role"),
  /** 体验过的模块，JSON 字符串数组 */
  triedModules: text("tried_modules"),
  /** 总体评价：good / ok / poor */
  verdict: text("verdict").notNull(),
  /** 最有价值的一点 */
  valuable: text("valuable"),
  /** 最需要改进的一点 */
  improvable: text("improvable"),
  /** 是否愿意继续使用 */
  wouldReuse: integer("would_reuse", { mode: "boolean" }),
  /** 该次试用采集到的量化快照（耗时/条数/成本…），JSON */
  metrics: text("metrics"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
