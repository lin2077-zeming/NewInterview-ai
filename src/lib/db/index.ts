import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle>;

let _db: DrizzleDb | null = null;
let _client: Client | null = null;
let _initPromise: Promise<void> | null = null;

const CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS resumes (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    user_id TEXT,
    raw_text TEXT NOT NULL,
    parsed_skills TEXT,
    parsed_experience TEXT,
    education TEXT,
    file_url TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS interviews (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    user_id TEXT,
    resume_id TEXT REFERENCES resumes(id),
    role TEXT NOT NULL,
    company_type TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'normal',
    stress_mode INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'in_progress',
    current_stage TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    stage TEXT NOT NULL,
    code_snippet TEXT,
    score INTEGER,
    feedback TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    interview_id TEXT NOT NULL UNIQUE REFERENCES interviews(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL,
    dimension_scores TEXT NOT NULL,
    strengths TEXT,
    weaknesses TEXT,
    per_question_analysis TEXT,
    improvement_plan TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS learning_paths (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    user_id TEXT,
    target_role TEXT NOT NULL,
    gap_analysis TEXT NOT NULL,
    steps TEXT,
    created_at INTEGER NOT NULL
  )`,
  // 按会话隔离的查询会用到
  `CREATE INDEX IF NOT EXISTS idx_interviews_session ON interviews(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_resumes_session ON resumes(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_learning_paths_session ON learning_paths(session_id)`,
  `CREATE TABLE IF NOT EXISTS job_roles (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    category TEXT,
    description TEXT NOT NULL,
    skills TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_job_roles_enabled ON job_roles(enabled)`,
  `CREATE TABLE IF NOT EXISTS cost_logs (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    kind TEXT NOT NULL,
    model TEXT NOT NULL,
    channel TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  // 限流按 (会话, 时间窗口) 查、预算按时间查，两个索引各服务一类查询
  `CREATE INDEX IF NOT EXISTS idx_cost_logs_session_time ON cost_logs(session_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_cost_logs_time ON cost_logs(created_at)`,
];

/**
 * 旧库补列。
 * SQLite 不支持 `ADD COLUMN IF NOT EXISTS`，重复执行会报 duplicate column，
 * 这里逐条执行并忽略该错误，保证新旧数据库都能用。
 */
const MIGRATION_STATEMENTS = [
  `ALTER TABLE resumes ADD COLUMN session_id TEXT`,
  `ALTER TABLE interviews ADD COLUMN session_id TEXT`,
  `ALTER TABLE learning_paths ADD COLUMN session_id TEXT`,
];

async function ensureSchema(client: Client): Promise<void> {
  // 建表与补列必须等待完成，否则首个请求可能在建表尚未结束时就来查询
  for (const statement of CREATE_STATEMENTS) {
    await client.execute(statement);
  }

  for (const statement of MIGRATION_STATEMENTS) {
    try {
      await client.execute(statement);
    } catch {
      // 列已存在，忽略
    }
  }
}

function createDb(): DrizzleDb {
  const dbUrl = process.env.DATABASE_URL || "file:/tmp/interview.db";

  _client = createClient({ url: dbUrl });
  _initPromise = ensureSchema(_client).catch((error) => {
    console.error("[db] 初始化失败:", error);
  });

  return drizzle(_client, { schema });
}

/** 显式等待数据库初始化完成（Route Handler 里按需调用） */
export async function ready(): Promise<void> {
  if (!_db) _db = createDb();
  await _initPromise;
}

/**
 * 懒加载数据库实例。
 * 使用 Proxy 确保所有属性访问触发初始化，
 * 调用方无需修改（db.select() 等写法保持不变）。
 */
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    if (!_db) {
      _db = createDb();
    }
    return Reflect.get(_db, prop, receiver);
  },
});
