import { createStreamResponse } from "@/lib/ai/sse-stream";

export async function POST(request: Request) {
  const { major, interests, skills, expectation } = await request.json();

  if (!major || !interests) {
    return new Response(
      JSON.stringify({ error: "请提供专业方向和兴趣偏好" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const systemPrompt = `你是一位资深的计算机行业职业规划师，对中国互联网和科技行业有深刻理解。你需要根据学生的专业方向、兴趣偏好、现有技能和职业期望，推荐最适合的职业方向。

请严格按照以下 JSON 格式返回结果（不要添加任何 markdown 格式标记，直接返回纯 JSON）：
{
  "careers": [
    {
      "name": "职业名称",
      "matchScore": 95,
      "description": "职业简介（2-3句话）",
      "salary": "薪资范围",
      "prospects": "发展前景（2-3句话）",
      "coreSkills": ["技能1", "技能2", "技能3"],
      "difficulty": "入门难度（容易/中等/较难/困难）",
      "tags": ["标签1", "标签2"]
    }
  ],
  "analysis": "整体分析（2-3句话总结学生的优势和建议方向）"
}

要求：
1. 推荐3个最匹配的职业方向
2. matchScore 范围 60-100，需真实反映匹配程度
3. 职业需涵盖当下计算机领域热门方向（如AI/ML工程师、全栈开发、云计算、数据工程、安全、嵌入式、产品等）
4. 每个职业的 coreSkills 给出3-5个核心技能
5. 分析要结合学生实际情况给出有针对性的建议`;

  return createStreamResponse({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `我的专业方向：${major}
我的兴趣偏好：${interests}
我目前已掌握的技能：${skills || "暂无特别突出的技能"}
我的职业期望：${expectation || "希望找到发展前景好的方向"}

请根据我的情况推荐适合的计算机职业方向。`,
      },
    ],
    temperature: 0.7,
  });
}
