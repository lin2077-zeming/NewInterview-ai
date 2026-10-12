"use client";

import { useState } from "react";
import { Gauge, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * OPC 运营看板的口令门。
 *
 * 这是**内部工具**的入口，不是给普通用户的功能 —— 所以文案也照着
 * "评委核验"的场景写，而不是产品化的欢迎语。
 *
 * 口令只提交给服务端校验，前端不做任何比对（前端比对等于把口令公开）。
 */
export function StudioGate() {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!password) {
      setError("请输入访问口令。");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/studio/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "口令校验失败。");
      }
      // 校验通过后由服务端重渲染，让页面拿到已解锁状态
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "口令校验失败。");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <Card className="w-full">
        <CardContent className="space-y-5 pt-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <Lock className="h-8 w-8 text-primary" />
            <h1 className="text-lg font-semibold">OPC 运营看板</h1>
            <p className="text-xs leading-5 text-muted-foreground">
              该页面用于核验「一人公司」的运营数据（成本、耗时、AI 完成占比、迭代轮次），
              属内部工具，需口令访问。
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="studio-password">
              访问口令
            </label>
            <input
              id="studio-password"
              type="password"
              value={password}
              autoComplete="off"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmit();
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                校验中
              </>
            ) : (
              <>
                <Gauge className="h-4 w-4" />
                进入看板
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
