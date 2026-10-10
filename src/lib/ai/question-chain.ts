import { generateObject } from "ai";
import { estimateCost, type UsageCost } from "@/lib/ai/cost";
import { withModelFallback } from "@/lib/ai/generate";
import { buildQuestionChainUserPrompt, getQuestionChainSystemPrompt } from "@/lib/ai/prompts/question-chain";
import { questionChainSchema } from "@/lib/ai/schemas";
import { COMPANY_FLOWS } from "@/config/interview-stages";
import { ROLE_DIMENSIONS, ROLE_LABELS } from "@/config/question-chains";
import type { QuestionChain, QuestionChainDimension, QuestionChainTrack } from "@/types";

const DEFAULT_ROLE = "backend";

/** 把岗位 key 或中文名统一解析成 ROLE_DIMENSIONS 的 key */
export function resolveRoleKey(input?: string): string {
  if (!input) return DEFAULT_ROLE;
  if (ROLE_DIMENSIONS[input]) return input;

  const byLabel = Object.entries(ROLE_LABELS).find(([, label]) => label === input);
  return byLabel ? byLabel[0] : DEFAULT_ROLE;
}

export function getRoleLabel(roleKey: string): string {
  return ROLE_LABELS[roleKey] ?? ROLE_LABELS[DEFAULT_ROLE];
}

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
  "是否真的用过、能否举出具体场景",
  "是否理解实现细节与取舍依据",
  "能否处理边界情况并给出线上证据",
] as const;

/**
 * 规则版追问链。
 *
 * 内容来自 `src/config/question-chains.ts` 的人工配置，
 * 用于未配置 AI 密钥或 AI 调用失败时保证功能可用。
 */
export function buildFallbackQuestionChain(roleInput?: string, companyKey?: string): QuestionChain {
  const roleKey = resolveRoleKey(roleInput);
  const roleLabel = getRoleLabel(roleKey);
  const seeds = ROLE_DIMENSIONS[roleKey] ?? ROLE_DIMENSIONS[DEFAULT_ROLE];
  const company = companyKey ? COMPANY_FLOWS[companyKey] : undefined;

  const dimensions: QuestionChainDimension[] = seeds.map((seed) => ({
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
  }));

  const highlights = dimensions
    .filter((dimension) => dimension.weight === "高")
    .slice(0, 3)
    .map((dimension) => dimension.name)
    .join("、");

  const intro = company
    ? `按 ${company.name} 的面试风格，${roleLabel} 的追问主要围绕 ${highlights} 展开。这家公司${company.style.replace(/。$/, "")}`
    : `${roleLabel} 的面试通常围绕 ${highlights} 展开，每一条都会从「你做过什么」一路追到「边界在哪」。建议先把每条链的第 3 层（边界与反例）准备好，那是最容易被问穿的地方。`;

  return {
    role: roleKey,
    roleLabel,
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
  const roleKey = resolveRoleKey(input.role);
  const roleLabel = getRoleLabel(roleKey);
  const company = input.company ? COMPANY_FLOWS[input.company] : undefined;

  const { object, usage } = await withModelFallback((model) =>
    generateObject({
      model,
      system: getQuestionChainSystemPrompt(),
      schema: questionChainSchema,
      prompt: buildQuestionChainUserPrompt({
        roleLabel,
        companyName: company?.name,
        companyStyle: company?.style,
        level: input.level,
      }),
    })
  );

  const dimensions: QuestionChainDimension[] = object.dimensions
    .map((dimension) => ({
      name: dimension.name,
      why: dimension.why,
      weight: dimension.weight,
      tracks: dimension.tracks
        .filter((track) => track.nodes.length > 0)
        .map((track) => toTrack(track.topic, track.nodes)),
    }))
    .filter((dimension) => dimension.tracks.length > 0);

  if (dimensions.length < 4) return null;

  return {
    chain: {
      role: roleKey,
      roleLabel,
      company: company?.name,
      intro: object.intro,
      dimensions,
      source: "ai",
      createdAt: new Date().toISOString(),
    },
    usage: estimateCost(usage),
  };
}
