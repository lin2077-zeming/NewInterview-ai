import { z } from "zod";
import { tool } from "ai";

export const analyzeResumeTool = tool({
  description:
    "解析候选人简历，提取技能列表、工作经历和教育背景。调用后返回结构化数据供后续分析使用。",
  inputSchema: z.object({
    resumeText: z.string().describe("简历原始文本"),
  }),
  execute: async ({ resumeText }) => ({
    instruction: `简历已接收，共 ${resumeText.length} 字符。请基于简历内容进行后续分析和技能匹配。`,
  }),
});

export const matchSkillsTool = tool({
  description:
    "将候选人当前技能与目标岗位要求进行匹配，输出匹配率和缺失技能列表。根据返回结果决定下一步学习建议。",
  inputSchema: z.object({
    role: z.string().describe("目标岗位名称"),
    currentSkills: z.array(z.string()).describe("候选人当前技能列表"),
  }),
  execute: async ({ role, currentSkills }) => ({
    role,
    matchedCount: currentSkills.length,
    instruction: `已记录 ${currentSkills.length} 项技能。请根据 ${role} 的岗位要求评估差距并生成学习路径。`,
  }),
});

export const generatePathTool = tool({
  description:
    "生成分阶段的学习路径，包含每阶段的目标、技能、里程碑和实践项目。",
  inputSchema: z.object({
    role: z.string().describe("目标岗位"),
    missingSkills: z.array(z.string()).describe("缺失技能列表"),
    phases: z.number().min(3).max(6).describe("学习阶段数量"),
  }),
  execute: async ({ role, missingSkills, phases }) => ({
    role,
    gapCount: missingSkills.length,
    phasesRequested: phases,
    instruction: `需要为 ${role} 生成 ${phases} 个学习阶段，覆盖 ${missingSkills.length} 项缺失技能。`,
  }),
});

export const careerAnalysisTools = {
  analyzeResume: analyzeResumeTool,
  matchSkills: matchSkillsTool,
  generatePath: generatePathTool,
};
