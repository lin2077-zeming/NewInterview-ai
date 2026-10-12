import { generateObject } from "ai";
import { estimateCost, type UsageCost } from "@/lib/ai/cost";
import { withModelFallback } from "@/lib/ai/generate";
import { buildQuestionChainUserPrompt, getQuestionChainSystemPrompt } from "@/lib/ai/prompts/question-chain";
import { questionChainSchema } from "@/lib/ai/schemas";
import { COMPANY_FLOWS } from "@/config/interview-stages";
import { findJobRole, type JobRole } from "@/lib/roles";
import type { QuestionChain, QuestionChainDimension, QuestionChainTrack } from "@/types";

/** 节点层级按顺序推导，不依赖模型输出 */
function toTrack(
  topic: string,
  nodes: Array<{ question: string; focus: string; passingBar: string; redFlags: string[] }>
): QuestionChainTrack {
  return {
    topic,
    nodes: nodes.slice(0, 3).map((node, index) => ({
      level: (index + 1) as 1 | 2 | 3,
      question: node.question,
      focus: node.focus,
      passingBar: node.passingBar,
      redFlags: node.redFlags,
    })),
  };
}

/** 按层级给出考察重点，避免每层都只是重复维度名 */
const LEVEL_FOCUS = [
  "是否真的做过、能否举出具体场景",
  "是否理解实现细节与取舍依据",
  "能否处理边界情况并给出真实证据",
] as const;

/**
 * 按技能要求生成通用追问链。
 *
 * 用于管理员新增的岗位 —— 这类岗位没有手写的离线内容，
 * 但**不再静默套用后端岗位的维度**，而是围绕岗位自己的技能要求生成，
 * 并在 intro 中明确说明这是通用追问。
 */
function buildSkillDimensions(skills: string[]): QuestionChainDimension[] {
  const targets = skills.slice(0, 5);

  return targets.map((skill) => ({
    name: skill,
    why: `岗位要求中列出的核心能力，面试官一定会拿它验证你的真实水平。`,
    weight: "高" as const,
    tracks: [
      toTrack(skill, [
        {
          question: `你在「${skill}」这块具体做过什么？挑一个真实的例子，讲清楚背景和你自己负责的部分。`,
          focus: LEVEL_FOCUS[0],
          passingBar: "能给出具体场景、时间与个人职责边界，而不是复述岗位描述或团队成果。",
          redFlags: ["只讲概念与流程，拿不出一个自己真正做过的例子。"],
        },
        {
          question: `这个例子里最难的判断是什么？你当时为什么选了这个做法？`,
          focus: LEVEL_FOCUS[1],
          passingBar: "能说清被放弃的方案及其原因，体现取舍而不是事后合理化。",
          redFlags: ["回答「当时没想那么多」，看不出决策过程。"],
        },
        {
          question: `如果换一个规模或场景，你这套做法还成立吗？哪里会先出问题？`,
          focus: LEVEL_FOCUS[2],
          passingBar: "能指出适用边界与失效条件，并给出可验证的判断依据。",
          redFlags: ["回答「应该都行」，对边界没有概念。"],
        },
      ]),
    ],
  }));
}

/**
 * 离线（或 AI 不可用）时的追问链。
 *
 * 内置岗位用手写配置；管理员新增岗位按技能要求生成通用追问。
 */
export async function buildFallbackQuestionChain(
  roleInput?: string,
  companyKey?: string
): Promise<QuestionChain> {
  const found = await findJobRole(roleInput);
  const company = companyKey ? COMPANY_FLOWS[companyKey] : undefined;

  // 找不到时不再静默套用后端岗 —— 保留用户输入的名称，并显式说明是通用追问
  const role: JobRole =
    found ?? {
      key: roleInput?.trim() || "unknown",
      label: roleInput?.trim() || "未指定岗位",
      skills: [],
      enabled: true,
      source: "admin",
      hasOfflineContent: false,
    };

  // 离线维度来自 data/roles/** 的内容文件（loader 已挂在 JobRole.dimensions 上）
  const seeded = found?.dimensions;
  const isBuiltinContent = Array.isArray(seeded) && seeded.length > 0;

  const dimensions: QuestionChainDimension[] = isBuiltinContent
    ? seeded.map((seed) => ({
        name: seed.name,
        why: seed.why,
        weight: seed.weight,
        tracks: [
          toTrack(
            seed.name,
            seed.probes.map((probe, index) => ({
              question: probe.q,
              focus: LEVEL_FOCUS[index] ?? LEVEL_FOCUS[0],
              passingBar: probe.bar,
              redFlags: [probe.red],
            }))
          ),
        ],
      }))
    : buildSkillDimensions(role.skills);

  const highlights = dimensions.slice(0, 3).map((d) => d.name).join("、");
  const companyNote = company
    ? `按 ${company.name} 的面试风格，`
    : "";

  const intro = isBuiltinContent
    ? company
      ? `${companyNote}${role.label} 的追问主要围绕 ${highlights} 展开。这家公司${company.style.replace(/。$/, "")}`
      : `${role.label} 的面试通常围绕 ${highlights} 展开，每一条都会从「你做过什么」一路追到「边界在哪」。建议先把每条链的第 3 层（边界与反例）准备好，那是最容易被问穿的地方。`
    : `${companyNote}${role.label} 暂无人工整理的离线题库，以下是按该岗位技能要求生成的通用追问。配置 AI 密钥后可获得更贴合该岗位的定制追问链。`;

  return {
    role: role.key,
    roleLabel: role.label,
    company: company?.name,
    intro,
    dimensions,
    source: "fallback",
    createdAt: new Date().toISOString(),
  };
}

