import { createStreamResponse } from "@/lib/ai/sse-stream";

export async function POST(request: Request) {
  const { career, skills, phaseName } = await request.json();

  if (!career) {
    return new Response(
      JSON.stringify({ error: "请提供目标职业" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const systemPrompt = `你是一位计算机领域的学习资源推荐专家。你需要为计算机专业学生推荐高质量的学习资源。

请严格按照以下 JSON 格式返回结果（不要添加任何 markdown 格式标记，直接返回纯 JSON）：
{
  "resources": {
    "books": [
      {
        "title": "书名",
        "author": "作者",
        "description": "推荐理由（1-2句话）",
        "difficulty": "入门/进阶/高级",
        "category": "分类"
      }
    ],
    "articles": [
      {
        "title": "文章标题",
        "source": "来源平台（如知乎、掘金、CSDN等）",
        "description": "推荐理由",
        "difficulty": "入门/进阶/高级"
      }
    ],
    "videos": [
      {
        "title": "视频/课程标题",
        "platform": "平台（如B站、慕课网等）",
        "description": "推荐理由",
        "difficulty": "入门/进阶/高级"
      }
    ],
    "tools": [
      {
        "name": "工具的常用英文名称（必填，如LeetCode、VS Code、Docker）",
        "description": "用途说明",
        "category": "分类",
        "url": "工具官网链接"
      }
    ]
  }
}

要求：
1. 每类资源推荐3-5个，确保质量
2. 资源要覆盖入门到高级不同层次
3. 优先推荐中文可访问的资源
4. 视频资源的platform字段统一填写"B站"，所有视频推荐均基于B站平台
5. 书籍需是业界公认的经典
6. 工具推荐当下最常用的开发工具，name字段必须填写工具的常用英文名称（如"LeetCode"、"VS Code"、"Docker"），绝不能留空或为null；url必须填写工具的官方网址，这是必填字段，绝不能留空
7. 文章和视频不需要填写url字段，只需提供准确的标题和来源平台即可
8. 文章的source字段应注明原始来源平台（如知乎、掘金、CSDN、博客园等），方便用户搜索时定位`;

  return createStreamResponse({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `我的目标职业：${career}
我目前已掌握的技能：${skills || "基础编程能力"}
${phaseName ? `我当前处于学习路线的"${phaseName}"阶段` : "请推荐完整的学习资源"}

请为我推荐系统化的学习资源。`,
      },
    ],
    temperature: 0.7,
  });
}
