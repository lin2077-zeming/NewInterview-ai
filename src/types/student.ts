export interface UserProfile {
  major: string;
  interests: string[];
  skills: string;
  expectation: string;
  grade: string;
}

export interface CareerRecommendation {
  name: string;
  matchScore: number;
  description: string;
  salary: string;
  prospects: string;
  coreSkills: string[];
  difficulty: string;
  tags: string[];
}

export interface CareerRecommendations {
  careers: CareerRecommendation[];
  analysis: string;
}

export interface SkillItem {
  name: string;
  priority: string;
  description: string;
  learningMethods: string[];
}

export interface LearningPhase {
  phase: number;
  name: string;
  duration: string;
  description: string;
  goals: string[];
  skills: SkillItem[];
  milestones: string[];
  projects: string[];
  completed?: boolean;
  completedMilestones?: number[];
}

export interface LearningRoadmap {
  career: string;
  overview: string;
  totalDuration: string;
  phases: LearningPhase[];
  tips: string[];
}

export interface BookResource {
  title: string;
  author: string;
  description: string;
  difficulty: string;
  category: string;
}

export interface ArticleResource {
  title: string;
  source: string;
  description: string;
  difficulty: string;
  url: string;
}

export interface VideoResource {
  title: string;
  platform: string;
  description: string;
  difficulty: string;
  url: string;
}

export interface ToolResource {
  name: string;
  description: string;
  category: string;
  url?: string;
}

export interface LearningResources {
  books: BookResource[];
  articles: ArticleResource[];
  videos: VideoResource[];
  tools: ToolResource[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type AppStep = "profile" | "careers" | "roadmap" | "resources" | "progress";

export const MAJOR_OPTIONS = [
  "计算机科学与技术",
  "软件工程",
  "人工智能",
  "数据科学与大数据技术",
  "网络工程",
  "信息安全",
  "物联网工程",
  "数字媒体技术",
  "计算机系统与结构",
  "其他",
];

export const INTEREST_OPTIONS = [
  "前端开发",
  "后端开发",
  "全栈开发",
  "移动端开发",
  "人工智能/机器学习",
  "数据工程",
  "云计算/运维",
  "网络安全",
  "游戏开发",
  "嵌入式/物联网",
  "区块链",
  "产品设计",
  "技术管理",
  "算法研究",
  "自动驾驶",
  "音视频处理",
];

export const GRADE_OPTIONS = [
  "大一",
  "大二",
  "大三",
  "大四",
  "研究生",
  "已毕业",
];
