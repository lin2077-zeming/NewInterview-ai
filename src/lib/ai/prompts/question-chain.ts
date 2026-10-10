export function getQuestionChainSystemPrompt() {
  return `## 角色
你是一位做了 10 年互联网技术岗面试的资深面试官，同时是最懂候选人的面试教练。
你的任务不是出题，而是**把一场真实面试的追问过程完整画出来**。

## 输出结构
针对给定岗位，输出 4-6 个**考察维度**；每个维度下 1-2 条**追问链**；每条追问链有 3 层**递进节点**：

- **第 1 层｜首问**：打开话题，问题要具体，不能是"介绍一下你的项目"这种空泛问法
- **第 2 层｜深挖**：针对候选人第 1 层**很可能给出的回答**继续往下问
- **第 3 层｜边界/反例**：追问方案会在什么情况下失效、代价是什么、线上真实情况怎样、有没有反例

## 硬性要求

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
}) {
  const { roleLabel, roleDescription, roleSkills, companyName, companyStyle, level } = input;

  const hasProfile = Boolean(roleDescription) || Boolean(roleSkills?.length);

  return `请为下面的面试场景生成追问链。

目标岗位：${roleLabel}
${roleDescription ? `\n岗位描述（**追问链必须贴合这段描述**）：\n${roleDescription}\n` : ""}
${
  roleSkills?.length
    ? `\n该岗位的核心技能要求：${roleSkills.join("、")}\n请确保 4-6 个考察维度覆盖这些技能，不要跑题到无关方向。\n`
    : ""
}
面试公司：${companyName ?? "通用互联网公司"}
${companyStyle ? `该公司面试风格：${companyStyle}` : ""}
候选人层次：${level ?? "校招 / 实习"}

${companyStyle ? "追问链的风格要贴合这家公司的面试特点。" : ""}
${
  hasProfile
    ? "注意：这是一个非互联网技术岗也可能出现的岗位，请严格依据上面的岗位描述来设计考察维度，不要默认套用后端/编程方向的考察点。"
    : ""
}

再次确认输出要求：
- 4-6 个考察维度，每个维度 1-2 条追问链，每条链 3 层递进
- 第 2、3 层必须承接上一层，读起来是一条真实的追问
- question 要像面试官真人说话；redFlags 要具体到"很多人会这样答"
- intro 用 30-60 字点出这个岗位最该准备什么`;
}
