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

/** 岗位录入校验失败，调用方转成 400 并把原因回给用户 */
export class RoleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleValidationError";
  }
}

/** 管理员令牌缺失或错误 */
export class AdminAuthError extends Error {
  constructor(message = "管理员令牌无效。") {
    super(message);
    this.name = "AdminAuthError";
  }
}

/**
 * AI 不可用（未配置密钥 / 主动关闭）。
 *
 * 有了它，「降级」就不再是"等 AI 调用失败再说" —— 而是**提前判断、立刻走离线内容**。
 * 差别不只是更快：没配密钥时每次都要等一次网络失败，用户看到的是页面卡十几秒，
 * 而且日志里全是"调用失败"，真正的问题（就没配密钥）反而被淹没。
 */
export class AiUnavailableError extends Error {
  constructor(message = "当前为离线模式：未配置 AI 密钥，已改用离线内容。") {
    super(message);
    this.name = "AiUnavailableError";
  }
}
