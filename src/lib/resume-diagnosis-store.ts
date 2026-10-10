import type { ResumeDiagnosis } from "@/types";

export const RESUME_DIAGNOSIS_KEY = "zhijing-opc-resume-diagnosis";

export interface SavedResumeDiagnosis {
  diagnosis: ResumeDiagnosis;
  fileName?: string;
  /** 用户已勾选"已采纳"的建议 id —— 人工复核的留痕 */
  acceptedIds: string[];
  updatedAt: string;
}

export function loadResumeDiagnosis(): SavedResumeDiagnosis | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(RESUME_DIAGNOSIS_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SavedResumeDiagnosis;
    if (!parsed?.diagnosis?.fixes) return null;
    return { ...parsed, acceptedIds: parsed.acceptedIds ?? [] };
  } catch {
    return null;
  }
}

export function saveResumeDiagnosis(input: {
  diagnosis: ResumeDiagnosis;
  fileName?: string;
  targetRole?: string;
}): SavedResumeDiagnosis {
  const item: SavedResumeDiagnosis = {
    diagnosis: input.diagnosis,
    fileName: input.fileName,
    acceptedIds: [],
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(RESUME_DIAGNOSIS_KEY, JSON.stringify(item));
  return item;
}

export function setAcceptedFixes(ids: string[]): SavedResumeDiagnosis | null {
  const current = loadResumeDiagnosis();
  if (!current) return null;

  const next: SavedResumeDiagnosis = {
    ...current,
    acceptedIds: ids,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(RESUME_DIAGNOSIS_KEY, JSON.stringify(next));
  return next;
}

export function clearResumeDiagnosis() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(RESUME_DIAGNOSIS_KEY);
}
