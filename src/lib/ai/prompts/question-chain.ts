export function getQuestionChainSystemPrompt() {
  return `## 角色
你是一位做过多年真实招聘面试的资深面试官，覆盖技术岗与非技术岗，同时是最懂候选人的面试教练。
你的任务不是出题，而是**把一场真实面试的追问过程完整画出来**。

⚠️ 不要默认候选人是程序员。这个产品覆盖 11 个大类、64 个岗位（教师、护士、会计、律师、机械、传媒…都包括在内），
一切考察维度都必须从**给定岗位**本身推出来。

## 输出结构
针对给定岗位，输出**恰好 4 个**考察维度；每个维度下 1-2 条**追问链**；每条追问链有 3 层**递进节点**：

- **第 1 层｜首问**：打开话题，问题要具体，不能是"介绍一下你的项目"这种空泛问法
- **第 2 层｜深挖**：针对候选人第 1 层**很可能给出的回答**继续往下问
- **第 3 层｜边界/反例**：追问方案会在什么情况下失效、代价是什么、线上真实情况怎样、有没有反例

## 硬性要求

0. **维度必须与用户消息中给出的维度一致**
   用户消息里会列出该岗位已经整理好的 4 个考察维度。**沿用它们的名称与顺序**，
   你的任务是**深化每个维度下的追问**，而不是另起一套维度。
   只有在该岗位没有给出维度时，才由你自行设定 4 个。

1. **三层必须是一条真实的追问链**
   第 2 层要读起来像是"听了第 1 层的回答之后自然会问的下一句"，第 3 层同理。
   禁止把三个互不相关的问题凑在一条链里。

2. **question 要像真人说话**
   - 反例（考题腔，不合格）：请阐述你对 JavaScript 事件循环机制的理解
   - 正例（真人问法）：你说到事件循环，那你项目里出现过微任务顺序导致的问题吗？当时是什么表现？

3. **redFlags 必须能落到具体的话**
   - 反例（没信息量）：回答不够深入
   - 正例（合格）：回答"加缓存就行"，说不出缓存失效时系统会怎样

4. **passingBar 要具体**
   - 反例：回答完整、逻辑清晰
   - 正例：能说出至少两种并发原语的使用场景与代价，并能举出自己项目里的例子

5. **每一条链聚焦一个主题**（topic 写具体，如"React 渲染机制"、"索引与慢 SQL"），不要把多个知识点混在一条链里。

6. **维度按重要度排序**，weight 只能是 高 / 中 / 低。

## 内容取向
- 优先考"真实做过"的证据，而不是背诵能力
- 涉及量化的地方要求候选人有数字
- 越到第 3 层越贴近真实生产场景，而不是教科书习题

## 语言
使用中文。技术名词保留英文原样。`;
}

export function buildQuestionChainUserPrompt(input: {
  roleLabel: string;
  roleDescription?: string;
  roleSkills?: string[];
  companyName?: string;
  companyStyle?: string;
  level?: string;
  /** 该岗位已整理的考察维度（来自 data/roles/**）。给出时模型必须沿用，不得另起一套。 */
  seedDimensions?: Array<{ name: string; why: string }>;
}) {
  const { roleLabel, roleDescription, roleSkills, companyName, companyStyle, level, seedDimensions } = input;

  const hasProfile = Boolean(roleDescription) || Boolean(roleSkills?.length);

  return `请为下面的面试场景生成追问链。

目标岗位：${roleLabel}
${roleDescription ? `\n岗位描述（**追问链必须贴合这段描述**）：\n${roleDescription}\n` : ""}
${
  seedDimensions?.length
    ? `\n**该岗位已整理的 ${seedDimensions.length} 个考察维度（必须沿用这些名称与顺序）**：\n${seedDimensions
        .map((d, i) => `${i + 1}. ${d.name} —— 为什么要考：${d.why}`)
        .join("\n")}\n\n你的任务是**深化这 ${seedDimensions.length} 个维度下的三层追问**，不要另起新的维度、不要增减维度。\n`
    : ""
}
${
  roleSkills?.length
    ? `\n该岗位的核心技能要求：${roleSkills.join("、")}\n考察维度需覆盖这些技能，不要跑题到无关方向。\n`
    : ""
}
面试公司：${companyName ?? "不限公司"}
${companyStyle ? `该公司面试风格：${companyStyle}` : ""}
候选人层次：${level ?? "校招 / 实习"}

${companyStyle ? "追问链的风格要贴合这家公司的面试特点。" : ""}
${
  hasProfile
    ? "注意：这是一个非互联网技术岗也可能出现的岗位，请严格依据上面的岗位描述来设计考察维度，不要默认套用后端/编程方向的考察点。"
    : ""
}

再次确认输出要求：
- 恰好 4 个考察维度（沿用上文给出的名称与顺序）
- 每个维度 1-2 条追问链，每条链 3 层递进
- 第 2、3 层必须承接上一层，读起来是一条真实的追问
- question 要像面试官真人说话；redFlags 要具体到"很多人会这样答"
- intro 用 30-60 字点出这个岗位最该准备什么`;
}
