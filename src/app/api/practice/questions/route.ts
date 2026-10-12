import { NextResponse } from "next/server";
import { getRoleContent } from "@/lib/job-roles/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 题库练习数据。
 *
 * **完全离线**：只读 `data/roles/**`，不调用任何 AI。
 * 这是「没有 AI 密钥也能用」这条降级路径的主要载体 ——
 * 用户仍然可以按岗位浏览题目、看考察维度与答题要点。
 *
 * 返回：
 * - `role`        岗位元信息
 * - `dimensions`  4 个考察维度（含每个维度的三层追问与及格线）
 * - `questions`   该岗位题库
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const roleId = url.searchParams.get("role")?.trim() || "";
  const stage = url.searchParams.get("stage")?.trim() || "";
  const difficulty = url.searchParams.get("difficulty")?.trim() || "";

  if (!roleId) {
    return NextResponse.json({ error: "缺少 role 参数。" }, { status: 400 });
  }

  const content = getRoleContent(roleId);
  if (!content) {
    return NextResponse.json(
      { error: "该岗位暂无离线内容。" },
      { status: 404 }
    );
  }

  let questions = content.questions;
  if (stage) questions = questions.filter((q) => q.stage === stage);
  if (difficulty) questions = questions.filter((q) => q.difficulty === difficulty);

  return NextResponse.json({
    role: {
      id: content.id,
      label: content.label,
      summary: content.summary,
      description: content.description,
      skills: content.skills,
    },
    dimensions: content.dimensions,
    questions: questions.map((q) => ({
      id: q.id,
      stage: q.stage,
      difficulty: q.difficulty,
      title: q.title,
      content: q.content,
      tags: q.tags ?? [],
      company: q.company,
      // 来源如实透出：AI 生成的题目必须能让用户看出来
      source: q.source,
    })),
    total: content.questions.length,
  });
}
