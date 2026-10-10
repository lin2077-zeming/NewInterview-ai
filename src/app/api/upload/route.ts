import { NextResponse } from "next/server";
import { ResumeParseError, parseResumeFile } from "@/lib/parsers";

// 解析 PDF / DOCX 依赖 Node 能力，显式声明运行时
export const runtime = "nodejs";

/**
 * 简历上传解析。
 *
 * 接收 multipart/form-data，字段名 `file`。
 * 按类型分流解析（PDF / DOCX / TXT / MD），返回归一化后的纯文本与解析元信息。
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "未收到文件，请重新选择简历。" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const parsed = await parseResumeFile({
      buffer,
      fileName: file.name || "resume",
      fileSize: buffer.byteLength,
      mimeType: file.type,
    });

    return NextResponse.json({
      rawText: parsed.text,
      fileName: parsed.fileName,
      fileSize: parsed.fileSize,
      fileType: parsed.kind,
      pages: parsed.pages,
      warnings: parsed.warnings,
    });
  } catch (error) {
    if (error instanceof ResumeParseError) {
      const status =
        error.code === "FILE_TOO_LARGE"
          ? 413
          : error.code === "UNSUPPORTED_TYPE" || error.code === "LEGACY_DOC"
            ? 415
            : 422;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    console.error("[upload] 简历解析异常:", error);
    return NextResponse.json({ error: "简历解析失败，请稍后重试。" }, { status: 500 });
  }
}
