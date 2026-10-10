import { generateText } from "ai";
import { NextResponse } from "next/server";
import { analysisModel } from "@/lib/ai/client";
import { getCareerAdvisorSystemPrompt } from "@/lib/ai/prompts/career-advisor";
import type { CareerDiagnosis, CareerUserProfile, LearningPath, ParsedResume, SkillGap } from "@/types";

const ROLE_REQUIREMENTS: Record<string, string[]> = {
  frontend: ["HTML", "CSS", "JavaScript", "TypeScript", "React", "Next.js", "工程化", "性能优化"],
  backend: ["Java", "Spring Boot", "MySQL", "Redis", "消息队列", "系统设计", "Linux", "Docker"],
  fullstack: ["TypeScript", "React", "Next.js", "Node.js", "数据库", "API 设计", "部署", "工程化"],
  algorithm: ["Python", "数据结构", "算法", "机器学习", "深度学习", "PyTorch", "SQL", "模型评估"],
  product: ["用户研究", "需求分析", "原型设计", "数据分析", "竞品分析", "项目管理", "沟通表达"],
};

const ROLE_LABELS: Record<string, string> = {
  frontend: "前端开发工程师",
  backend: "后端开发工程师",
  fullstack: "全栈开发工程师",
  algorithm: "算法工程师",
  product: "产品经理",
};

const SKILL_KEYWORDS = [
  "HTML",
  "CSS",
  "JavaScript",
  "TypeScript",
  "React",
  "Vue",
  "Next.js",
  "Node.js",
  "Java",
  "Spring Boot",
  "Python",
  "Go",
  "MySQL",
  "PostgreSQL",
  "Redis",
  "Docker",
  "Linux",
  "Git",
  "数据结构",
  "算法",
  "机器学习",
  "深度学习",
  "PyTorch",
  "SQL",
  "用户研究",
  "需求分析",
  "原型设计",
  "数据分析",
  "项目管理",
];

const RESUME_SIGNAL_KEYWORDS = [
  "简历",
  "教育",
  "学历",
  "本科",
  "硕士",
  "博士",
  "大学",
  "学院",
  "专业",
  "项目",
  "实习",
  "工作",
  "经历",
  "技能",
  "求职",
  "岗位",
  "公司",
  "负责",
  "开发",
  "邮箱",
  "电话",
  "手机",
  "github",
  "portfolio",
  "experience",
  "education",
  "project",
  "skill",
  "resume",
];

interface AnalyzeCareerRequest {
  rawText: string;
  targetRole: string;
  userProfile?: CareerUserProfile;
  fileName?: string;
}

interface AnalyzeCareerResponse {
  resume: ParsedResume;
  diagnosis: CareerDiagnosis;
  gap: SkillGap;
  path: LearningPath;
  source: "ai" | "fallback";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyzeCareerRequest;
    const rawText = body.rawText?.trim();
    const targetRole = body.targetRole || "frontend";
    const userProfile = body.userProfile;

    if (!rawText) {
      return NextResponse.json({ error: "简历内容为空，请上传可读取文本的简历" }, { status: 400 });
    }

    if (!isProfileComplete(userProfile)) {
      return NextResponse.json(
        { error: "请先完善个人信息，包括当前状态、目标周期、学习时间和主要困惑。" },
        { status: 400 }
      );
    }

    if (!isResumeLike(rawText)) {
      return NextResponse.json(
        { error: "这份文件不像简历，请上传包含教育经历、项目经历、技能栈或工作经历的简历文本。" },
        { status: 400 }
      );
    }

    const aiResult = await withTimeout(generateWithAI(rawText, targetRole, userProfile), 18000).catch(() => null);
    if (aiResult) {
      return NextResponse.json(aiResult);
    }

    return NextResponse.json(buildFallbackAnalysis(rawText, targetRole, userProfile));
  } catch {
    return NextResponse.json({ error: "职业规划分析失败" }, { status: 500 });
  }
}

