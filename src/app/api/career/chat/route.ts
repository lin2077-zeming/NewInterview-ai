import { createStreamResponse } from "@/lib/ai/sse-stream";

export async function POST(request: Request) {
  const { message, context } = await request.json();

  if (!message) {
    return new Response(
      JSON.stringify({ error: "请提供消息内容" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let systemPrompt = `你是一位资深的计算机行业职业规划顾问，名叫"职业导航AI"。你专注于为计算机专业的大学生提供职业规划建议。

你的职责：
1. 回答学生关于职业方向的疑问
2. 分析不同职业路径的优劣
3. 提供学习建议和技能提升方向
4. 帮助学生调整职业规划
5. 分享行业趋势和就业前景

回答风格：
- 专业但亲切，像一位经验丰富的学长
- 给出具体可执行的建议
- 不要重复追问用户已经提供过的信息（如年级、技能、专业等），直接基于已知信息给出建议
- 用简洁清晰的语言，避免过于冗长`;

  if (context) {
    systemPrompt += `\n\n当前学生的已知信息：${context}\n请基于以上已知信息回答，不要再询问已经提供的内容。`;
  }

  return createStreamResponse({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
    temperature: 0.8,
  });
}
