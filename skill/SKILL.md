# 简历解析与职业分析能力说明

> 职镜 OPC · AI 能力模块 v1.0.0

## 功能描述

接收用户上传的简历文件（PDF / DOCX / 纯文本），使用大模型提取技能栈、工作经历、项目经验与教育背景，并与目标岗位要求做差距分析，输出技能差距报告与推荐学习资源。

该能力是"简历诊断"与"职业规划"两个产品模块的底层支撑。

## 输入

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `resume_file` | file (pdf/docx/txt/md) | 是 | 简历文件 |
| `target_role` | string | 否 | 目标岗位（不传则只做解析） |

## 输出

| 字段 | 类型 | 说明 |
|---|---|---|
| `parsed_skills` | object[] | `[{name, level, years}]` |
| `parsed_experience` | object[] | `[{title, company, tech_stack}]` |
| `skill_gap` | object | 与 `target_role` 的差距分析 |
| `recommended_learning` | object[] | 推荐学习资源列表 |

## 实现流程

```
用户上传简历 → 文档解析（PDF/DOCX → 文本）
  → 简历初查（判断是否像简历，避免无关文件被强行分析）
  → 大模型结构化提取技能 / 经历 / 教育背景
  → (若提供 target_role) 对比目标岗位能力模型
  → 输出 skill_gap + 推荐学习资源
  → 写入数据库（按会话隔离）
```

## 内部 Prompt 要点

```
## 角色
你是职业规划分析专家，负责解析求职者简历并进行技能分析。

## 任务
1. 从简历中提取：
   - 技能列表（技能名称、熟悉程度、使用年限）
   - 工作 / 项目经历（职位、公司、描述、技术栈）
   - 教育背景
2. 若提供目标岗位，输出：已有技能 / 岗位要求技能 / 缺失技能 / 匹配率
3. 针对缺失技能推荐 3-5 个学习资源，按优先级排序

## 输出约束
严格按要求的结构化格式输出，不附加多余文字。
```

## 代码位置

| 能力 | 位置 |
|---|---|
| 文档解析 | `src/lib/parsers/` |
| 简历结构化分析 | `src/lib/ai/actions.ts` → `analyzeResume()` |
| 技能差距分析 | `src/lib/ai/actions.ts` → `analyzeSkillGap()` |
| 学习路径生成 | `src/lib/ai/actions.ts` → `generateLearningPath()` |
| API 入口 | `src/app/api/upload/route.ts`、`src/app/api/career/*` |
