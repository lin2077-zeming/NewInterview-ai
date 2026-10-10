import { createStreamResponse } from "@/lib/ai/sse-stream";

export async function POST(request: Request) {
  const { career, major, skills } = await request.json();

  if (!career) {
    return new Response(
      JSON.stringify({ error: "请提供目标职业" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const systemPrompt = `你是一位资深的计算机行业职业规划师和培训专家。你需要为计算机专业学生制定详细的学习路线图。

请严格按照以下 JSON 格式返回结果（不要添加任何 markdown 格式标记，直接返回纯 JSON）：
{
  "roadmap": {
    "career": "职业名称",
    "overview": "职业路线概述（2-3句话）",
    "totalDuration": "预计总时长",
    "phases": [
      {
        "phase": 1,
        "name": "阶段名称",
        "duration": "时长",
        "description": "阶段描述",
        "goals": ["目标1", "目标2"],
        "skills": [
          {
            "name": "技能名称",
            "priority": "高/中/低",
            "description": "技能说明",
            "learningMethods": ["学习方法1", "学习方法2"]
          }
        ],
        "milestones": ["里程碑1", "里程碑2"],
        "projects": ["实践项目1", "实践项目2"]
      }
    ],
    "tips": ["建议1", "建议2", "建议3"]
  }
}

要求：
1. 分4个阶段规划，从基础到进阶
2. 每阶段包含2-3个核心目标
3. 每阶段3-5个技能项，标注优先级
4. 每阶段提供2个实践项目建议
5. 结合学生现有基础调整起点
6. 阶段时长要合理，总时长6-24个月`;

  return createStreamResponse({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `我想要成为：${career}
我的专业方向：${major || "计算机科学与技术"}
我目前已掌握的技能：${skills || "基础编程能力"}

请为我制定详细的学习路线图。`,
      },
    ],
    temperature: 0.7,
  });
}
