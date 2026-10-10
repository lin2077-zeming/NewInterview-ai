import type { CareerUserProfile } from "@/types";

export const CAREER_PROFILE_STORAGE_KEY = "zhijing-opc-career-profile";

export const EMPTY_CAREER_PROFILE: CareerUserProfile = {
  educationStage: "",
  major: "",
  experienceLevel: "",
  currentStatus: "",
  targetTimeline: "",
  targetCity: "",
  preference: "",
  dailyStudyTime: "",
  selfRatedStrengths: "",
  painPoints: "",
  constraints: "",
};

export function isCareerProfileComplete(profile: CareerUserProfile | null | undefined) {
  if (!profile) return false;

  return Boolean(
    profile.educationStage &&
      profile.major.trim() &&
      profile.experienceLevel &&
      profile.currentStatus &&
      profile.targetTimeline &&
      profile.preference &&
      profile.dailyStudyTime &&
      profile.painPoints.trim()
  );
}

export function loadCareerProfile() {
  if (typeof window === "undefined") return EMPTY_CAREER_PROFILE;

  const raw = window.localStorage.getItem(CAREER_PROFILE_STORAGE_KEY);
  if (!raw) return EMPTY_CAREER_PROFILE;

  try {
    return {
      ...EMPTY_CAREER_PROFILE,
      ...(JSON.parse(raw) as Partial<CareerUserProfile>),
    };
  } catch {
    return EMPTY_CAREER_PROFILE;
  }
}

export function saveCareerProfile(profile: CareerUserProfile) {
  window.localStorage.setItem(CAREER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}
