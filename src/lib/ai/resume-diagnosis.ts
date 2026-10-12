import { generateObject } from "ai";
import { estimateCost, type UsageCost } from "@/lib/ai/cost";
import { withModelFallback } from "@/lib/ai/generate";
import { getResumeDoctorSystemPrompt } from "@/lib/ai/prompts/resume-doctor";
import { resumeDiagnosisSchema } from "@/lib/ai/schemas";
import { CATEGORY_LABELS } from "@/lib/resume-fix-labels";
import { findJobRole } from "@/lib/roles";
import type { ResumeDiagnosis, ResumeFix, ResumeFixCategory, ResumeFixSeverity } from "@/types";

/**
 * 岗位信息一律来自 `findJobRole()`（数据源为 `data/roles/**`）。
 * 这里原先还存着一份 ROLE_LABELS / ROLE_REQUIREMENTS 副本，
 * 与 `config/question-chains.ts`、`lib/roles.ts`、`api/career/analyze` 各存一份且已开始分叉 ——
 * 改造后只留唯一数据源，不再有第二份。
 */

const RESUME_SIGNALS = [
  "简历", "教育", "学历", "本科", "硕士", "博士", "大学", "学院", "专业",
  "项目", "实习", "工作", "经历", "技能", "求职", "岗位", "公司", "负责",
  "开发", "邮箱", "电话", "手机", "github", "portfolio",
  "experience", "education", "project", "skill", "resume",
];

export function isResumeLike(rawText: string): boolean {
  const text = rawText.toLowerCase();
  const cleanLength = text.replace(/\s/g, "").length;
  if (cleanLength < 80) return false;
  const hits = RESUME_SIGNALS.filter((keyword) => text.includes(keyword)).length;
  return hits >= 3;
}

// ========== 规则版兜底诊断 ==========

const SECTION_PATTERNS: Array<[RegExp, string]> = [
  [/教育|学历|education/i, "教育经历"],
  [/实习|internship/i, "实习经历"],
  [/工作经历|工作经验|职业经历|employment/i, "工作经历"],
  [/项目|project/i, "项目经历"],
  [/技能|专业技能|技术栈|skills?/i, "技能"],
  [/荣誉|奖项|获奖|award/i, "荣誉奖项"],
  [/自我评价|个人评价|summary/i, "自我评价"],
  [/个人信息|基本信息|联系方式|contact/i, "基本信息"],
];

const DESCRIPTION_VERBS = /负责|参与|协助|主导|完成|搭建|开发|设计|优化|实现|推进|维护|支持|编写|重构|接入|上线/;
const BULLET = /^\s*[-•·*▪◦]|^\s*\d+[.、)]/;

function isHeading(line: string): boolean {
  const t = line.trim();
  if (t.length === 0 || t.length > 14) return false;
  return SECTION_PATTERNS.some(([re]) => re.test(t));
}

function sectionOf(line: string, current: string): string {
  for (const [re, name] of SECTION_PATTERNS) {
    if (re.test(line.trim()) && line.trim().length <= 14) return name;
  }
  return current;
}

function hasNumber(text: string): boolean {
  return /\d/.test(text);
}

function clip(text: string, max = 90): string {
  const t = text.trim().replace(/^[-•·*▪◦\d.、)\s]+/, "");
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

let fixSeed = 0;
function makeFix(
  category: ResumeFixCategory,
  severity: ResumeFixSeverity,
  section: string,
  original: string,
  issue: string,
  why: string,
  suggestion: string
): ResumeFix {
  fixSeed += 1;
  return {
    id: `fix-${Date.now().toString(36)}-${fixSeed}`,
    category,
    severity,
    section,
    original,
    issue,
    why,
    suggestion,
  };
}

const SEVERITY_ORDER: Record<ResumeFixSeverity, number> = { high: 0, medium: 1, low: 2 };

/**
 * 规则版诊断。
 *
 * 用途有二：① 未配置 API Key 时的降级模式；② AI 输出异常时的兜底。
 * 不编造任何数字 —— 涉及量化时给出带占位符的成品句式，由用户填入真实数据。
 */