export interface AiChainResult {
  chain: QuestionChain;
  usage: UsageCost;
}

export async function generateQuestionChainWithAI(input: {
  role?: string;
  company?: string;
  level?: string;
}): Promise<AiChainResult | null> {
  const role = await findJobRole(input.role);
  if (!role) return null;

  const company = input.company ? COMPANY_FLOWS[input.company] : undefined;

  const { value, servedBy } = await withModelFallback(
    (model) =>
      generateObject({
        model,
        system: getQuestionChainSystemPrompt(),
        schema: questionChainSchema,
        // 追问链的输出体积天然偏大（4-6 维度 × 1-2 条链 × 3 层节点），
        // request-guard 的默认上限 4096 会把 JSON 截断成非法结构，
        // 表现为偶发 "could not parse the response" 然后无辜降级。这里显式放宽。
        maxOutputTokens: 8000,
        prompt: buildQuestionChainUserPrompt({
          roleLabel: role.label,
          roleDescription: role.description,
          roleSkills: role.skills,
          companyName: company?.name,
          companyStyle: company?.style,
          level: input.level,
          // 把该岗位已整理的 4 个维度交给模型**沿用并深化**。
          // 不给的话模型会自己另起一套，人工整理的维度就白费了，
          // 而且同一岗位会出现"离线 4 维度、在线 6 维度"的不一致。
          seedDimensions: role.dimensions?.map((d) => ({ name: d.name, why: d.why })),
        }),
      }),
    { kind: "chain_generate" }
  );

  const { object, usage } = value;

  /** 把模型返回的一个维度转成出参格式 */
  const toDimension = (dimension: (typeof object.dimensions)[number]): QuestionChainDimension => ({
    name: dimension.name,
    why: dimension.why,
    weight: dimension.weight,
    tracks: dimension.tracks
      .filter((track) => track.nodes.length > 0)
      .map((track) => toTrack(track.topic, track.nodes)),
  });

  /**
   * 维度对齐。
   *
   * 为什么要在代码里对齐，而不是靠 schema 约束模型输出 4 个：
   * 实测把 schema 收紧成 length(4) 后，模型只要多输出一个维度就**整体校验失败**，
   * 直接触发降级 —— 为了一个数量约束把 AI 路径搞坏是不划算的。
   *
   * 这里改成：schema 放宽（4-6），由代码**始终按人工整理的维度输出**，
   * 模型只负责深化每个维度下的追问。这样：
   * - 离线与在线两条路径的维度永远一致
   * - 人工整理的维度不会被模型另起一套覆盖掉
   * - 模型多输出/少输出都不会导致失败
   */
  const seeds = role.dimensions ?? [];
  let dimensions: QuestionChainDimension[];

  if (seeds.length > 0) {
    const used = new Set<number>();
    const picked = object.dimensions
      .map(toDimension)
      .filter((d) => d.tracks.length > 0);

    dimensions = seeds.map((seed) => {
      // 先按名称匹配，匹配不上再按顺序取一个没用过的
      let idx = picked.findIndex((d, j) => !used.has(j) && d.name === seed.name);
      if (idx < 0) idx = picked.findIndex((_, j) => !used.has(j));
      if (idx < 0) return null;
      used.add(idx);

      // 名称 / why / 权重一律用人工整理的版本，追问内容用模型深化的版本
      return {
        name: seed.name,
        why: seed.why,
        weight: seed.weight,
        tracks: picked[idx].tracks,
      };
    }).filter((d): d is QuestionChainDimension => d !== null);
  } else {
    dimensions = object.dimensions
      .map(toDimension)
      .filter((dimension) => dimension.tracks.length > 0);
  }

  if (dimensions.length === 0) return null;

  return {
    chain: {
      role: role.key,
      roleLabel: role.label,
      company: company?.name,
      intro: object.intro,
      dimensions,
      source: "ai",
      createdAt: new Date().toISOString(),
    },
    usage: estimateCost(usage, servedBy),
  };
}