async function generateWithAI(
  rawText: string,
  targetRole: string,
  userProfile: CareerUserProfile
): Promise<AnalyzeCareerResponse | null> {
  const roleName = ROLE_LABELS[targetRole] ?? targetRole;
  const { text } = await generateText({
    model: analysisModel,
    system: getCareerAdvisorSystemPrompt(),
    prompt: `请分析下面的简历，并面向目标岗位生成职业规划。

目标岗位：${roleName}

用户真实信息：
${formatUserProfile(userProfile)}

简历内容：
${rawText.slice(0, 6000)}

分析要求：
- 不要只复述简历优点，要找出用户当前状态与目标岗位之间最影响求职成功率的 1 个核心问题
- 必须结合用户自述痛点、可投入时间、目标周期、教育/专业背景和简历项目证据
- 如果简历写得漂亮但缺少量化结果、项目深度、岗位关键词或面试证据，要直接指出
- 学习路径要具体到优先级，不要泛泛列课程

请只返回 JSON，不要 Markdown，不要解释。结构如下：
{
  "diagnosis": {
    "coreProblem": "一句话指出最关键痛点",
    "evidence": ["来自简历或用户信息的证据"],
    "blindSpots": ["用户可能忽略的问题"],
    "quickWins": ["1-2周内能明显改善的动作"],
    "riskLevel": "low/medium/high"
  },
  "resume": {
    "skills": [{"name": "技能名", "level": "入门/熟悉/精通", "years": 0}],
    "experience": [{"title": "经历标题", "company": "组织或公司", "description": "经历说明", "techStack": ["技术"]}],
    "education": "教育经历摘要",
    "rawText": "简历摘要"
  },
  "gap": {
    "currentSkills": ["已具备技能"],
    "requiredSkills": ["目标岗位要求技能"],
    "missingSkills": ["缺口技能"],
    "matchRate": 0
  },
  "path": {
    "targetRole": "${roleName}",
    "steps": [
      {
        "order": 1,
        "title": "阶段标题",
        "description": "具体学习任务",
        "resources": [{"name": "资源名", "url": "https://example.com", "type": "course"}],
        "estimatedDuration": "2 周"
      }
    ]
  }
}`,
  });

  const parsed = parseJson(text);
  if (!parsed) return null;

  const resume = asRecord(parsed.resume);
  const diagnosisObject = asRecord(parsed.diagnosis);
  const path = asRecord(parsed.path);
  const fallback = buildFallbackAnalysis(rawText, targetRole, userProfile);
  const gap = normalizeGap(parsed.gap, targetRole, fallback.resume.skills.map((skill) => skill.name));
  const skills = Array.isArray(resume?.skills) ? resume.skills as ParsedResume["skills"] : fallback.resume.skills;
  const experience = Array.isArray(resume?.experience) ? resume.experience as ParsedResume["experience"] : fallback.resume.experience;
  const steps = Array.isArray(path?.steps) && path.steps.length > 0 ? path.steps as LearningPath["steps"] : fallback.path.steps;
  const diagnosis = normalizeDiagnosis(diagnosisObject, fallback.diagnosis);

  return {
    resume: {
      skills,
      experience,
      education: typeof resume?.education === "string" ? resume.education : fallback.resume.education,
      rawText: typeof resume?.rawText === "string" ? resume.rawText : rawText,
    },
    diagnosis,
    gap,
    path: {
      id: crypto.randomUUID(),
      userId: "demo-user",
      targetRole: typeof path?.targetRole === "string" ? path.targetRole : ROLE_LABELS[targetRole] ?? targetRole,
      gapAnalysis: gap,
      steps,
      createdAt: new Date(),
    },
    source: "ai",
  };
}

