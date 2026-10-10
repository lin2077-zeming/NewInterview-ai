import type { CareerDiagnosis, LearningPath, ParsedResume, SkillGap } from "@/types";

export const CAREER_ANALYSIS_HISTORY_KEY = "zhijing-opc-career-analysis-history";
const MAX_HISTORY_ITEMS = 5;

export interface SavedCareerAnalysis {
  id: string;
  createdAt: string;
  fileName: string;
  targetRole: string;
  source: "ai" | "fallback";
  resume: ParsedResume;
  diagnosis: CareerDiagnosis;
  gap: SkillGap;
  path: LearningPath;
}

export function loadCareerAnalysisHistory() {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(CAREER_ANALYSIS_HISTORY_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedCareerAnalysis[]) : [];
  } catch {
    return [];
  }
}

export function getLatestCareerAnalysis() {
  return loadCareerAnalysisHistory()[0] ?? null;
}

export function saveCareerAnalysis(analysis: Omit<SavedCareerAnalysis, "id" | "createdAt">) {
  const item: SavedCareerAnalysis = {
    ...analysis,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const nextHistory = [item, ...loadCareerAnalysisHistory()].slice(0, MAX_HISTORY_ITEMS);
  window.localStorage.setItem(CAREER_ANALYSIS_HISTORY_KEY, JSON.stringify(nextHistory));
  return item;
}

export function clearCareerAnalysisHistory() {
  window.localStorage.removeItem(CAREER_ANALYSIS_HISTORY_KEY);
}
