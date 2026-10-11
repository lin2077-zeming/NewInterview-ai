import { INTERVIEW_QUESTIONS, type InterviewQuestion } from "@/config/interview-questions";
import { getRemoteQuestions } from "@/lib/ai/question-fetcher";
import { getRoleQuestions } from "@/lib/job-roles/loader";

/**
 * 面试排题的题目池。
 *
 * 数据来源的优先级与边界：
 * 1. **岗位自己的题库**（`data/roles/<id>.json`）—— 64 个子类都有，优先用
 * 2. **旧题库回落**（内置 63 题 + remote 293 题）—— 仅当岗位属于计算机/电子大类时
 *
 * 第 2 条的限制是刻意的：旧题库 356 题**全部**是「后端开发工程师 / 算法面」向，
 * 拿它去给教师、护士、会计岗位出题会直接串岗 —— 那正是这次重构要解决的问题。
 * 与其喂错的题，不如让 AI 依据岗位描述临场出题。
 */

export interface PoolQuestion {
  id: string;
  /** 题型：algorithm=专业硬技能 / project / cross / hr */
  stage: "algorithm" | "project" | "cross" | "hr";
  title: string;
  content: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  company?: string;
  /** 题目来源，便于排查「这道题哪来的」 */
  origin: "role" | "legacy";
}

/** 允许回落旧题库的大类（旧题库内容全部属于这两个方向） */
const LEGACY_COMPATIBLE_CATEGORIES = new Set(["cs-it", "ee-telecom"]);

function categoryOf(roleId: string): string {
  return roleId.split(".")[0] ?? "";
}

let legacyCache: PoolQuestion[] | null = null;

async function legacyPool(): Promise<PoolQuestion[]> {
  if (legacyCache) return legacyCache;

  const remote = await getRemoteQuestions();
  const merged: InterviewQuestion[] = [...INTERVIEW_QUESTIONS, ...remote];

  const seen = new Set<string>();
  const out: PoolQuestion[] = [];
  for (const q of merged) {
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    out.push({
      id: q.id,
      stage: q.stage,
      title: q.title,
      content: q.content,
      difficulty: q.difficulty,
      tags: q.tags,
      company: q.company,
      origin: "legacy",
    });
  }

  legacyCache = out;
  return out;
}

/**
 * 构建该岗位可用的题目池。
 *
 * @param roleId 新体系子类 id（如 `edu-research.k12-teacher`）。
 *               传空表示未指定岗位，走旧题库兜底。
 */
export async function buildQuestionPool(roleId?: string): Promise<PoolQuestion[]> {
  if (roleId) {
    const own = getRoleQuestions(roleId);
    if (own.length > 0) {
      return own.map((q) => ({
        id: q.id,
        stage: q.stage,
        title: q.title,
        content: q.content,
        difficulty: q.difficulty,
        tags: q.tags ?? [],
        company: q.company,
        origin: "role" as const,
      }));
    }

    if (LEGACY_COMPATIBLE_CATEGORIES.has(categoryOf(roleId))) {
      return legacyPool();
    }

    // 非技术岗位 / 管理员自定义岗位没有现成题目：
    // 不回落到旧题库，交给 AI 按岗位描述临场出题
    return [];
  }

  return legacyPool();
}

/** 题目池的岗位标签，直接来自题库数据 */
export function tagsOf(pool: PoolQuestion[]): string[] {
  const set = new Set<string>();
  for (const q of pool) for (const t of q.tags) set.add(t);
  return [...set];
}
