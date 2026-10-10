/**
 * 简历上传（客户端）。
 *
 * 统一走服务端 `/api/upload` 解析：PDF / DOCX 需要专用解析器，
 * 在浏览器里直接 `file.text()` 只会拿到二进制乱码。
 */

export interface UploadedResume {
  rawText: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  pages?: number;
  warnings: string[];
}

interface UploadErrorResponse {
  error?: string;
  code?: string;
}

export async function uploadResumeFile(file: File): Promise<UploadedResume> {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    response = await fetch("/api/upload", { method: "POST", body: formData });
  } catch {
    throw new Error("网络异常，简历上传失败，请检查网络后重试。");
  }

  const data = (await response.json().catch(() => null)) as
    | (Partial<UploadedResume> & UploadErrorResponse)
    | null;

  if (!response.ok) {
    throw new Error(data?.error || "简历解析失败，请稍后重试。");
  }

  if (!data?.rawText) {
    throw new Error("未能从文件中读取到简历文字，请换一份文件再试。");
  }

  return {
    rawText: data.rawText,
    fileName: data.fileName ?? file.name,
    fileSize: data.fileSize ?? file.size,
    fileType: data.fileType ?? "unknown",
    pages: data.pages,
    warnings: data.warnings ?? [],
  };
}
