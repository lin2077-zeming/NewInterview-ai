import Link from "next/link";
import { ArrowRight, FileText, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COMPANY_FLOWS } from "@/config/interview-stages";
import { listMyReviews } from "@/lib/review-history";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "历史复盘报告 - 职镜",
};

/** 固定用东八区格式化日期，避免部署到不同时区时时间显示漂移 */
function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreTone(score: number): string {
  if (score >= 80) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (score >= 60) return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "border-destructive/40 bg-destructive/10 text-destructive";
}

/**
 * 复盘报告的历史记录列表。
 *
 * 为什么需要它：复盘原先是一次性的 —— 离开页面后就再也找不回那份报告，
 * 只能从头再面一次。这里把本会话产出过的报告都列出来，随时能回看。
 *
 * 用户隔离：数据由 `listMyReviews()` 在**查询条件里**按当前会话过滤，
 * 别人的报告根本查不出来（详见该方法注释）。
 */
export default async function ReviewHistoryPage() {
  const items = await listMyReviews();

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <History className="h-6 w-6 text-primary" />
            历史复盘报告
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            这里保存你练过的每一场面试的复盘报告，可随时回看。
          </p>
        </div>
        <Link href="/interview/new">
          <Button className="gap-2">
            再练一场
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">还没有复盘报告</p>
            <p className="max-w-md text-sm text-muted-foreground">
              完成一场面试并生成复盘后，报告会自动出现在这里，不会再丢。
            </p>
            <Link href="/interview/new" className="mt-2">
              <Button variant="outline" className="gap-2">
                开始一场面试
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">共 {items.length} 份报告</p>

          {items.map((item) => {
            const companyName = COMPANY_FLOWS[item.companyType]?.name ?? item.companyType;
            const modeLabel = item.mode === "reversed" ? "反转提问" : "常规面试";
            const query = new URLSearchParams({
              role: item.role,
              company: item.companyType,
              mode: item.mode,
            });

            return (
              <Link
                key={item.interviewId}
                href={`/interview/review/${item.interviewId}?${query.toString()}`}
                className="block"
              >
                <Card className="transition-all hover:border-primary/40 hover:shadow-md">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="break-words text-base">{item.role}</CardTitle>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{companyName}</Badge>
                          <Badge variant="secondary">{modeLabel}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(item.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">总分</p>
                          <p className="text-2xl font-bold leading-none">{item.overallScore}</p>
                        </div>
                        <Badge variant="outline" className={scoreTone(item.overallScore)}>
                          {item.overallScore >= 80 ? "表现良好" : item.overallScore >= 60 ? "有待提升" : "需要加强"}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
