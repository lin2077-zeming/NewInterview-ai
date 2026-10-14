import { desc, eq } from "drizzle-orm";
import { db, ready } from "@/lib/db";
import { interviews, reviews } from "@/lib/db/schema";
import { getSessionId } from "@/lib/session";

/**
 * 复盘报告的历史记录查询。
 *
 * ## 用户隔离怎么做（这是本模块最要紧的一点）
 * **直接在查询条件里带上当前会话的 `session_id`**，而不是"先查出来再判断归属"：
 *
 * - 前者：别人的记录**根本不会被查出来**，没有任何"判断失误就泄漏"的可能；
 * - 后者：一旦某处忘记加判断，或者判断写错（比如比较对象搞反），就会越权。
 *
 * 会话读不到时返回空列表 —— 说明这台浏览器从来没产出过交付，本来就该是空的。
 *
 * 与 `/api/interview/review/[id]` 的 `assertInterviewOwner`（越权一律 404）
 * 是同一个思路的两面：**不给它查出来的机会**。
 */

/** 列表项：只取列表要显示的最小字段，不搬整份报告 */
export interface ReviewHistoryItem {
  interviewId: string;
  /** 目标岗位 */
  role: string;
  /** 公司类型 key，展示名由 COMPANY_FLOWS 映射 */
  companyType: string;
  /** normal | reversed */
  mode: string;
  /** 总分 */
  overallScore: number;
  /** 报告生成时间（ISO） */
  createdAt: string;
}

export async function listMyReviews(limit = 50): Promise<ReviewHistoryItem[]> {
  await ready();

  const sessionId = await getSessionId();
  if (!sessionId) return [];

  const rows = await db
    .select({
      interviewId: interviews.id,
      role: interviews.role,
      companyType: interviews.companyType,
      mode: interviews.mode,
      overallScore: reviews.overallScore,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(interviews, eq(reviews.interviewId, interviews.id))
    .where(eq(interviews.sessionId, sessionId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    interviewId: row.interviewId,
    role: row.role,
    companyType: row.companyType,
    mode: row.mode,
    overallScore: row.overallScore,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  }));
}