function buildFallbackAnalysis(
  rawText: string,
  targetRole: string,
  userProfile: CareerUserProfile
): AnalyzeCareerResponse {
  const roleName = ROLE_LABELS[targetRole] ?? targetRole;
  const currentSkills = extractSkills(rawText);
  const requiredSkills = ROLE_REQUIREMENTS[targetRole] ?? ROLE_REQUIREMENTS.frontend;
  const currentSet = new Set(currentSkills.map((skill) => skill.toLowerCase()));
  const missingSkills = requiredSkills.filter((skill) => !currentSet.has(skill.toLowerCase()));
  const matchRate = Math.round(((requiredSkills.length - missingSkills.length) / requiredSkills.length) * 100);
  const focusSkills = missingSkills.length > 0 ? missingSkills : requiredSkills.slice(0, 3);
  const gap = { currentSkills, requiredSkills, missingSkills, matchRate };

  return {
    resume: {
      skills: currentSkills.map((name) => ({ name, level: "熟悉", years: 1 })),
      experience: [
        {
          title: "简历项目经历",
          company: "个人/校园项目",
          description: rawText.slice(0, 160) || "已上传简历，建议补充项目背景、职责和量化结果。",
          techStack: currentSkills.slice(0, 6),
        },
      ],
      education: inferEducation(rawText),
      rawText,
    },
    diagnosis: {
      coreProblem: buildCoreProblem(userProfile, missingSkills, roleName),
      evidence: [
        `目标周期：${userProfile.targetTimeline}，每日可投入：${userProfile.dailyStudyTime}`,
        `自述痛点：${userProfile.painPoints}`,
        missingSkills.length > 0
          ? `岗位关键缺口集中在 ${missingSkills.slice(0, 4).join("、")}`
          : "简历技能覆盖较完整，下一步重点是证明项目深度和面试表达",
      ],
      blindSpots: [
        "简历只能证明做过什么，还需要补充结果指标、技术取舍和失败复盘",
        userProfile.constraints || "尚未明确时间、城市或资源限制，计划执行风险容易被低估",
      ],
      quickWins: [
        "把最核心项目改写为 STAR 结构，补充数据指标、技术难点和个人贡献",
        `优先补齐 ${focusSkills.slice(0, 2).join("、")}，并做一个可展示的小功能或案例`,
      ],
      riskLevel: missingSkills.length >= 4 || userProfile.targetTimeline.includes("1") ? "high" : "medium",
    },
    gap,
    path: {
      id: crypto.randomUUID(),
      userId: "demo-user",
      targetRole: roleName,
      gapAnalysis: gap,
      steps: [
        {
          order: 1,
          title: "补齐岗位核心基础",
          description: `集中补齐 ${focusSkills.slice(0, 3).join("、")}，每天完成小练习并整理笔记。`,
          resources: [
            { name: "MDN Web Docs / 官方文档", url: "https://developer.mozilla.org/", type: "course" },
            { name: "技术栈官方教程", url: "https://roadmap.sh/", type: "course" },
          ],
          estimatedDuration: "2 周",
        },
        {
          order: 2,
          title: "完成一个可展示项目",
          description: `围绕 ${roleName} 做一个端到端项目，把关键技术点写进 README 和简历。`,
          resources: [
            { name: "GitHub 项目实践", url: "https://github.com/", type: "project" },
            { name: "系统设计入门材料", url: "https://roadmap.sh/system-design", type: "course" },
          ],
          estimatedDuration: "3 周",
        },
        {
          order: 3,
          title: "面试冲刺与复盘",
          description: "按 STAR 法则重写项目介绍，准备高频题、追问题和量化成果。",
          resources: [
            { name: "Cracking the Coding Interview", url: "https://www.crackingthecodinginterview.com/", type: "book" },
            { name: "职镜 OPC 模拟面试", url: "/interview/new", type: "project" },
          ],
          estimatedDuration: "1-2 周",
        },
      ],
      createdAt: new Date(),
    },
    source: "fallback",
  };
}

function isProfileComplete(profile: CareerUserProfile | undefined): profile is CareerUserProfile {
  if (!profile) return false;
  const requiredFields: Array<keyof CareerUserProfile> = [
    "educationStage",
    "major",
    "experienceLevel",
    "currentStatus",
    "targetTimeline",
    "preference",
    "dailyStudyTime",
    "painPoints",
  ];

  return requiredFields.every((field) => Boolean(profile[field]?.trim()));
}

function formatUserProfile(profile: CareerUserProfile) {
  return [
    `教育阶段：${profile.educationStage}`,
    `专业背景：${profile.major}`,
    `经验水平：${profile.experienceLevel}`,
    `当前状态：${profile.currentStatus}`,
    `目标周期：${profile.targetTimeline}`,
    `目标城市：${profile.targetCity || "未限定"}`,
    `求职偏好：${profile.preference}`,
    `每日可投入学习时间：${profile.dailyStudyTime}`,
    `自认为优势：${profile.selfRatedStrengths || "未填写"}`,
    `当前最大困惑/痛点：${profile.painPoints}`,
    `现实限制：${profile.constraints || "未填写"}`,
  ].join("\n");
}

