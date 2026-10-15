"use client";

import { useEffect, useState } from "react";

export interface RoleOption {
  id: string;
  categoryId: string;
  categoryLabel: string;
  label: string;
  aliases: string[];
  skills: string[];
  description?: string;
  completeness: "full" | "skeleton" | "builtin";
  /** 是否有离线兜底内容（人工维度或题库）；false 时无密钥只能用通用追问 */
  hasOfflineContent: boolean;
  isCustom: boolean;
}

export interface RoleCategory {
  id: string;
  label: string;
  summary: string;
  subcategories: RoleOption[];
}

/**
 * 旧的扁平岗位 key → 新体系子类 id。
 * 历史链接、URL 预填、本地缓存的追问链都可能带旧 key，这里做兼容映射。
 */
const LEGACY_KEY_MAP: Record<string, string> = {
  backend: "cs-it.backend",
  frontend: "cs-it.frontend",
  fullstack: "cs-it.fullstack",
  algorithm: "cs-it.algorithm",
  data: "cs-it.data-analysis",
  test: "cs-it.test-dev",
  ops: "cs-it.devops",
  product: "cs-it.product-manager",
};

export function normalizeRoleId(idOrLegacy: string): string {
  return LEGACY_KEY_MAP[idOrLegacy] ?? idOrLegacy;
}

/**
 * 模块级缓存与并发去重。
 *
 * 岗位体系在一次会话里是静态的，但 `/api/roles` 有约 90KB。
 * 同一页面里桌面与移动两套布局各挂一次本 hook，就会把 90KB 拉两遍；
 * 而且两个组件在**同一轮渲染**里挂载，各自的 effect 几乎同时执行，
 * 只靠"成功后写缓存"挡不住 —— 所以还要用进行中的 Promise 去重。
 */
let taxonomyCache: RoleCategory[] | null = null;
let taxonomyInFlight: Promise<RoleCategory[]> | null = null;

function loadTaxonomy(): Promise<RoleCategory[]> {
  if (taxonomyCache) return Promise.resolve(taxonomyCache);
  if (!taxonomyInFlight) {
    taxonomyInFlight = fetch("/api/roles", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "读取岗位列表失败");
        const next = (data.categories ?? []) as RoleCategory[];
        taxonomyCache = next;
        return next;
      })
      .catch((err) => {
        taxonomyInFlight = null; // 失败不缓存，允许下次重试
        throw err;
      });
  }
  return taxonomyInFlight;
}

/**
 * 拉取两级岗位分类（一级大类 → 细分小类）。
 *
 * 前端不再 import 岗位配置 —— 岗位数据源是 `data/roles/**`，
 * 经 `/api/roles` 提供，这样新增岗位不需要改前端代码。
 */
export function useRoleTaxonomy() {
  const [categories, setCategories] = useState<RoleCategory[]>(() => taxonomyCache ?? []);
  const [loading, setLoading] = useState(!taxonomyCache);
  const [error, setError] = useState("");

  useEffect(() => {
    // 已有缓存：useState 初始化时就已经取到了，这里直接不发请求
    //（也就不需要再 setState —— 那样反而会触发一次级联渲染）
    if (taxonomyCache) return;

    let cancelled = false;

    loadTaxonomy()
      .then((next) => {
        if (!cancelled) setCategories(next);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "读取岗位列表失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const allRoles = categories.flatMap((category) => category.subcategories);

  /**
   * 按子类 id **或** 中文岗位名匹配。
   *
   * 两种都要支持是因为历史数据不一致：追问链/简历诊断存的是 key，
   * 而面试记录存的是中文岗位名快照（改 key 不能让历史记录失联）。
   */
  function resolveRole(valueOrLabel: string): RoleOption | undefined {
    if (!valueOrLabel) return undefined;
    const normalized = normalizeRoleId(valueOrLabel);
    return (
      allRoles.find((role) => role.id === normalized) ??
      allRoles.find((role) => role.label === valueOrLabel)
    );
  }

  /** 反查所属大类（用于回填外部传入的初始值） */
  function findCategoryIdOf(valueOrLabel: string): string {
    return resolveRole(valueOrLabel)?.categoryId ?? "";
  }

  return { categories, allRoles, loading, error, findCategoryIdOf, resolveRole };
}
