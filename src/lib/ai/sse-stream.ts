import { streamText } from "ai";
import { analysisModel } from "@/lib/ai/client";

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface SSEMessage {
  messages: LLMMessage[];
  temperature?: number;
}

export function createStreamResponse({ messages, temperature = 0.7 }: SSEMessage): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = streamText({
          model: analysisModel,
          messages,
          temperature,
        });

        for await (const chunk of result.fullStream) {
          if (chunk.type === "text-delta") {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: chunk.text })}\n\n`)
            );
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI 生成失败";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
