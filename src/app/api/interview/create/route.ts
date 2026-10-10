import { NextResponse } from "next/server";
import { createInterview } from "@/lib/ai/actions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // 归属由服务端会话决定，不再接受客户端传入的 userId
    const { config } = body as { config: Parameters<typeof createInterview>[0] };

    if (!config || !config.role || !config.company) {
      return NextResponse.json(
        { error: "缺少必要参数：role, company" },
        { status: 400 }
      );
    }

    const result = await createInterview(config);
    return NextResponse.json(result);
  } catch (error) {
    console.error("创建面试失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建面试失败" },
      { status: 500 }
    );
  }
}
