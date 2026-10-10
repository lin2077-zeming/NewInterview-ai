import type { ResumeFixCategory, ResumeFixSeverity } from "@/types";

/**
 * 修改清单的展示标签。
 *
 * 独立成模块且不引入任何服务端依赖，供服务端诊断逻辑与客户端组件共用。
 */

export const CATEGORY_LABELS: Record<ResumeFixCategory, string> = {
  quantify: "缺少量化",
  keyword: "缺岗位关键词",
  vague: "描述空泛",
  structure: "结构问题",
  wording: "表述用词",
  contact: "基本信息",
  consistency: "格式不统一",
  other: "其他",
};

export const SEVERITY_LABELS: Record<ResumeFixSeverity, string> = {
  high: "硬伤",
  medium: "明显减分",
  low: "打磨项",
};

export const SEVERITY_ORDER: Record<ResumeFixSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};
