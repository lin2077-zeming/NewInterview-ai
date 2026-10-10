import type { CareerUserProfile } from "@/types";

const INTERVIEW_CONTEXT_KEY_PREFIX = "zhijing-opc-interview-context";
const MAX_RESUME_TEXT_LENGTH = 8000;

export interface InterviewLocalContext {
  candidateProfileSummary?: string;
  resumeSummary?: string;
  resumeFileName?: string;
  savedAt: string;
}

export function saveInterviewContext(
  interviewId: string,
  context: Omit<InterviewLocalContext, "savedAt">
) {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(
    getInterviewContextKey(interviewId),
    JSON.stringify({
      ...context,
      savedAt: new Date().toISOString(),
    })
  );
}

export function loadInterviewContext(interviewId: string): InterviewLocalContext | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(getInterviewContextKey(interviewId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as InterviewLocalContext;
  } catch {
    return null;
  }
}

export async function buildResumeSummaryFromFile(file: File | null) {
  if (!file) {
    return undefined;
  }

  const readable =
    file.type.startsWith("text/") ||
    /\.(txt|md|markdown|csv|json)$/i.test(file.name);

  if (!readable) {
    return `用户上传了简历文件「${file.name}」，但当前环境只能读取 txt、md 等纯文本文件。可在面试中要求候选人补充项目、经历和技能细节。`;
  }

  const rawText = (await file.text()).trim();
  if (!rawText) {
    return `用户上传了简历文件「${file.name}」，但文件内容为空。`;
  }

  return [
    `简历文件：${file.name}`,
    "简历原文节选：",
    rawText.slice(0, MAX_RESUME_TEXT_LENGTH),
  ].join("\n");
}

export function buildCandidateProfileSummary(profile: CareerUserProfile) {
  const rows = [
    ["教育阶段", profile.educationStage],
    ["专业背景", profile.major],
    ["经验水平", profile.experienceLevel],
    ["当前状态", profile.currentStatus],
    ["目标周期", profile.targetTimeline],
    ["目标城市", profile.targetCity],
    ["求职偏好", profile.preference],
    ["每日可投入时间", profile.dailyStudyTime],
    ["自认为优势", profile.selfRatedStrengths],
    ["当前最大困惑/痛点", profile.painPoints],
    ["现实限制", profile.constraints],
  ].filter(([, value]) => value && value.trim());

  if (rows.length === 0) {
    return undefined;
  }

  return rows.map(([label, value]) => `- ${label}：${value}`).join("\n");
}

function getInterviewContextKey(interviewId: string) {
  return `${INTERVIEW_CONTEXT_KEY_PREFIX}:${interviewId}`;
}
