import { z } from "zod";
import { tool } from "ai";
import { INTERVIEW_QUESTIONS, type InterviewQuestion } from "@/config/interview-questions";
import { getRemoteQuestions } from "@/lib/ai/question-fetcher";

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function searchQuestions(params: {
  stage: string;
  company?: string;
  difficulty?: string;
  tags?: string[];
  limit?: number;
}) {
  const remote = await getRemoteQuestions();
  let results: InterviewQuestion[] = [...INTERVIEW_QUESTIONS, ...remote];

  if (params.stage && params.stage !== "any") {
    results = results.filter((q) => q.stage === params.stage);
  }
  if (params.company) {
    results = results.filter((q) => !q.company || q.company.includes(params.company!));
  }
  if (params.difficulty) {
    results = results.filter((q) => q.difficulty === params.difficulty);
  }
  if (params.tags && params.tags.length > 0) {
    results = results.filter((q) =>
      params.tags!.some((t) => q.tags.some((qt) => qt.includes(t)))
    );
  }
  if (params.company) {
    const withCompany = shuffle(results.filter((q) => q.company));
    const withoutCompany = shuffle(results.filter((q) => !q.company));
    results = [...withCompany, ...withoutCompany];
  } else {
    results = shuffle(results);
  }

  return results.slice(0, params.limit ?? 5).map((q) => ({
    id: q.id,
    title: q.title,
    content: q.content,
    difficulty: q.difficulty,
    tags: q.tags,
    company: q.company || "通用",
  }));
}

export const advanceStageSchema = z.object({
  nextStage: z
    .enum(["algorithm", "project", "cross", "hr", "completed"])
    .describe("下一阶段，completed 表示面试结束"),
  summary: z.string().describe("当前阶段的简要总结"),
});

export const evaluateAnswerSchema = z.object({
  score: z.number().min(1).max(10).describe("1-10 分评分"),
  dimension: z
    .enum(["technical", "communication", "logic", "depth", "coding"])
    .describe("评分维度"),
  brief: z.string().describe("简短点评（一句话）"),
  suggestedAction: z
    .enum(["ask_code", "ask_approach", "dig_deeper", "move_on", "new_topic"])
    .describe(
      "建议下一步动作：ask_code=让候选人写代码, ask_approach=让候选人口述思路/伪代码, dig_deeper=追问同一题更深层, move_on=该题考察充分换下一题, new_topic=换不同方向的全新话题"
    ),
});

export const searchInterviewKnowledgeSchema = z.object({
  stage: z
    .enum(["algorithm", "project", "cross", "hr", "any"])
    .describe("面试阶段，'any' 表示不限制"),
  company: z.string().optional().describe("公司名称筛选，不传则返回所有公司"),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().describe("难度筛选"),
  tags: z.array(z.string()).optional().describe("知识点标签筛选"),
  limit: z.number().min(1).max(10).optional().describe("返回题目数量，默认5"),
});

export const interviewTools = {
  searchInterviewKnowledge: tool({
    description:
      "从海量真实面试题库中检索题目。在开始新面试或需要新题目时调用。返回题目标题、完整题目内容、难度、标签和来源公司。优先使用和当前公司匹配的题目。",
    inputSchema: searchInterviewKnowledgeSchema,
    execute: async (params) => {
      const questions = await searchQuestions(params);
      const total = (await searchQuestions({ ...params, limit: 99 })).length;
      return {
        questions,
        total,
        hint: "请从中选择 1-2 道最适合当前候选人的题目。出题时保持原题目核心，可结合候选人背景微调难度和措辞。",
      };
    },
  }),
  advanceStage: tool({
    description:
      "当当前阶段面试考察充分、可以结束时，调用此工具生成阶段总结。传入 nextStage 指定下一个阶段 ID，或传入 'completed' 表示整场面试结束。调用后会返回阶段总结信息，你可以在对话中告知候选人。",
    inputSchema: advanceStageSchema,
    execute: async ({ nextStage, summary }, { messages }) => {
      if (nextStage === "completed") {
        let evalCount = 0;
        for (const msg of messages) {
          if (msg.role !== "assistant") continue;
          const content = msg.content;
          if (typeof content === "string") continue;
          for (const part of content) {
            const p = part as { type: string; toolName?: string };
            if (p.type === "tool-call" && p.toolName === "evaluateAnswer") {
              evalCount++;
            }
          }
        }
        const MIN_EVALUATIONS = 5;
        if (evalCount < MIN_EVALUATIONS) {
          return {
            advanced: false,
            fromStage: "未推进",
            toStage: "未改变",
            summary,
            note: `⚠️ 当前至少需要完成 ${MIN_EVALUATIONS} 轮问答才能结束面试（目前已评估 ${evalCount} 题，还差 ${MIN_EVALUATIONS - evalCount} 题）。请继续提问或从题库选题深入考察。`,
          };
        }
      }
      return {
        advanced: true,
        fromStage: "已推进",
        toStage: nextStage,
        summary,
        note: nextStage === "completed"
          ? "整场面试已全部结束。请在对话中总结整场表现，并提示候选人点击【结束面试】按钮查看复盘报告。"
          : `本轮面试考察充分。请在对话中总结本轮表现，并提示候选人点击【结束面试】按钮查看本轮复盘。`,
      };
    },
  }),
  evaluateAnswer: tool({
    description:
      "在候选人回答完每个问题后，对该回答进行即时评分。每题必须调用一次。返回值包含评分结果和建议的下一步行动（suggestedAction）。你必须根据 suggestedAction 自主决定是写代码、问思路、深挖、换题还是换话题。",
    inputSchema: evaluateAnswerSchema,
    execute: async ({ score, dimension, brief, suggestedAction }) => ({
      score,
      dimension,
      evaluation: brief,
      suggestedAction,
      guidance: {
        ask_code: "让候选人用指定语言写出完整代码实现",
        ask_approach: "让候选人口述思路、伪代码或设计要点，暂不写代码",
        dig_deeper: "同一道题继续深挖——追问边界条件/底层原理/线上场景/复杂度优化",
        move_on: "此题已考察充分，从题库选一道和当前阶段匹配的新题继续面试",
        new_topic: "当前方向已覆盖，从题库选一道完全不同方向的新题拓宽面试广度",
      }[suggestedAction],
    }),
  }),
};
