import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle>;

let _db: DrizzleDb | null = null;
let _client: Client | null = null;

function initDb(): DrizzleDb {
  const dbUrl = process.env.DATABASE_URL || "file:/tmp/interview.db";

  _client = createClient({
    url: dbUrl,
  });

  // 建表（libsql 执行多条语句需要逐条执行）
  _client.execute(`
    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      raw_text TEXT NOT NULL,
      parsed_skills TEXT,
      parsed_experience TEXT,
      education TEXT,
      file_url TEXT,
      created_at INTEGER NOT NULL
    )
  `);
  _client.execute(`
    CREATE TABLE IF NOT EXISTS interviews (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      resume_id TEXT REFERENCES resumes(id),
      role TEXT NOT NULL,
      company_type TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'normal',
      stress_mode INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'in_progress',
      current_stage TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  _client.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      stage TEXT NOT NULL,
      code_snippet TEXT,
      score INTEGER,
      feedback TEXT,
      created_at INTEGER NOT NULL
    )
  `);
  _client.execute(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      interview_id TEXT NOT NULL UNIQUE REFERENCES interviews(id) ON DELETE CASCADE,
      overall_score INTEGER NOT NULL,
      dimension_scores TEXT NOT NULL,
      strengths TEXT,
      weaknesses TEXT,
      per_question_analysis TEXT,
      improvement_plan TEXT,
      created_at INTEGER NOT NULL
    )
  `);
  _client.execute(`
    CREATE TABLE IF NOT EXISTS learning_paths (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      target_role TEXT NOT NULL,
      gap_analysis TEXT NOT NULL,
      steps TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  return drizzle(_client, { schema });
}

/**
 * 懒加载数据库实例。
 * 使用 Proxy 确保所有属性访问触发初始化，
 * 调用方无需修改（db.select() 等写法保持不变）。
 */
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    if (!_db) {
      _db = initDb();
    }
    return Reflect.get(_db, prop, receiver);
  },
});
