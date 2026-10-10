import { NextResponse } from "next/server";
import { createInterview } from "@/lib/ai/actions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { config, userId } = body as {
      config: Parameters<typeof createInterview>[0];
      userId?: string;
    };

    if (!config || !config.role || !config.company) {
      return NextResponse.json(
        { error: "缺少必要参数：role, company" },
        { status: 400 }
      );
    }

    const result = await createInterview(config, userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("创建面试失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建面试失败" },
      { status: 500 }
    );
  }
}
