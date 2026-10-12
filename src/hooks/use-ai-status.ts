"use client";

import { useEffect, useState } from "react";

/**
 * AI 可用状态。
 *
 * 离线时前端需要**明确告诉用户**现在是什么状态、哪些功能还能用 ——
 * 否则用户点了「开始面试」没反应，只会以为是系统坏了。
 */
export interface AiStatus {
  mode: "online" | "offline";
  configured: boolean;
  provider: string;
  model: string;
  fallbackEnabled: boolean;
  reason?: string;
}

export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/ai-status", { cache: "no-store" });
        const data = await response.json();
        if (!cancelled && response.ok) setStatus(data as AiStatus);
      } catch {
        // 取不到状态就当在线处理：宁可少提示一次，也不要误报离线
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, loading, offline: status?.mode === "offline" };
}
