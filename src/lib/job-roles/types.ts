import type { InterviewQuestion } from "@/config/interview-questions";

/**
 * 岗位体系的数据类型。
 *
 * 设计取舍：**岗位数据从代码搬到 JSON**。
 * 原先 8 个岗位硬编码在 `config/question-chains.ts`，新增一个岗位要改代码 + 发版，
 * 而且 `ROLE_LABELS` 在 4 个文件里各存一份、已经开始分叉。
 * 现在改为「一个子类一个文件」，好处是：内容可独立更新、diff 可读、可远程热更。
 *
 * 分类按**就业方向**而非学科门类 —— 用户选的是岗位，不是学位。
 */

/** 子类完整标识：`<categoryId>.<subId>`，入库后不可修改（历史面试记录依赖它） */
export type RoleId = string;

/**
 * 内容来源。
 *
 * **这不是可选字段**：赛事《合规与安全总则》要求使用外部数据须说明来源。
 * 无源内容一律不收录（校验脚本会拦）。AI 生成的必须自报家门，
 * 不得冒充真实面经 —— 这是底线，不是格式要求。
 */
export interface SourceRef {
  type:
    | "public-bank"
    | "company-jd"
    | "official"
    | "public-post"
    /** 项目自建内容（含项目内置题），非外部采集 */
    | "project-authored"
    | "ai-generated";
  /** 来源名称，如「力扣」「牛客」「公司官网」 */
  name: string;
  /** 可核验的链接；`ai-generated` 可为空 */
  url?: string;
  /** 采集日期（ISO），便于判断内容时效 */
  collectedAt?: string;
}

// ==================== 追问链 ====================

export interface Probe {
  /** 追问问题 */
  q: string;
  /** 及格线：答到什么程度算过关 */
  bar: string;
  /** 危险信号：出现这些说明不合格 */
  red: string;
}

export interface RoleDimension {
  name: string;
  /** 为什么要考这个维度 */
  why: string;
  weight: "高" | "中" | "低";
  probes: [Probe, Probe, Probe];
}

// ==================== 题目 / 公司 / 面经 ====================

/** 复用既有题目结构，额外要求来源可溯源 */
export interface RoleQuestion extends InterviewQuestion {
  source: SourceRef;
}

export interface RoleCompany {
  name: string;
  /** 招聘风格 / 关注点 */
  hiringStyle: string;
  /** 典型流程，如 ["简历筛选", "笔试", "技术一面", "HR 面"] */
  stages: string[];
  source: SourceRef;
}

export interface InterviewReport {
  source: SourceRef;
  /** 面经要点摘要 */
  summary: string;
}

// ==================== 子类内容文件 ====================

/** 一个子类一个 JSON 文件：`data/roles/<categoryId>/<subId>.json` */
export interface RoleContent {
  /** 必须等于 `<categoryId>.<subId>`，校验脚本会核对 */
  id: RoleId;
  categoryId: string;
  label: string;
  aliases?: string[];
  /** 一句话说明这个岗位做什么 */
  summary: string;
  /** 岗位描述：AI 生成面试内容的唯一依据，至少 20 字 */
  description: string;
  skills: string[];
  /** 追问链维度。完整内容档要求 4 个；骨架档可为空数组 */
  dimensions: RoleDimension[];
  questions: RoleQuestion[];
  companies: RoleCompany[];
  interviewReports: InterviewReport[];
  meta: {
    version: number;
    updatedAt: string;
    /** 内容成熟度：full = 题目/公司/面经齐备；skeleton = 仅元信息与维度 */
    completeness: "full" | "skeleton";
  };
}

// ==================== 分类索引 ====================

export interface TaxonomySubcategory {
  /** 大类内的短 id，如 `backend` */
  id: string;
  label: string;
  aliases?: string[];
}

export interface TaxonomyCategory {
  id: string;
  label: string;
  summary: string;
  subcategories: TaxonomySubcategory[];
}

export interface Taxonomy {
  version: number;
  updatedAt: string;
  categories: TaxonomyCategory[];
  contentPriority?: {
    note: string;
    fullContentCategories: string[];
  };
}

// ==================== 运行时视图 ====================

/**
 * 供 UI 使用的子类视图：分类索引 + 内容文件 + 覆盖层（管理员新增）三者合并的结果。
 * `hasContent` 决定「有没有离线兜底内容」，UI 据此提示用户。
 */
export interface RoleOptionView {
  id: RoleId;
  categoryId: string;
  categoryLabel: string;
  label: string;
  aliases: string[];
  skills: string[];
  description?: string;
  completeness: "full" | "skeleton" | "builtin";
  /** 是否有可用的离线内容（维度或题目） */
  hasOfflineContent: boolean;
  /** 是否来自管理员覆盖层（数据库） */
  isCustom: boolean;
}

export interface RoleCategoryView {
  id: string;
  label: string;
  summary: string;
  subcategories: RoleOptionView[];
}
