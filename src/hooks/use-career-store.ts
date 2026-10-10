"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  UserProfile,
  CareerRecommendations,
  LearningRoadmap,
  LearningResources,
  AppStep,
} from "@//types/student";

interface CareerState {
  step: AppStep;
  profile: UserProfile;
  careerRecommendations: CareerRecommendations | null;
  selectedCareer: string | null;
  roadmap: LearningRoadmap | null;
  resources: LearningResources | null;
  completedMilestones: Record<number, number[]>;
  completedPhases: number[];
  loadingGenerate: boolean;
  loadingRoadmap: boolean;
  loadingResources: boolean;
  generatingCareer: string | null;
}

const STORAGE_KEY = "career-planner-state";

const initialState: CareerState = {
  step: "profile",
  profile: {
    major: "",
    interests: [],
    skills: "",
    expectation: "",
    grade: "",
  },
  careerRecommendations: null,
  selectedCareer: null,
  roadmap: null,
  resources: null,
  completedMilestones: {},
  completedPhases: [],
  loadingGenerate: false,
  loadingRoadmap: false,
  loadingResources: false,
  generatingCareer: null,
};

function loadState(): CareerState {
  if (typeof window === "undefined") return initialState;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as CareerState;
      return { ...initialState, ...parsed };
    }
  } catch {
    // ignore parse errors
  }
  return initialState;
}

function saveState(state: CareerState) {
  if (typeof window === "undefined") return;
  try {
    // Don't persist loading states - they are runtime-only
    const { loadingGenerate, loadingRoadmap, loadingResources, generatingCareer, ...persistable } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  } catch {
    // ignore storage errors
  }
}

export function useCareerStore() {
  const [state, setState] = useState<CareerState>(initialState);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loaded = loadState();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loaded);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      saveState(state);
    }
  }, [state, isLoaded]);

  const setStep = useCallback((step: AppStep) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const setProfile = useCallback((profile: UserProfile) => {
    setState((prev) => ({ ...prev, profile }));
  }, []);

  const setCareerRecommendations = useCallback(
    (recommendations: CareerRecommendations) => {
      setState((prev) => ({ ...prev, careerRecommendations: recommendations }));
    },
    []
  );

  const selectCareer = useCallback((career: string) => {
    setState((prev) => ({
      ...prev,
      selectedCareer: career,
      roadmap: null,
      resources: null,
    }));
  }, []);

  const setRoadmap = useCallback((roadmap: LearningRoadmap) => {
    setState((prev) => {
      const completedMilestones: Record<number, number[]> = {};
      const completedPhases: number[] = [];
      roadmap.phases.forEach((phase) => {
        completedMilestones[phase.phase] = [];
      });
      return { ...prev, roadmap, completedMilestones, completedPhases };
    });
  }, []);

  const setResources = useCallback((resources: LearningResources) => {
    setState((prev) => ({ ...prev, resources }));
  }, []);

  const toggleMilestone = useCallback(
    (phaseIndex: number, milestoneIndex: number) => {
      setState((prev) => {
        const current = prev.completedMilestones[phaseIndex] || [];
        const updated = current.includes(milestoneIndex)
          ? current.filter((i: number) => i !== milestoneIndex)
          : [...current, milestoneIndex];
        return {
          ...prev,
          completedMilestones: {
            ...prev.completedMilestones,
            [phaseIndex]: updated,
          },
        };
      });
    },
    []
  );

  const togglePhase = useCallback((phaseIndex: number) => {
    setState((prev) => {
      const current = prev.completedPhases;
      const updated = current.includes(phaseIndex)
        ? current.filter((i: number) => i !== phaseIndex)
        : [...current, phaseIndex];
      return { ...prev, completedPhases: updated };
    });
  }, []);

  const resetAll = useCallback(() => {
    setState(initialState);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const setLoadingGenerate = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loadingGenerate: loading }));
  }, []);

  const setLoadingRoadmap = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loadingRoadmap: loading }));
  }, []);

  const setLoadingResources = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loadingResources: loading }));
  }, []);

  const setGeneratingCareer = useCallback((career: string | null) => {
    setState((prev) => ({ ...prev, generatingCareer: career }));
  }, []);

  return {
    state,
    isLoaded,
    setStep,
    setProfile,
    setCareerRecommendations,
    selectCareer,
    setRoadmap,
    setResources,
    toggleMilestone,
    togglePhase,
    resetAll,
    setLoadingGenerate,
    setLoadingRoadmap,
    setLoadingResources,
    setGeneratingCareer,
  };
}
