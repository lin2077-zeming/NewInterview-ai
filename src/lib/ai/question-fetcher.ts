import type { InterviewQuestion } from "@/config/interview-questions";

let remoteQuestions: InterviewQuestion[] | null = null;

export async function getRemoteQuestions(): Promise<InterviewQuestion[]> {
  if (remoteQuestions) return remoteQuestions;

  remoteQuestions = [];

  try {
    const mod = (await import("@/config/interview-questions-remote.json")) as
      | { default: InterviewQuestion[] }
      | InterviewQuestion[];
    const data = Array.isArray(mod) ? mod : mod.default;
    if (Array.isArray(data) && data.length > 0) {
      remoteQuestions = data;
      console.log(`[question-fetcher] 本地题库加载成功: ${data.length} 题`);
    }
  } catch {
    console.warn("[question-fetcher] 未找到本地题库文件，使用内置 48 题");
  }

  if (remoteQuestions.length === 0) {
    const envUrl = process.env.INTERVIEW_QUESTIONS_URL;
    if (envUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const resp = await fetch(envUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (resp.ok) {
          const json = await resp.json();
          if (Array.isArray(json)) {
            remoteQuestions = json;
            console.log(`[question-fetcher] 远程题库加载成功: ${json.length} 题`);
          }
        }
      } catch (err) {
        console.warn("[question-fetcher] 远程题库拉取失败:", err instanceof Error ? err.message : err);
      }
    }
  }

  return remoteQuestions;
}
