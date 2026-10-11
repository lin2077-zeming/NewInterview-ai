import type { CompanyFlow } from "@/types";

/**
 * 通用流程：不限行业与公司。
 *
 * 存在的意义：原来的 8 个流程全是互联网公司（字节 / 阿里 / 腾讯…），
 * 阶段名也叫「算法面」「项目深挖面」。教师、护士、会计这些岗位被迫选一家
 * 互联网公司、进一个叫「算法面」的环节，显然是错的。
 *
 * 阶段 id 仍沿用 algorithm/project/cross/hr —— 与题库的题型字段对齐；
 * 但显示名改成岗位中立的说法（algorithm 在这个语境下是「专业能力」而非「算法」）。
 */
export const GENERIC_FLOW: CompanyFlow = {
  name: "通用（按岗位考察）",
  style:
    "不限行业与公司的通用面试流程。考察重点完全由目标岗位决定，适合非互联网、非计算机方向的岗位。",
  stages: [
    {
      id: "algorithm",
      name: "专业能力面",
      duration: 40,
      focus: "岗位核心专业能力",
      topics: "围绕该岗位的核心技能与实务问题，判断是否具备上岗所需的专业基础",
    },
    {
      id: "project",
      name: "经历深挖面",
      duration: 40,
      focus: "项目 / 实习 / 实践经历",
      topics: "深挖简历中的经历：你具体做了什么、怎么做的、结果如何、遇到什么困难",
    },
    {
      id: "cross",
      name: "综合应变面",
      duration: 25,
      focus: "综合素养与场景应变",
      topics: "跨领域协作、突发情况处理、沟通表达与临场应对",
    },
    {
      id: "hr",
      name: "HR 面",
      duration: 20,
      focus: "求职动机与职业规划",
      topics: "求职动机、职业规划、团队协作、期望薪资",
    },
  ],
  stressAvailable: ["algorithm", "project"],
};

