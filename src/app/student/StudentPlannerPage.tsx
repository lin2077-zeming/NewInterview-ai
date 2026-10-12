"use client";

import { useCareerStore } from "@/hooks/use-career-store";
import { StepIndicator } from "@/components/student/step-indicator";
import { ProfileForm } from "@/components/student/profile-form";
import { CareerRecommendationsView } from "@/components/student/career-recommendations";
import { LearningRoadmapView } from "@/components/student/learning-roadmap";
import { LearningResourcesView } from "@/components/student/learning-resources";
import { ProgressTracker } from "@/components/student/progress-tracker";
import { AiChat } from "@/components/student/ai-chat";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { AppStep, UserProfile, LearningRoadmap, LearningResources } from "@/types/student";
import { RotateCcw, MessageSquare } from "lucide-react";
import { useState } from "react";

export default function StudentPathPage() {
  const {
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
  } = useCareerStore();

  const [showChat, setShowChat] = useState(false);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  const disabledSteps: AppStep[] = [];
  const isProfileComplete = !!(state.profile.major && state.profile.interests.length > 0);
  if (!isProfileComplete) {
    disabledSteps.push("careers");
  }
  if (!state.careerRecommendations) {
    disabledSteps.push("roadmap", "resources", "progress");
  }
  if (!state.selectedCareer) {
    disabledSteps.push("roadmap");
  }
  if (!state.roadmap) {
    disabledSteps.push("resources", "progress");
  }
  const uniqueDisabled = [...new Set(disabledSteps)];

  const handleProfileSubmit = (profile: UserProfile) => {
    setProfile(profile);
    setStep("careers");
  };

  const handleCareerSelect = (career: string) => {
    selectCareer(career);
    setStep("roadmap");
  };

  const handleRoadmapLoaded = (roadmap: LearningRoadmap) => {
    setRoadmap(roadmap);
  };

  const handleResourcesLoaded = (resources: LearningResources) => {
    setResources(resources);
  };

  const handleResetProgress = () => {
    resetAll();
  };

  const chatContext = [
    state.profile.major && `专业：${state.profile.major}`,
    state.profile.grade && `年级：${state.profile.grade}`,
    state.profile.interests.length > 0 && `兴趣方向：${state.profile.interests.join("、")}`,
    state.profile.skills && `已掌握技能：${state.profile.skills}`,
    state.profile.expectation && `职业期望：${state.profile.expectation}`,
    state.selectedCareer && `当前目标职业：${state.selectedCareer}`,
  ].filter(Boolean).join("；");

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">

      {/* Step Indicator */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <StepIndicator
          currentStep={state.step}
          onStepClick={setStep}
          disabledSteps={uniqueDisabled}
        />
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 pb-12">
        <div className={`flex gap-6 ${showChat ? "" : "justify-center"}`}>
          <div className={`${showChat ? "flex-1 min-w-0" : "w-full max-w-3xl"}`}>
            {state.step === "profile" && (
              <ProfileForm
                onSubmit={handleProfileSubmit}
                initialProfile={state.profile}
              />
            )}

            {state.step === "careers" && (
              <CareerRecommendationsView
                profile={state.profile}
                onSelectCareer={handleCareerSelect}
                recommendations={state.careerRecommendations}
                onRecommendationsLoaded={setCareerRecommendations}
                isLoading={state.loadingGenerate}
                onSetLoading={setLoadingGenerate}
              />
            )}

            {state.step === "roadmap" && state.selectedCareer && (
              <LearningRoadmapView
                career={state.selectedCareer}
                profile={state.profile}
                roadmap={state.roadmap}
                onRoadmapLoaded={handleRoadmapLoaded}
                completedMilestones={state.completedMilestones}
                onToggleMilestone={toggleMilestone}
                isLoading={state.loadingRoadmap}
                onSetLoading={setLoadingRoadmap}
              />
            )}

            {state.step === "resources" && state.selectedCareer && (
              <LearningResourcesView
                career={state.selectedCareer}
                skills={state.profile.skills}
                resources={state.resources}
                onResourcesLoaded={handleResourcesLoaded}
                isLoading={state.loadingResources}
                onSetLoading={setLoadingResources}
              />
            )}

            {state.step === "progress" && state.roadmap && state.selectedCareer && (
              <ProgressTracker
                roadmap={state.roadmap}
                career={state.selectedCareer}
                resources={state.resources}
                completedMilestones={state.completedMilestones}
                completedPhases={state.completedPhases}
                onToggleMilestone={toggleMilestone}
                onTogglePhase={togglePhase}
                onReset={handleResetProgress}
              />
            )}

            {state.step !== "profile" && (
              <div className="flex justify-between mt-8 max-w-3xl mx-auto">
                <Button
                  variant="outline"
                  onClick={() => {
                    const steps: AppStep[] = ["profile", "careers", "roadmap", "resources", "progress"];
                    const currentIdx = steps.indexOf(state.step);
                    if (currentIdx > 0) setStep(steps[currentIdx - 1]);
                  }}
                >
                  上一步
                </Button>
                <Button
                  onClick={() => {
                    const steps: AppStep[] = ["profile", "careers", "roadmap", "resources", "progress"];
                    const currentIdx = steps.indexOf(state.step);
                    if (currentIdx < steps.length - 1 && !uniqueDisabled.includes(steps[currentIdx + 1])) {
                      setStep(steps[currentIdx + 1]);
                    }
                  }}
                  disabled={
                    (() => {
                      const steps: AppStep[] = ["profile", "careers", "roadmap", "resources", "progress"];
                      const currentIdx = steps.indexOf(state.step);
                      return currentIdx >= steps.length - 1 || uniqueDisabled.includes(steps[currentIdx + 1]);
                    })()
                  }
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  下一步
                </Button>
              </div>
            )}
          </div>

          {showChat && (
            <div className="w-80 shrink-0 hidden lg:block">
              <div className="sticky top-32">
                <AiChat context={chatContext} />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Buttons */}
      <div className={`fixed z-50 flex flex-col gap-3 items-end transition-all duration-300 ${showChat ? "bottom-[calc(70vh+1rem)] lg:bottom-6 right-6 lg:!right-[22rem]" : "bottom-6 right-6"}`}>
        <Button
          variant="outline"
          size="default"
          onClick={resetAll}
          className="gap-2 shadow-lg rounded-full px-5 bg-background/95 backdrop-blur-sm"
        >
          <RotateCcw className="w-5 h-5" />
          <span className="hidden sm:inline">重新开始</span>
        </Button>
        <Button
          size="default"
          onClick={() => setShowChat(!showChat)}
          className="gap-2 shadow-lg shadow-amber-500/25 rounded-full px-5 bg-amber-600 hover:bg-amber-700 text-white"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="hidden sm:inline">{showChat ? "关闭顾问" : "AI 顾问"}</span>
        </Button>
      </div>

      {showChat && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-background border-t rounded-t-xl shadow-lg max-h-[70vh] overflow-hidden">
          <div className="p-2 border-b flex items-center justify-between">
            <span className="text-sm font-medium px-2">AI 职业顾问</span>
            <Button variant="ghost" size="sm" onClick={() => setShowChat(false)}>
              收起
            </Button>
          </div>
          <div className="h-[calc(70vh-48px)]">
            <AiChat context={chatContext} />
          </div>
        </div>
      )}
    </div>
  );
}
