import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  type UIMessage,
} from "ai";
import { interviewModel } from "@/lib/ai/client";
import { interviewTools } from "@/lib/ai/interview-flow";
import { getInterviewerSystemPrompt } from "@/lib/ai/prompts/interviewer";
import { getIntervieweeSystemPrompt } from "@/lib/ai/prompts/interviewee";
import { COMPANY_FLOWS } from "@/config/interview-stages";
import { saveMessage, updateInterviewStage } from "@/lib/ai/actions";

const INIT_TRIGGER = "__INTERVIEW_START__";
const START_PROMPT = "请开始本轮面试，先向候选人提出第一个问题。";
type CandidateLevel = "初级" | "中级" | "高级";

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function toModelInputMessages(messages: UIMessage[]) {
  const isInitialRequest =
    messages.length === 1 && getMessageText(messages[0]) === INIT_TRIGGER;

  return messages.flatMap((message) => {
    const text = getMessageText(message);

    if (text === INIT_TRIGGER && !isInitialRequest) {
      return [];
    }

    const normalized =
      text === INIT_TRIGGER
        ? {
            ...message,
            parts: [{ type: "text" as const, text: START_PROMPT }],
          }
        : message;

    const { id, ...messageWithoutId } = normalized;
    void id;
    return [messageWithoutId];
  });
}

export async function POST(req: Request) {
  try {
    const { messages = [], config, mode, interviewId } = (await req.json()) as {
      messages?: UIMessage[];
      config: {
        company?: string;
        role?: string;
        currentStage?: number;
        candidateLevel?: CandidateLevel;
        stressMode?: boolean;
        resumeSummary?: string;
        candidateProfileSummary?: string;
      };
      mode: "normal" | "reversed";
      interviewId?: string;
    };

    const company = COMPANY_FLOWS[config?.company ?? "bytedance"] ?? COMPANY_FLOWS.bytedance;
    const currentStageIndex = config?.currentStage ?? 0;
    const stage = company.stages[currentStageIndex] ?? company.stages[0];

    if (!stage) {
      return Response.json({ error: "面试阶段配置不存在" }, { status: 400 });
    }

    if (interviewId) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === "user") {
        const contentStr = getMessageText(lastMsg);
        if (contentStr && contentStr !== INIT_TRIGGER) {
          try {
            await saveMessage({
              interviewId,
              role: mode === "reversed" ? "interviewer" : "candidate",
              content: contentStr,
              stage: stage.id,
            });
          } catch {
            // 外键约束等 DB 错误不阻断对话
          }
        }
      }
    }

    const systemPrompt =
      mode === "reversed"
        ? getIntervieweeSystemPrompt({
            company: company.name,
            role: config?.role ?? "",
            level: config?.candidateLevel ?? "中级",
          })
        : getInterviewerSystemPrompt({
            company: company.name,
            style: company.style,
            role: config?.role ?? "",
            stage: {
              name: stage.name,
              focus: stage.focus,
              topics: stage.topics,
              duration: stage.duration,
            },
            stressMode: config?.stressMode ?? false,
            resumeSummary: config?.resumeSummary,
            candidateProfileSummary: config?.candidateProfileSummary,
            currentStageIndex,
            totalStages: company.stages.length,
          });

    const tools = mode === "normal" ? interviewTools : undefined;
    const modelMessages = await convertToModelMessages(toModelInputMessages(messages), {
      tools,
      ignoreIncompleteToolCalls: true,
    });

    const result = streamText({
      model: interviewModel,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: mode === "normal" ? stepCountIs(5) : stepCountIs(1),
      onError: (event) => {
        console.error("[chat] stream error:", event.error);
      },
      onStepFinish: async (event) => {
        if (!interviewId || mode !== "normal") return;

        try {
          for (const toolCall of event.toolCalls) {
            const tc = toolCall as {
              toolName?: string;
              input?: Record<string, unknown>;
            };

            if (tc.toolName === "advanceStage" && tc.input) {
              const nextStage = tc.input.nextStage as string;
              const isCompleted = nextStage === "completed";
              await updateInterviewStage(
                interviewId,
                isCompleted ? stage.id : nextStage,
                isCompleted ? "completed" : undefined
              );
            }

            if (tc.toolName === "evaluateAnswer" && tc.input) {
              const { score, dimension, brief } = tc.input as {
                score: number;
                dimension: string;
                brief: string;
              };
              try {
                await saveMessage({
                  interviewId,
                  role: "system",
                  content: `[${dimension} 评分: ${score}/10] ${brief}`,
                  stage: stage.id,
                  score,
                  feedback: brief,
                });
              } catch {
                // DB 错误不阻断 Agent 推理
              }
            }
          }
        } catch (error) {
          console.error("[chat] onStepFinish error:", error);
        }
      },
      onFinish: async (event) => {
        if (!interviewId) return;

        try {
          const aiResponse = event.text;
          if (aiResponse) {
            try {
              await saveMessage({
                interviewId,
                role: mode === "reversed" ? "candidate" : "interviewer",
                content: aiResponse,
                stage: stage.id,
              });
            } catch {
              // DB 错误不阻断对话
            }
          }
        } catch (error) {
          console.error("[chat] onFinish error:", error);
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[chat] POST error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "AI 服务连接失败" },
      { status: 500 }
    );
  }
}