export const COMPANY_FLOWS: Record<string, CompanyFlow> = {
  // 通用流程排在最前：非技术岗位不必再被迫选一家互联网公司
  generic: GENERIC_FLOW,
  bytedance: {
    name: "字节跳动",
    style: "重视算法基础与工程落地能力，喜欢追问边界条件和性能优化。面试节奏快，问题深，期待候选人能举一反三。关注候选人是否具备Owner意识和数据驱动思维。",
    stages: [
      {
        id: "algorithm",
        name: "算法面",
        duration: 45,
        focus: "数据结构与算法",
        topics: "数组、链表、二叉树、动态规划、排序算法，2道中等难度题",
      },
      {
        id: "project",
        name: "项目深挖面",
        duration: 45,
        focus: "项目经验与技术深度",
        topics: "简历项目深挖、系统设计基础、技术选型理由、常见后端问题",
      },
      {
        id: "hr",
        name: "HR 面",
        duration: 30,
        focus: "综合素质与职业规划",
        topics: "价值观匹配、职业规划、团队协作、薪资期望",
      },
    ],
    stressAvailable: ["algorithm", "project"],
  },
  alibaba: {
    name: "阿里巴巴",
    style: "注重技术深度与广度并重，强调系统设计能力和业务理解。关注候选人的学习能力和成长潜力，喜欢问'为什么'和'还有更好的方案吗'。价值观面试是重要环节。",
    stages: [
      {
        id: "algorithm",
        name: "算法面",
        duration: 45,
        focus: "算法与编程能力",
        topics: "常见算法题2道，侧重工程实现和代码质量",
      },
      {
        id: "project",
        name: "技术一面",
        duration: 45,
        focus: "技术基础与项目经验",
        topics: "Java基础、Spring框架、数据库、中间件、项目深挖",
      },
      {
        id: "cross",
        name: "交叉面",
        duration: 45,
        focus: "跨团队技术视野",
        topics: "系统设计、架构能力、技术广度、业务理解",
      },
      {
        id: "hr",
        name: "HR 面",
        duration: 30,
        focus: "价值观与文化匹配",
        topics: "阿里价值观、职业规划、压力应对、团队协作",
      },
    ],
    stressAvailable: ["algorithm", "project", "cross"],
  },
  tencent: {
    name: "腾讯",
    style: "技术面试侧重基础扎实度，喜欢从底层原理开始追问。注重项目经验的真实性和深度，会追问技术选型背后的考量。面试氛围相对轻松但问题不简单，期待候选人有产品思维。",
    stages: [
      {
        id: "algorithm",
        name: "算法面",
        duration: 45,
        focus: "算法与编程基础",
        topics: "1-2道中等难度算法题，侧重链表、二叉树、动态规划",
      },
      {
        id: "project",
        name: "技术一面",
        duration: 45,
        focus: "技术基础与项目",
        topics: "C++/Go基础、网络编程、数据库、项目经验深挖",
      },
      {
        id: "project",
        name: "技术二面",
        duration: 45,
        focus: "架构设计与深度技术",
        topics: "系统架构设计、分布式系统、高可用方案、技术选型对比",
      },
      {
        id: "hr",
        name: "HR 面",
        duration: 30,
        focus: "综合素质",
        topics: "沟通能力、团队协作、职业规划、文化适应",
      },
    ],
    stressAvailable: ["algorithm", "project"],
  },
  meituan: {
    name: "美团",
    style: "注重工程实践和业务落地能力，强调代码质量和系统稳定性。喜欢问实际生产环境中遇到的问题和解决方案，关注候选人的Owner意识和抗压能力。",
    stages: [
      {
        id: "algorithm",
        name: "算法面",
        duration: 45,
        focus: "算法与数据结构",
        topics: "2道算法题，侧重实际问题建模和代码质量",
      },
      {
        id: "project",
        name: "技术面",
        duration: 45,
        focus: "技术深度与项目",
        topics: "Java/Go技术栈、MySQL优化、Redis应用、项目深挖",
      },
      {
        id: "hr",
        name: "HR 面",
        duration: 30,
        focus: "综合素质",
        topics: "学习能力、团队精神、抗压能力、职业规划",
      },
    ],
    stressAvailable: ["algorithm", "project"],
  },
  huawei: {
    name: "华为",
    style: "强调技术功底和工程严谨性，机试成绩是重要参考。面试注重基础知识掌握程度（操作系统、网络、数据结构），喜欢深挖底层原理。技术面后会有综合面考察综合素质和领导力潜力，HR面关注奋斗精神和稳定性。",
    stages: [
      {
        id: "algorithm",
        name: "机试/算法面",
        duration: 60,
        focus: "编程基础与算法",
        topics: "3道编程题，涵盖字符串处理、动态规划、图论，侧重代码严谨性",
      },
      {
        id: "project",
        name: "技术面",
        duration: 45,
        focus: "技术深度与项目经验",
        topics: "C/C++/Java基础、操作系统、计算机网络、项目深挖",
      },
      {
        id: "cross",
        name: "综合面",
        duration: 45,
        focus: "综合素质与技术视野",
        topics: "技术广度、架构理解、技术创新能力、团队领导力",
      },
      {
        id: "hr",
        name: "HR 面",
        duration: 30,
        focus: "价值观与职业规划",
        topics: "华为文化、奋斗者精神、职业规划、抗压能力",
      },
    ],
    stressAvailable: ["algorithm", "project"],
  },
  baidu: {
    name: "百度",
    style: "技术氛围浓厚，重视算法能力和前沿技术理解。AI/机器学习方向面试会深入问模型原理和工程实践。期待候选人对技术有热情，喜欢讨论技术方案的演变和优劣对比。",
    stages: [
      {
        id: "algorithm",
        name: "算法面",
        duration: 45,
        focus: "算法与编程能力",
        topics: "2道中等难度算法题，侧重搜索/推荐/NLP相关算法思维",
      },
      {
        id: "project",
        name: "技术一面",
        duration: 45,
        focus: "技术基础与项目经验",
        topics: "C++/Python基础、机器学习基础、深度学习框架、项目深挖",
      },
      {
        id: "cross",
        name: "技术二面",
        duration: 45,
        focus: "系统设计与架构",
        topics: "大规模系统设计、分布式训练、模型部署、技术选型",
      },
      {
        id: "hr",
        name: "HR 面",
        duration: 30,
        focus: "综合素质",
        topics: "沟通能力、学习能力、团队协作、职业规划",
      },
    ],
    stressAvailable: ["algorithm", "project"],
  },
  netease: {
    name: "网易",
    style: "面试氛围相对友好，注重项目深度和技术热情。喜欢了解候选人做过的项目背后的思考和挑战。技术面覆盖面广但不刻意刁难，更加看重候选人的学习能力和团队契合度。",
    stages: [
      {
        id: "algorithm",
        name: "算法面",
        duration: 45,
        focus: "算法与数据结构",
        topics: "2道算法题，侧重实际应用场景和代码规范",
      },
      {
        id: "project",
        name: "技术面",
        duration: 45,
        focus: "技术深度与项目",
        topics: "Java/Go/C++技术栈、数据库优化、中间件原理、项目深挖",
      },
      {
        id: "hr",
        name: "HR 面",
        duration: 30,
        focus: "综合素质与职业规划",
        topics: "沟通表达、团队协作、职业规划、薪资期望",
      },
    ],
    stressAvailable: ["algorithm", "project"],
  },
  jd: {
    name: "京东",
    style: "注重大规模分布式系统的实践经验，强调高并发、高可用场景的解决方案。喜欢问'如果量级扩大10倍怎么办'的扩展性问题。关注候选人对电商业务场景的理解，代码习惯和工程规范。",
    stages: [
      {
        id: "algorithm",
        name: "算法面",
        duration: 45,
        focus: "算法与编程能力",
        topics: "2道算法题，侧重工程实现和边界条件处理",
      },
      {
        id: "project",
        name: "技术一面",
        duration: 45,
        focus: "技术基础与项目经验",
        topics: "Java技术栈、Spring/MyBatis、分布式组件、项目深挖",
      },
      {
        id: "project",
        name: "技术二面",
        duration: 45,
        focus: "架构设计与系统思维",
        topics: "高并发系统设计、微服务架构、数据一致性、性能优化",
      },
      {
        id: "hr",
        name: "HR 面",
        duration: 30,
        focus: "综合素质与价值观",
        topics: "沟通能力、学习能力、团队精神、职业稳定性",
      },
    ],
    stressAvailable: ["algorithm", "project"],
  },
};

// 岗位清单已迁到 data/roles/**（64 个子类，11 个大类）。
// 这里不再保留第二份 —— 原先的 ROLES 数组与 question-chains.ts、lib/roles.ts、
// resume-diagnosis.ts、career/analyze 各存一份，正是"分类混乱"的根源。

export const DEFAULT_COMPANY = "bytedance";
