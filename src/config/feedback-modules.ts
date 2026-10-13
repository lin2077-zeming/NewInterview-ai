/**
 * 试用反馈的场景清单。
 *
 * **单一数据源**：结果页的快捷反馈条与完整反馈表单都从这里取。
 *
 * 为什么要抽出来：原先表单里自己写了一份数组，结果新增「求职规划」场景时
 * 忘了同步 —— 表单不认这个词，`?module=求职规划` 的预勾选**静默失效**，
 * 没有任何报错，只是不起作用。这类"两处各写一份"的清单迟早会分叉。
 *
 * 现在 `FeedbackPrompt` 的 `module` 属性就是这个联合类型，
 * 写错场景名会在编译期直接报错，而不是等到线上发现预勾选没生效。
 */

export const FEEDBACK_MODULES = [
  "简历诊断",
  "岗位追问链",
  "面试复盘",
  "求职规划",
  "题库练习",
  "AI 面试陪练",
] as const;

export type FeedbackModule = (typeof FEEDBACK_MODULES)[number];

/** 用于校验来自 URL 等外部输入的场景名 */
export function isFeedbackModule(value: string): value is FeedbackModule {
  return (FEEDBACK_MODULES as readonly string[]).includes(value);
}
