"use client";

import { useEffect, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * 岗位数据版本卡片。
 *
 * 放在 OPC 看板上，是因为「数据能持续更新」本身就是一人公司的一项运营能力：
 * 岗位与题库不是发版才能改的死数据，改一个远程文件即可生效。
 *
 * 同时它也解决一个运维问题：**线上跑的是哪一版数据**。
 * 没有这个显示，远程更新出问题时只能靠猜。
 */

interface RoleDataMeta {
  version: number;
  updatedAt: string;
  source: "local" | "remote";
  lastCheckedAt: string | null;
  lastRefreshAt: string | null;
  lastError: string | null;
  subcategoryCount: number;
  remoteEnabled?: boolean;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-CN", { hour12: false });
}

export function RoleDataVersion() {
  const [meta, setMeta] = useState<RoleDataMeta | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/roles", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "读取岗位数据版本失败");
        if (!cancelled) setMeta(data.meta as RoleDataMeta);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "读取失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <Database className="mb-2 h-7 w-7 text-primary" />
        <CardTitle>岗位数据</CardTitle>
        <CardDescription>
          岗位与题库的版本。数据可远程热更新，改内容无需重新发版
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {error ? <p className="text-destructive">{error}</p> : null}

        {meta ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-2xl font-semibold">v{meta.version}</span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {meta.source === "remote" ? "远程热更新" : "随代码发布"}
              </span>
            </div>

            <dl className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between gap-4">
                <dt>数据更新时间</dt>
                <dd>{meta.updatedAt || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>子类数量</dt>
                <dd>{meta.subcategoryCount}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  远程热更新
                </dt>
                <dd>{meta.remoteEnabled ? "已启用" : "未启用"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>上次检查</dt>
                <dd>{formatTime(meta.lastCheckedAt)}</dd>
              </div>
              {meta.lastRefreshAt ? (
                <div className="flex justify-between gap-4">
                  <dt>上次生效</dt>
                  <dd>{formatTime(meta.lastRefreshAt)}</dd>
                </div>
              ) : null}
            </dl>

            {meta.lastError ? (
              <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-xs leading-5 text-amber-700 dark:text-amber-400">
                最近一次拉取未生效：{meta.lastError}
                <br />
                已沿用当前数据，不影响使用。
              </p>
            ) : null}

            {!meta.remoteEnabled ? (
              <p className="text-xs leading-5 text-muted-foreground">
                配置环境变量 <code className="rounded bg-muted px-1">OPC_ROLES_URL</code>{" "}
                指向数据包地址即可开启热更新（数据包由{" "}
                <code className="rounded bg-muted px-1">pnpm roles:bundle</code> 生成）。
              </p>
            ) : null}
          </>
        ) : !error ? (
          <p className="text-muted-foreground">加载中…</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
