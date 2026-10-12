import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-auth";
import { AdminAuthError } from "@/lib/errors";
import { VERDICT_LABELS, listFeedback, summarizeFeedback } from "@/lib/feedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 导出试用反馈（需管理员令牌）。
 *
 * 直接产出可粘进赛事支撑材料的 Markdown —— 手工整理反馈极易出错，
 * 而且容易在"润色"过程中失真。导出原文最省事也最诚实。
 */
export async function GET(req: Request) {
  try {
    assertAdmin(req);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      const status = error.message.includes("未启用") ? 503 : 401;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ error: "导出失败。" }, { status: 500 });
  }

  const records = await listFeedback();
  const s = summarizeFeedback(records);

  const lines = [
    "# 真实用户试用反馈汇总",
    "",
    "> 本表由系统按提交时间自动导出，**未经人工修改**。",
    "> 试用者以化名/编号标识，不含真实姓名与联系方式。",
    "",
    "## 样本概况",
    "",
    `- 反馈条数：**${s.total}**`,
    `- 评价分布：很有用 ${s.good} / 一般 ${s.ok} / 不好用 ${s.poor}`,
    `- 愿意继续使用：**${s.wouldReusePercent}%**（仅统计已作答该项的样本）`,
    s.firstAt ? `- 时间范围：${s.firstAt.slice(0, 10)} ~ ${(s.lastAt ?? s.firstAt).slice(0, 10)}` : "",
    "",
  ];

  if (s.roles.length > 0) {
    lines.push("### 试用者背景分布", "");
    for (const r of s.roles) lines.push(`- ${r.role}：${r.count} 人`);
    lines.push("");
  }

  if (s.modules.length > 0) {
    lines.push("### 各模块被体验次数", "");
    for (const m of s.modules) lines.push(`- ${m.module}：${m.count} 次`);
    lines.push("");
  }

  lines.push("## 反馈明细", "");

  if (records.length === 0) {
    lines.push("_暂无反馈。_", "");
  } else {
    // 按时间正序，便于阅读
    for (const [i, f] of [...records].reverse().entries()) {
      lines.push(`### ${i + 1}. ${f.participant}${f.participantRole ? `（${f.participantRole}）` : ""}`, "");
      lines.push(`- 总体评价：**${VERDICT_LABELS[f.verdict]}**`);
      if (typeof f.wouldReuse === "boolean") {
        lines.push(`- 是否愿意继续使用：${f.wouldReuse ? "是" : "否"}`);
      }
      if (f.triedModules.length > 0) {
        lines.push(`- 体验模块：${f.triedModules.join("、")}`);
      }
      if (f.valuable) lines.push(`- 最有价值：${f.valuable}`);
      if (f.improvable) lines.push(`- 待改进：${f.improvable}`);
      lines.push(`- 提交时间：${f.createdAt.slice(0, 19).replace("T", " ")}`);
      lines.push("");
    }
  }

  const markdown = lines.filter((l) => l !== undefined).join("\n");

  return new NextResponse(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="feedback-${new Date().toISOString().slice(0, 10)}.md"`,
    },
  });
}
