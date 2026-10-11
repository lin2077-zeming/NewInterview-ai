"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TOKEN_KEY = "zhijing-opc-admin-token";

interface AdminRole {
  id?: string;
  key: string;
  label: string;
  category?: string;
  description?: string;
  skills: string[];
  enabled: boolean;
  source: "builtin" | "admin";
  hasOfflineContent: boolean;
}

const EMPTY_FORM = {
  label: "",
  category: "",
  description: "",
  skills: "",
  sortOrder: "100",
};

export default function AdminRolesPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_KEY) ?? "";
    // localStorage 只能在客户端读取，必须在挂载后同步一次 —— 该规则的公认例外
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(saved);
  }, []);

  const authorizedFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      return fetch(input, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        cache: "no-store",
      });
    },
    [token]
  );

  const loadRoles = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const response = await authorizedFetch("/api/admin/roles");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "读取失败");
      setRoles((data.roles ?? []) as AdminRole[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取岗位失败");
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch, token]);

  useEffect(() => {
    // loadRoles 内部会先置 loading 再发请求，属于「挂载后拉数据」的标准写法
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token) void loadRoles();
  }, [token, loadRoles]);

  function saveToken() {
    const value = tokenInput.trim();
    if (value.length < 12) {
      setError("令牌至少 12 位。");
      return;
    }
    window.localStorage.setItem(TOKEN_KEY, value);
    setToken(value);
    setTokenInput("");
    setError("");
  }

  function signOut() {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setRoles([]);
    setMessage("");
    setError("");
  }

  async function handleCreate() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const skills = form.skills
        .split(/\n|、|,|，/)
        .map((item) => item.trim())
        .filter(Boolean);

      const response = await authorizedFetch("/api/admin/roles", {
        method: "POST",
        body: JSON.stringify({
          label: form.label,
          category: form.category,
          description: form.description,
          skills,
          sortOrder: Number(form.sortOrder),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "新增失败");

      setMessage(
        `已新增岗位「${data.role.label}」，标识 ${data.role.key}。现在可以到「岗位追问链」页面选择它。`
      );
      setForm({ ...EMPTY_FORM });
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增岗位失败");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(role: AdminRole) {
    if (!role.id) return;
    setBusy(true);
    setError("");
    try {
      const response = await authorizedFetch(`/api/admin/roles/${role.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !role.enabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "更新失败");
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败");
    } finally {
      setBusy(false);
    }
  }

  async function removeRole(role: AdminRole) {
    if (!role.id) return;
    if (!window.confirm(`确定删除岗位「${role.label}」？\n\n已产生的历史面试记录不受影响。`)) return;

    setBusy(true);
    setError("");
    try {
      const response = await authorizedFetch(`/api/admin/roles/${role.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "删除失败");
      setMessage(`已删除岗位「${role.label}」。`);
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  // ---------- 未登录：令牌输入 ----------
  if (!token) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <Card>
          <CardHeader>
            <KeyRound className="mb-2 h-8 w-8 text-primary" />
            <CardTitle>岗位管理</CardTitle>
            <CardDescription>
              输入管理员令牌（环境变量 <code>ADMIN_TOKEN</code> 的值）。令牌只保存在本机浏览器，不会上传。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="password"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveToken();
              }}
              placeholder="管理员令牌"
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <Button className="w-full" onClick={saveToken}>
              进入管理端
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const customRoles = roles.filter((role) => role.source === "admin");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">岗位管理</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            录入新岗位的元信息（名称、描述、技能要求）。面试侧重点与追问链由 AI
            按描述实时生成，<strong className="font-medium text-foreground">不需要手写题库</strong>。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadRoles()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            刷新
          </Button>
          <Button variant="outline" onClick={signOut}>
            退出
          </Button>
        </div>
      </div>

      {message ? (
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{message}</span>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <Plus className="mb-2 h-8 w-8 text-primary" />
          <CardTitle>新增岗位</CardTitle>
          <CardDescription>
            岗位描述越具体，AI 生成的面试内容越贴切 —— 建议写清「做什么、服务谁、日常任务、具备什么能力」
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="role-label">
                岗位名称 <span className="text-destructive">*</span>
              </label>
              <input
                id="role-label"
                value={form.label}
                onChange={(event) => setForm({ ...form, label: event.target.value })}
                placeholder="例如：跨境电商运营专员"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="role-category">
                岗位分类（可选）
              </label>
              <input
                id="role-category"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                placeholder="例如：运营 / 金融 / 职能"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="role-description">
              岗位描述 <span className="text-destructive">*</span>
              <span className="ml-2 text-xs font-normal text-muted-foreground">至少 20 字</span>
            </label>
            <textarea
              id="role-description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="这个岗位做什么、服务谁、日常任务是什么、需要具备哪些能力…"
              className="min-h-28 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus-visible:border-ring"
            />
            <p className="text-xs text-muted-foreground">
              当前 {form.description.trim().length} 字
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="role-skills">
              技能要求 <span className="text-destructive">*</span>
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                每行一项，或用「、」分隔；1-20 项
              </span>
            </label>
            <textarea
              id="role-skills"
              value={form.skills}
              onChange={(event) => setForm({ ...form, skills: event.target.value })}
              placeholder={"选品与市场分析\n平台规则与合规\n投放与数据分析\n跨部门沟通"}
              className="min-h-28 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus-visible:border-ring"
            />
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="role-sort">
                排序（越小越靠前）
              </label>
              <input
                id="role-sort"
                type="number"
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
                className="h-9 w-32 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
              />
            </div>
            <Button onClick={handleCreate} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              新增岗位
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>已录入的自定义岗位（{customRoles.length}）</CardTitle>
          <CardDescription>
            内置的 8 个岗位由代码提供，不在此列表中。停用后不会出现在前台下拉里，但历史数据保留。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {customRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有自定义岗位。</p>
          ) : null}

          {customRoles.map((role) => (
            <div key={role.id ?? role.key} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{role.label}</span>
                    {role.category ? (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {role.category}
                      </span>
                    ) : null}
                    <span
                      className={
                        role.enabled
                          ? "rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          : "rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      }
                    >
                      {role.enabled ? "已启用" : "已停用"}
                    </span>
                    <span className="text-xs text-muted-foreground">key: {role.key}</span>
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {role.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    技能：{role.skills.join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => void toggleEnabled(role)} disabled={busy}>
                    {role.enabled ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {role.enabled ? "停用" : "启用"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void removeRole(role)} disabled={busy}>
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs leading-6 text-muted-foreground">
        说明：自定义岗位暂无人工整理的离线追问链。配置 AI 密钥时可生成贴合该岗位的定制追问；
        否则会按岗位技能要求生成通用追问，并在页面上明确提示。
      </p>
    </div>
  );
}
