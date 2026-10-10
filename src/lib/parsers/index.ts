import mammoth from "mammoth";
import { extractText } from "unpdf";

/**
 * 简历文档解析。
 *
 * 按文件类型分流，把 PDF / DOCX / 纯文本统一转成可分析的纯文本。
 * 解析失败时抛出 `ResumeParseError`，由调用方（上传接口）转换为用户可读的提示。
 */

export type ResumeFileKind = "pdf" | "docx" | "text" | "legacy-doc" | "unsupported";

/** 单个文件大小上限：5MB。简历正常在 1MB 以内，超出多为附件或异常文件。 */
export const MAX_RESUME_FILE_SIZE = 5 * 1024 * 1024;

/** 允许的扩展名（用于前端提示与后端校验保持一致） */
export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"] as const;

export type ResumeParseErrorCode =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "LEGACY_DOC"
  | "PARSE_FAILED"
  | "NO_TEXT";

export class ResumeParseError extends Error {
  readonly code: ResumeParseErrorCode;

  constructor(code: ResumeParseErrorCode, message: string) {
    super(message);
    this.name = "ResumeParseError";
    this.code = code;
  }
}

export interface ParsedResumeFile {
  /** 归一化后的纯文本 */
  text: string;
  /** 识别出的文件类型 */
  kind: ResumeFileKind;
  fileName: string;
  fileSize: number;
  /** PDF 页数，其他类型为 undefined */
  pages?: number;
  /** 非致命提示，例如"疑似扫描件" */
  warnings: string[];
}

/** 取扩展名（不含点，小写） */
export function getExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index === -1 ? "" : fileName.slice(index + 1).toLowerCase();
}

/**
 * 判断文件类型。
 * 扩展名存在时**以其为准**：不认识就直接判为不支持，避免被 MIME 兜底放行（例如 evil.exe 伪装成 text/plain）。
 * 仅当文件名没有扩展名时，才退回 MIME 判断。
 */
export function detectKind(fileName: string, mimeType?: string): ResumeFileKind {
  const ext = getExtension(fileName);

  if (ext) {
    if (ext === "pdf") return "pdf";
    if (ext === "docx") return "docx";
    if (ext === "doc") return "legacy-doc";
    if (ext === "txt" || ext === "md" || ext === "markdown") return "text";
    return "unsupported";
  }

  const mime = (mimeType ?? "").toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("officedocument.wordprocessingml")) return "docx";
  if (mime === "application/msword") return "legacy-doc";
  if (mime.startsWith("text/")) return "text";

  return "unsupported";
}

/** 统一换行、去掉控制字符、压缩多余空行 */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 文本里可视为"有内容"的字符数（排除空白） */
export function countReadableChars(text: string): number {
  return text.replace(/\s/g, "").length;
}

async function parsePdf(buffer: Buffer) {
  // mergePages: true 时 text 为合并后的单个字符串
  const { totalPages, text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  return { text, pages: totalPages };
}

async function parseDocx(buffer: Buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return { text: value, pages: undefined };
}

/**
 * 解析简历文件。
 *
 * @throws {ResumeParseError} 文件为空 / 过大 / 类型不支持 / 解析失败 / 未提取到文字
 */
export async function parseResumeFile(input: {
  buffer: Buffer;
  fileName: string;
  fileSize: number;
  mimeType?: string;
}): Promise<ParsedResumeFile> {
  const { buffer, fileName, fileSize, mimeType } = input;

  if (fileSize === 0) {
    throw new ResumeParseError("EMPTY_FILE", "文件是空的，请重新导出简历后再上传。");
  }

  if (fileSize > MAX_RESUME_FILE_SIZE) {
    const mb = (MAX_RESUME_FILE_SIZE / 1024 / 1024).toFixed(0);
    throw new ResumeParseError("FILE_TOO_LARGE", `文件超过 ${mb}MB 上限，请压缩或改用 PDF 版本。`);
  }

  const kind = detectKind(fileName, mimeType);

  if (kind === "unsupported") {
    throw new ResumeParseError(
      "UNSUPPORTED_TYPE",
      "暂不支持该文件格式。请上传 PDF、DOCX、TXT 或 MD 格式的简历。"
    );
  }

  if (kind === "legacy-doc") {
    throw new ResumeParseError(
      "LEGACY_DOC",
      "暂不支持旧版 .doc 格式。请用 Word 另存为 .docx 或 PDF 后再上传。"
    );
  }

  const warnings: string[] = [];
  let text = "";
  let pages: number | undefined;

  try {
    if (kind === "pdf") {
      const result = await parsePdf(buffer);
      text = result.text;
      pages = result.pages;
    } else if (kind === "docx") {
      const result = await parseDocx(buffer);
      text = result.text;
    } else {
      text = buffer.toString("utf-8");
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ResumeParseError(
      "PARSE_FAILED",
      `文件解析失败，可能是文件已损坏或加密。请重新导出后再试。（${reason.slice(0, 80)}）`
    );
  }

  const normalized = normalizeText(text);
  const readableChars = countReadableChars(normalized);

  // 可读字符过少：多为扫描件（图片型 PDF）或空文档
  if (readableChars < 80) {
    if (kind === "pdf") {
      throw new ResumeParseError(
        "NO_TEXT",
        "未能从这份 PDF 中提取到文字，它可能是扫描件或图片型 PDF。请上传可复制文字的 PDF，或改用 DOCX / TXT。"
      );
    }
    throw new ResumeParseError("NO_TEXT", "未能从文件中提取到有效文字，请确认简历内容不是纯图片。");
  }

  if (kind === "pdf" && pages !== undefined && pages > 0 && readableChars / pages < 120) {
    warnings.push("这份 PDF 每页文字偏少，可能是扫描件，解析结果可能不完整。");
  }

  return { text: normalized, kind, fileName, fileSize, pages, warnings };
}
