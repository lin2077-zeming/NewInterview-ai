"use client";

import { useMemo, useState } from "react";
import { useRoleTaxonomy } from "@/hooks/use-role-taxonomy";

/**
 * 两级岗位选择器：先选一级大类，再选细分小类。
 *
 * 为什么必须两级：岗位从 8 个扩展到 64 个之后，塞进一个单级下拉是无法用的
 * （要在一屏里翻 64 项，且看不出彼此关系）。分两级后每屏最多 11 项，且能体现归类。
 *
 * `value` 的语义由 `valueMode` 决定：
 * - `"id"`（默认）：传子类 id，如 `cs-it.backend`
 * - `"label"`：传中文岗位名，如 `后端开发工程师`
 *   面试记录存的是中文名快照（改 key 不能让历史记录失联），所以两种都要支持。
 *
 * 外部传入初始值（URL 预填、上次选择）时，组件会自动反查所属大类并回填。
 */
export interface RolePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** 用于 label 的 htmlFor，避免同页多个选择器 id 冲突 */
  idPrefix?: string;
  className?: string;
  /** 允许不指定岗位（简历诊断用：不指定则按通用标准评判） */
  allowEmpty?: boolean;
  emptyLabel?: string;
  valueMode?: "id" | "label";
}

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-60";

export function RolePicker({
  value,
  onChange,
  disabled = false,
  idPrefix = "role",
  className = "",
  allowEmpty = false,
  emptyLabel = "不指定（按通用标准）",
  valueMode = "id",
}: RolePickerProps) {
  const { categories, loading, error, findCategoryIdOf, resolveRole } = useRoleTaxonomy();

  /**
   * 用户手动选的大类。
   *
   * 大类**不用 state 与 value 同步**（那需要在 effect 里 setState，会触发级联渲染）：
   * 而是「能从 value 推出来就用推导值，推不出来才用用户选的」。
   * - 外部传入 value（URL 预填、历史记录）→ 推导出所属大类
   * - 用户刚点开大类、还没选岗位（value 为空）→ 用用户选的大类
   */
  const [pickedCategoryId, setPickedCategoryId] = useState("");
  const inferredCategoryId = value ? findCategoryIdOf(value) : "";
  const categoryId = inferredCategoryId || pickedCategoryId;

  const currentCategory = useMemo(
    () => categories.find((category) => category.id === categoryId),
    [categories, categoryId]
  );

  const selected = resolveRole(value);
  /** 勾了「不指定」时，两个下拉都不可用 */
  const unspecified = allowEmpty && value === "" && categoryId === "";

  const optionValue = (role: { id: string; label: string }) =>
    valueMode === "label" ? role.label : role.id;

  return (
    <div className={`space-y-2 ${className}`}>
      {allowEmpty ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={value === ""}
            disabled={disabled}
            onChange={(event) => {
              if (event.target.checked) {
                onChange("");
                setPickedCategoryId("");
              }
            }}
            className="h-3.5 w-3.5"
          />
          {emptyLabel}
        </label>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            className="block text-xs font-medium text-muted-foreground"
            htmlFor={`${idPrefix}-category`}
          >
            一级大类
          </label>
          <select
            id={`${idPrefix}-category`}
            value={categoryId}
            disabled={disabled || loading || unspecified}
            onChange={(event) => {
              const next = event.target.value;
              setPickedCategoryId(next);
              // 换了大类就清空小类，避免留下不属于该大类的岗位
              onChange("");
            }}
            className={SELECT_CLASS}
          >
            <option value="">{loading ? "加载中…" : "请选择大类"}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}（{category.subcategories.length}）
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            className="block text-xs font-medium text-muted-foreground"
            htmlFor={`${idPrefix}-sub`}
          >
            细分岗位
          </label>
          <select
            id={`${idPrefix}-sub`}
            value={value}
            disabled={disabled || loading || unspecified || !categoryId}
            onChange={(event) => onChange(event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">{categoryId ? "请选择岗位" : "请先选择大类"}</option>
            {(currentCategory?.subcategories ?? []).map((role) => (
              <option key={role.id} value={optionValue(role)}>
                {role.label}
                {role.isCustom ? "（自定义）" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentCategory ? (
        <p className="text-xs leading-5 text-muted-foreground">{currentCategory.summary}</p>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {selected && !selected.hasOfflineContent ? (
        <p className="text-xs leading-5 text-muted-foreground">
          该岗位暂无人工整理的离线题库。配置 AI 密钥可获得贴合岗位的定制内容；
          否则将按岗位技能要求生成通用追问。
        </p>
      ) : null}
    </div>
  );
}
