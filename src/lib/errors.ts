/**
 * 业务错误类型。
 *
 * 单独成模块：`src/lib/ai/actions.ts` 是 `"use server"` 文件，
 * 只允许导出 async 函数，不能导出类。
 */

/** 归属校验失败时统一抛这个，调用方转成 404 —— 不泄露"存在但不属于你" */
export class NotFoundError extends Error {
  constructor(message = "内容不存在或无权访问。") {
    super(message);
    this.name = "NotFoundError";
  }
}
