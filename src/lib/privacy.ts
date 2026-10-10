/**
 * 隐私处理。
 *
 * 存储前对直接身份标识做脱敏：这些信息对"简历诊断/面试复盘"没有任何分析价值，
 * 但一旦落库就是实打实的敏感数据，属于典型的不必要留存。
 */

const PATTERNS: Array<{ name: string; re: RegExp; mask: (match: string) => string }> = [
  {
    // 中国大陆手机号
    name: "phone",
    re: /(?<!\d)1[3-9]\d{9}(?!\d)/g,
    mask: (m) => `${m.slice(0, 3)}****${m.slice(7)}`,
  },
  {
    // 邮箱
    name: "email",
    re: /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g,
    mask: (_m) => {
      const domain = _m.split("@")[1];
      return `***@${domain}`;
    },
  },
  {
    // 18 位身份证
    name: "idCard",
    re: /(?<!\d)\d{17}[\dXx](?!\d)/g,
    mask: (m) => `${m.slice(0, 6)}********${m.slice(14)}`,
  },
];

/** 判断文本中是否含有直接身份标识 */
export function hasPii(text: string): boolean {
  return PATTERNS.some((pattern) => pattern.re.test(text));
}

/**
 * 对文本做 PII 脱敏。
 * 保留可读结构（只遮挡标识位），避免影响后续阅读与人工复核。
 */
export function maskPii(text: string): string {
  return PATTERNS.reduce((result, pattern) => {
    pattern.re.lastIndex = 0;
    return result.replace(pattern.re, (match) => pattern.mask(match));
  }, text);
}