export async function buildFallbackDiagnosis(
  rawText: string,
  targetRole?: string
): Promise<ResumeDiagnosis> {
  const role = await findJobRole(targetRole).catch(() => null);
  // findJobRole 已兼容旧 key 与中文标签，这里直接用它的结果即可
  const roleName = role?.label ?? targetRole;
  const requiredSkills = role?.skills;
  const roleKey = role?.key ?? targetRole ?? "";

  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const fixes: ResumeFix[] = [];
  let currentSection = "简历正文";

  const describedLines: Array<{ text: string; section: string }> = [];
  const weakVerbLines: Array<{ text: string; section: string }> = [];

  // 这些段落不属于"经历描述"，不参与量化 / 句式类规则（否则会给自我评价加"补数值"这种荒谬建议）
  const NON_DESCRIPTION_SECTIONS = new Set(["自我评价", "基本信息", "教育经历", "荣誉奖项"]);

  for (const line of lines) {
    if (isHeading(line)) {
      currentSection = sectionOf(line, currentSection);
      continue;
    }
    if (NON_DESCRIPTION_SECTIONS.has(currentSection)) continue;

    const body = line.replace(/^[-•·*▪◦\d.、)\s]+/, "");

    // 弱动词开头的短句单独收集：这类句子通常很短，但恰恰是最常见、最该被点出来的问题
    if (/^(负责|参与|协助)/.test(body) && body.length >= 6) {
      weakVerbLines.push({ text: line, section: currentSection });
    }

    const looksLikeDescription =
      (BULLET.test(line) || DESCRIPTION_VERBS.test(line)) && body.length >= 12;
    if (looksLikeDescription) {
      describedLines.push({ text: line, section: currentSection });
    }
  }

  // A. 缺少量化结果
  const IMPROVE_WORDS = /提升|优化|改进|增强|加快|降低|减少|显著|大幅|明显/;
  for (const item of describedLines) {
    if (hasNumber(item.text)) continue;
    const clean = clip(item.text);
    const vagueClaim = IMPROVE_WORDS.test(item.text);
    fixes.push(
      makeFix(
        "quantify",
        "high",
        item.section,
        clean,
        vagueClaim
          ? "用了「提升 / 优化」这类说法，但没有任何数字支撑"
          : "只有动作，没有结果和量级",
        vagueClaim
          ? "「提升」「优化」在初筛时等于没说 —— 没有数字就无法判断幅度，招聘方会默认当成微小改动。"
          : "初筛时招聘方平均只花 6-10 秒扫一段经历。没有数字的句子无法体现难度和你的实际贡献，会被直接跳过。",
        `${clean.replace(/[。；;]$/, "")}，【补：具体数值或量级，如影响用户数 / 性能提升百分比 / 节省工时 / 覆盖业务线数量】`
      )
    );
    if (fixes.length >= 7) break;
  }

  // B. 信息量过低的「职责句」：以弱动词开头、既无数字也无可见产出
  const OUTCOME_WORDS = /结果|提升|降低|完成|上线|通过|沉淀|接入|交付|落地|覆盖|支撑|被\s*\d|减少|增长/;
  const weak = weakVerbLines
    .filter((item) => !OUTCOME_WORDS.test(item.text) && !hasNumber(item.text))
    .slice(0, 2);
  for (const item of weak) {
    const clean = clip(item.text);
    fixes.push(
      makeFix(
        "vague",
        "high",
        item.section,
        clean,
        "以「负责 / 参与 / 协助」开头，读起来像岗位职责而不是你的成果",
        "这类句子的信息量为零 —— 招聘方想知道的是你做出了什么、带来了什么变化。「负责」还容易被理解为「只是被分到了这个活」。",
        `【改写】主导 XX 模块：采用【技术方案】实现【核心功能】，使【指标】从 A 变为 B。若这条确实没有更多信息可写，建议直接删掉，把版面留给有数据的经历。`
      )
    );
  }

  // C. 岗位关键词缺口
  if (requiredSkills && requiredSkills.length > 0) {
    const lower = rawText.toLowerCase();
    const missing = requiredSkills.filter((skill) => !lower.includes(skill.toLowerCase()));
    if (missing.length > 0) {
      fixes.push(
        makeFix(
          "keyword",
          missing.length >= 4 ? "high" : "medium",
          "技能 / 整体",
          "（简历中未出现）",
          `缺少目标岗位 ${roleName ?? roleKey} 的 ${missing.length} 个高频关键词：${missing.join("、")}`,
          "不少公司用关键词做第一轮机器筛选，缺少关键词会在进入人工评审前就被过滤。",
          `在技能区补上：${missing.join("、")}（只写你确实用过或能答上来的，不要虚报）`
        )
      );
    }
  }

  // D. GitHub / 作品链接
  if (!/github|gitlab|gitee|作品|portfolio|个人网站/i.test(rawText)) {
    fixes.push(
      makeFix(
        "contact",
        "high",
        "基本信息",
        "（简历中未出现）",
        "没有任何代码仓库或作品链接",
        "技术岗简历没有作品链接是硬伤 —— 招聘方无法验证你的动手能力，只能凭描述判断。",
        "在基本信息区补上，例如：GitHub：github.com/<你的账号>（放 1-2 个 README 完善的项目）"
      )
    );
  }

  // E. 联系方式缺失
  const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(rawText);
  const hasPhone = /1[3-9]\d{9}/.test(rawText);
  if (!hasEmail || !hasPhone) {
    fixes.push(
      makeFix(
        "contact",
        "medium",
        "基本信息",
        "（简历中未出现）",
        `缺少${!hasEmail ? "邮箱" : ""}${!hasEmail && !hasPhone ? "和" : ""}${!hasPhone ? "手机号" : ""}`,
        "联系方式缺失会让 HR 无法发起面试，部分岗位会直接跳过。",
        "在简历顶部一行写全：姓名 | 求职意向 | 手机号 | 邮箱 | GitHub"
      )
    );
  }

  // F. 技能区定位（供下方 L 规则使用）
  const skillSectionIndex = lines.findIndex((l) => /^技能|专业技能|技术栈/.test(l) && l.length <= 14);

  // G. 项目缺少背景交代
  const projectIndex = lines.findIndex((l) => /^项目|项目经历/.test(l) && l.length <= 14);
  if (projectIndex >= 0) {
    const after = lines.slice(projectIndex + 1, projectIndex + 4).join(" ");
    if (after && !/面向|为.{0,12}(提供|解决)|解决.{0,12}问题|用户|需求|场景|痛点/.test(after.slice(0, 160))) {
      fixes.push(
        makeFix(
          "structure",
          "medium",
          "项目经历",
          clip(lines[projectIndex + 1] ?? "（简历中未出现）"),
          "项目没有交代背景：做什么、给谁用、解决什么问题",
          "没有背景的项目无法体现你的业务理解，技术选型也显得没有依据。招聘方看不出这个项目为什么值得做。",
          "每个项目开头补一句背景，例如：面向校园的二手交易平台，解决闲置物品信息分散、交易信任成本高的问题"
        )
      );
    }
  }

  // G2. 项目看不出个人贡献
  const projectBlock = projectIndex >= 0 ? lines.slice(projectIndex + 1, projectIndex + 8).join(" ") : "";
  if (
    projectBlock &&
    /我们|团队|小组|组内/.test(projectBlock) &&
    !/我(负责|主导|独立|完成|设计|实现)|个人负责|独立完成|主导/.test(projectBlock)
  ) {
    const who = projectBlock.match(/[^\s]{0,25}(我们|团队|小组)[^\s]{0,25}/)?.[0] ?? "（简历中未出现）";
    fixes.push(
      makeFix(
        "structure",
        "medium",
        "项目经历",
        clip(who),
        "通篇用「我们 / 团队」，看不出哪部分是你做的",
        "面试官只关心你的个人贡献。用团队主语描述会让你的作用被严重稀释，也容易被追问穿。",
        "把团队成果与个人贡献分开写，例如：团队 3 人完成平台搭建，我负责商品列表模块重构与性能优化，使首屏加载从 2.4s 降至 0.9s"
      )
    );
  }

  // K. 经历缺少时间区间
  const experienceSections = ["项目经历", "实习经历", "工作经历"];
  const hasExperienceSection = describedLines.some((item) => experienceSections.includes(item.section));
  const hasDateRange = /\d{4}\s*[.\-/年]\s*\d{1,2}/.test(rawText);
  if (hasExperienceSection && !hasDateRange) {
    fixes.push(
      makeFix(
        "structure",
        "medium",
        "经历段落",
        "（简历中未出现）",
        "所有经历都没有起止时间",
        "没有时间区间，招聘方无法判断经历的新鲜度和持续时间，也会怀疑项目真实性；部分公司的机器筛选会直接要求时间字段。",
        "每段经历都标上时间，例如：2024.03 - 2024.09（时段越近越好，建议倒序排列）"
      )
    );
  }

  // L. 技能平铺过多且无分组
  if (skillSectionIndex >= 0) {
    const skillLine = lines.slice(skillSectionIndex + 1, skillSectionIndex + 3).join("、");
    const skillCount = skillLine.split(/[、,，/|]/).filter((s) => s.trim().length > 0).length;
    if (skillCount >= 6 && !/熟练|精通|熟悉|了解|掌握/.test(skillLine)) {
      fixes.push(
        makeFix(
          "structure",
          "medium",
          "技能",
          clip(skillLine),
          `技能区平铺了 ${skillCount} 项，全部同等对待`,
          "全部罗列等于没有重点 —— 招聘方无法判断你的技术深度，会按最低水平预估你的能力；堆砌不熟的技能在面试时还会变成主动挖坑。",
          "按熟练度分三档并删掉凑数的，例如：熟练：JavaScript / TypeScript / React；熟悉：Node.js / MySQL / Docker；了解：Nginx"
        )
      );
    }
  }

  // M. 自我评价空泛
  const CLICHE = /学习能力强|认真负责|有责任心|团队合作意识|吃苦耐劳|积极主动|抗压能力强|沟通能力强|热爱技术/;
  if (CLICHE.test(rawText)) {
    const line = lines.find((l) => CLICHE.test(l)) ?? "（简历中未出现）";
    fixes.push(
      makeFix(
        "wording",
        "medium",
        "自我评价",
        clip(line),
        "自我评价是一串人人都会写的套话",
        "每个候选人都会写「学习能力强、认真负责」，这段话不产生任何区分度，还会占用宝贵的版面。",
        "删掉套话，换成可验证的事实，例如：三个月自学 React 并独立上线一个日均 200 人使用的校园工具（附仓库链接）"
      )
    );
  }

  // N. 描述句式同质化
  if (describedLines.length >= 3) {
    const starts = describedLines.map((item) => clip(item.text, 6).replace(/\d.*$/, ""));
    const counts = new Map<string, number>();
    for (const start of starts) {
      const key = start.slice(0, 3);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (dominant && dominant[1] >= 3) {
      fixes.push(
        makeFix(
          "wording",
          "low",
          "整体",
          `（有 ${dominant[1]} 条以「${dominant[0]}…」开头）`,
          "多条经历句式雷同，读起来像流水账",
          "句式单一的简历会让人产生「内容也差不多」的印象，掩盖了真正有亮点的经历。",
          "变换句式，把最亮眼的成果放到句首，例如：从「使用 X 完成了 Y」改为「Y（结果指标），通过 X 实现」"
        )
      );
    }
  }

  // H. 无求职意向
  if (!/求职意向|期望岗位|目标岗位|应聘/.test(rawText)) {
    fixes.push(
      makeFix(
        "contact",
        "medium",
        "基本信息",
        "（简历中未出现）",
        "没有写明求职意向",
        "HR 拿到简历第一眼要看的就是「你想做什么」，缺失会降低匹配判断效率。",
        `在姓名下方加一行：求职意向：${roleName ?? "（填写目标岗位）"}`
      )
    );
  }

  // I. 日期格式不统一
  const dateForms = new Set<string>();
  for (const line of lines) {
    if (/\d{4}\.\d{1,2}/.test(line)) dateForms.add("YYYY.MM");
    if (/\d{4}-\d{1,2}/.test(line)) dateForms.add("YYYY-MM");
    if (/\d{4}\/\d{1,2}/.test(line)) dateForms.add("YYYY/MM");
    if (/\d{4}年\d{1,2}月/.test(line)) dateForms.add("YYYY年MM月");
  }
  if (dateForms.size > 1) {
    fixes.push(
      makeFix(
        "consistency",
        "low",
        "整体",
        `（简历中同时出现 ${[...dateForms].join(" / ")} 等 ${dateForms.size} 种写法）`,
        "日期格式不统一",
        "细节不统一会让人怀疑简历的严谨程度，技术岗尤其看重复核能力。",
        "全文统一为一种格式，例如统一写成 2024.03 - 2024.09"
      )
    );
  }

  // J. 缺少教育经历
  if (!/教育|学历|本科|硕士|大学|学院/.test(rawText)) {
    fixes.push(
      makeFix(
        "structure",
        "high",
        "教育经历",
        "（简历中未出现）",
        "没有教育经历",
        "应届生简历中教育经历是必填项，缺失会被认为信息不完整。",
        "补上：起止时间 | 学校 | 专业 | 学历（有优势可加绩点/排名/相关课程）"
      )
    );
  }

  // 按严重度排序后去重：同一条原句只保留最严重的那条建议
  // （"（简历中未出现）"类建议指向不同的缺失项，不参与去重）
  fixes.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const seen = new Set<string>();
  const result = fixes.filter((fix) => {
    const key = fix.original.trim();
    if (key === "（简历中未出现）") return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const highCount = result.filter((f) => f.severity === "high").length;
  const mediumCount = result.filter((f) => f.severity === "medium").length;
  const score = Math.max(12, Math.min(88, 95 - highCount * 9 - mediumCount * 4 - (result.length - highCount - mediumCount) * 2));
  const verdict =
    score >= 66
      ? "基本能过初筛，但现有问题会让面试官对你形成偏低的预期"
      : score >= 45
        ? "能过一部分岗位，但在竞争激烈的岗位会被筛掉"
        : "当前状态下会被大量初筛直接淘汰，建议按下面清单改完再投";

  const first = result[0];
  const summary = first
    ? `本次共定位 ${result.length} 处可改进问题，其中 ${highCount} 处属于会「直接被筛掉」的硬伤。最先要动手的是第 1 条（${CATEGORY_LABELS[first.category]}）：${first.issue}。建议按严重度从高到低依次修改，改完后重新上传诊断，对比分数变化。`
    : `本次未发现明显问题，可以放心投递。`;

  return {
    score,
    verdict,
    summary,
    fixes: result,
    targetRole: roleName,
    source: "fallback",
    createdAt: new Date().toISOString(),
  };
}

// ========== AI 诊断 ==========

export interface AiDiagnosisResult {
  diagnosis: ResumeDiagnosis;
  usage: UsageCost;
}

export async function diagnoseResumeWithAI(
  rawText: string,
  targetRole?: string
): Promise<AiDiagnosisResult | null> {
  const role = await findJobRole(targetRole).catch(() => null);
  const roleName = role?.label ?? targetRole ?? "未指定（按通用岗位标准评判）";

  // 岗位描述与技能要求是约束诊断方向的唯一依据（覆盖 64 个子类）
  const roleContext = [
    role?.description ? `岗位描述：${role.description}` : "",
    role?.skills.length ? `该岗位的核心技能要求：${role.skills.join("、")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { value, servedBy } = await withModelFallback(
    (model) =>
      generateObject({
        model,
        system: getResumeDoctorSystemPrompt(),
        schema: resumeDiagnosisSchema,
        // 诊断清单动辄十几条，每条含原句/问题/原因/改后句，输出体积偏大。
        // request-guard 的默认上限 4096 有被截断的风险（截断 → JSON 非法 → 无辜降级），
        // 这里显式放宽。放宽不会增加成本 —— 只有真正生成才计费。
        maxOutputTokens: 8000,
        prompt: `请对下面这份简历做逐条诊断。

目标岗位：${roleName}
${roleContext ? `\n${roleContext}\n` : ""}
简历全文：
"""
${rawText.slice(0, 8000)}
"""

要求回顾：
- 至少 8 条修改建议，按严重度从高到低排列
- 每条的 original 必须是简历中**原样出现过**的句子（截取一句即可，不可改写）；确实无原文时写「（简历中未出现）」
- 每条的 suggestion 必须是**可直接替换进简历的成品句子**，不是修改方向
- section 要指明所在段落，例如「项目经历 · 第 2 段」`,
      }),
    { kind: "resume_diagnose" }
  );

  const { object, usage } = value;

  const fixes = object.fixes
    .filter((fix) => fix.original.trim().length > 0 && fix.suggestion.trim().length > 0)
    .map((fix) => ({ ...fix, id: crypto.randomUUID() }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  if (fixes.length === 0) return null;

  return {
    diagnosis: {
      score: object.score,
      verdict: object.verdict,
      summary: object.summary,
      fixes,
      targetRole: roleName,
      source: "ai",
      createdAt: new Date().toISOString(),
    },
    usage: estimateCost(usage, servedBy),
  };
}
