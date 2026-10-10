// ========== 面试相关 ==========

export type InterviewMode = "normal" | "reversed";
export type InterviewStatus = "in_progress" | "completed" | "abandoned";
export type InterviewStage = "algorithm" | "project" | "cross" | "hr";

export interface InterviewConfig {
  role: string;
  company: string;
  mode: InterviewMode;
  stressMode: boolean;
  resumeId?: string;
  stageIndex?: number;
  candidateProfileSummary?: string;
  resumeSummary?: string;
}

export interface Interview {
  id: string;
  userId: string;
  resumeId?: string;
  role: string;
  companyType: string;
  mode: InterviewMode;
  stressMode: boolean;
  status: InterviewStatus;
  currentStage: InterviewStage;
  createdAt: Date;
}

export interface Message {
  id: string;
  interviewId: string;
  role: "interviewer" | "candidate" | "system";
  content: string;
  stage: InterviewStage;
  codeSnippet?: string;
  score?: number;
  feedback?: string;
  createdAt: Date;
}

// ========== 复盘相关 ==========

export interface DimensionScores {
  technical: number;
  communication: number;
  logic: number;
  depth: number;
  coding?: number;
}

export interface PerQuestionAnalysis {
  question: string;
  yourAnswer: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestedAnswer: string;
}

export interface StrengthPoint {
  point: string;
  example: string;
}

export interface WeaknessPoint {
  point: string;
  example: string;
  suggestion: string;
}

export interface ImprovementAction {
  area: string;
  action: string;
  resources: string[];
}

export interface ReviewReport {
  overallScore: number;
  passDecision: "strong_pass" | "pass" | "borderline" | "fail";
  passProbability: number;
  hiringVerdict: string;
  coreDiagnosis: string;
  dimensionScores: DimensionScores;
  perQuestionAnalysis: PerQuestionAnalysis[];
  top3Strengths: StrengthPoint[];
  top3Weaknesses: WeaknessPoint[];
  improvementPlan: ImprovementAction[];
}

// ========== 简历相关 ==========

export interface ParsedSkill {
  name: string;
  level: string;
  years: number;
}

export interface ParsedExperience {
  title: string;
  company: string;
  description: string;
  techStack: string[];
}

export interface ParsedResume {
  skills: ParsedSkill[];
  experience: ParsedExperience[];
  education: string;
  rawText: string;
}

// ========== 职业规划相关 ==========

export interface CareerUserProfile {
  educationStage: string;
  major: string;
  experienceLevel: string;
  currentStatus: string;
  targetTimeline: string;
  targetCity?: string;
  preference: string;
  dailyStudyTime: string;
  selfRatedStrengths: string;
  painPoints: string;
  constraints: string;
}

export interface SkillGap {
  currentSkills: string[];
  requiredSkills: string[];
  missingSkills: string[];
  matchRate: number;
}

export interface CareerDiagnosis {
  coreProblem: string;
  evidence: string[];
  blindSpots: string[];
  quickWins: string[];
  riskLevel: "low" | "medium" | "high";
}

export interface LearningResource {
  name: string;
  url: string;
  type: "course" | "book" | "project";
}

export interface LearningStep {
  order: number;
  title: string;
  description: string;
  resources: LearningResource[];
  estimatedDuration: string;
}

export interface LearningPath {
  id: string;
  userId: string;
  targetRole: string;
  gapAnalysis: SkillGap;
  steps: LearningStep[];
  createdAt: Date;
}

// ========== 大厂流程配置 ==========

export interface StageConfig {
  id: InterviewStage;
  name: string;
  duration: number;
  focus: string;
  topics: string;
}

export interface CompanyFlow {
  name: string;
  style: string;
  stages: StageConfig[];
  stressAvailable: InterviewStage[];
}