function buildCoreProblem(profile: CareerUserProfile, missingSkills: string[], roleName: string) {
  if (missingSkills.length >= 4) {
    return `你距离 ${roleName} 的主要问题不是简历表达，而是核心岗位技能覆盖不足，需要先缩小目标和补齐高频要求。`;
  }
  if (profile.painPoints.includes("面试") || profile.painPoints.includes("表达")) {
    return "你的简历已有一定素材，但痛点更像是项目表达和追问承接不足，需要把经历转成可面试的证据链。";
  }
  if (profile.targetTimeline.includes("1")) {
    return "你的目标周期偏紧，当前最关键是压缩学习范围，优先修复最影响投递通过率的短板。";
  }
  return `你已经具备部分 ${roleName} 相关基础，关键是把简历能力、真实状态和岗位要求对齐到可验证的项目成果。`;
}

function extractSkills(rawText: string) {
  const lowerText = rawText.toLowerCase();
  const skills = SKILL_KEYWORDS.filter((skill) => lowerText.includes(skill.toLowerCase()));
  return skills.length > 0 ? skills : ["沟通表达", "项目经历", "学习能力"];
}

function isResumeLike(rawText: string) {
  const normalizedText = rawText.toLowerCase();
  const cleanLength = normalizedText.replace(/\s/g, "").length;
  const signalCount = RESUME_SIGNAL_KEYWORDS.filter((keyword) =>
    normalizedText.includes(keyword.toLowerCase())
  ).length;
  const skillCount = SKILL_KEYWORDS.filter((skill) =>
    normalizedText.includes(skill.toLowerCase())
  ).length;
  const hasContactSignal = /[\w.-]+@[\w.-]+\.\w+|1[3-9]\d{9}/.test(rawText);

  if (cleanLength < 80) return false;
  if (signalCount >= 3) return true;
  return signalCount >= 2 && (skillCount >= 1 || hasContactSignal);
}

function inferEducation(rawText: string) {
  const educationLine = rawText
    .split(/\r?\n/)
    .find((line) => /大学|学院|本科|硕士|博士|专业/.test(line));
  return educationLine?.trim() || "未识别到明确教育经历";
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(text));
  } catch {
    const matched = text.match(/\{[\s\S]*\}/);
    if (!matched) return null;
    try {
      return asRecord(JSON.parse(matched[0]));
    } catch {
      return null;
    }
  }
}

function normalizeGap(gap: unknown, targetRole: string, currentSkills: string[]): SkillGap {
  const gapObject = asRecord(gap);
  const requiredSkills = stringArray(gapObject?.requiredSkills) ?? ROLE_REQUIREMENTS[targetRole] ?? ROLE_REQUIREMENTS.frontend;
  const normalizedCurrent = stringArray(gapObject?.currentSkills) ?? currentSkills;
  const currentSet = new Set(normalizedCurrent.map((skill) => skill.toLowerCase()));
  const missingSkills =
    stringArray(gapObject?.missingSkills) ??
    requiredSkills.filter((skill) => !currentSet.has(skill.toLowerCase()));
  const rawMatchRate = gapObject?.matchRate;
  const matchRate =
    typeof rawMatchRate === "number"
      ? Math.min(100, Math.max(0, Math.round(rawMatchRate)))
      : Math.round(((requiredSkills.length - missingSkills.length) / requiredSkills.length) * 100);

  return {
    currentSkills: normalizedCurrent,
    requiredSkills,
    missingSkills,
    matchRate,
  };
}

function normalizeDiagnosis(
  diagnosis: Record<string, unknown> | null,
  fallback: CareerDiagnosis
): CareerDiagnosis {
  const riskLevel = diagnosis?.riskLevel;
  return {
    coreProblem:
      typeof diagnosis?.coreProblem === "string" && diagnosis.coreProblem.trim()
        ? diagnosis.coreProblem
        : fallback.coreProblem,
    evidence: stringArray(diagnosis?.evidence) ?? fallback.evidence,
    blindSpots: stringArray(diagnosis?.blindSpots) ?? fallback.blindSpots,
    quickWins: stringArray(diagnosis?.quickWins) ?? fallback.quickWins,
    riskLevel: riskLevel === "low" || riskLevel === "medium" || riskLevel === "high" ? riskLevel : fallback.riskLevel,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const result = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return result.length > 0 ? result : null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("AI analysis timeout")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
