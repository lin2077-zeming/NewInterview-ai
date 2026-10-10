"use client";

import { useEffect, useState } from "react";

export interface RoleOption {
  key: string;
  label: string;
  category?: string;
  skills: string[];
  source: "builtin" | "admin";
  /** 是否有手写的离线追问链；为 false 时无 AI 密钥只能用通用追问 */
  hasOfflineContent: boolean;
}

/**
 * 拉取岗位列表（内置 + 管理员新增）。
 *
 * 前端不再直接 import 岗位配置 —— 那样新增的岗位不会出现在下拉里。
 */
export function useJobRoles() {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/roles", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "读取岗位列表失败");
        if (!cancelled) setRoles((data.roles ?? []) as RoleOption[]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "读取岗位列表失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { roles, loading, error };
}
