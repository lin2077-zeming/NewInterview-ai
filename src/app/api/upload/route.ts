import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "未上传文件" }, { status: 400 });
    }

    const text = await file.text();

    // 简历文本先返回，后续在客户端调用 LLM 解析
    return NextResponse.json({
      rawText: text,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch {
    return NextResponse.json(
      { error: "文件处理失败" },
      { status: 500 }
    );
  }
}
