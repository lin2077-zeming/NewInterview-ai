# 职镜 OPC

> **一个人也能开的 AI 面试工作室**

职镜 OPC 是一套面向求职学生的 AI 职业训练平台。它的目标不是做一个"面试练习工具"，而是验证一件事：

> **一个人 + 一个 AI Agent，能不能运营起一家过去需要一个团队才能开的面试辅导工作室？**

围绕这个问题，平台把简历诊断、岗位追问链、面试陪练、复盘报告、训练计划串成一条完整链路，并内置一块 **OPC 度量看板**，实时呈现"一个人运营"的真实数据 —— 交付成本、耗时、AI 完成步骤占比、迭代轮次。

---

## 核心模块

| 模块 | 说明 |
|---|---|
| **简历诊断** | 上传 PDF/DOCX 简历，输出**逐条可执行的修改清单**（原句 → 问题 → 建议改法） |
| **岗位追问链** | 按目标岗位生成**可见的追问树**：岗位 → 考察维度 → 逐层追问节点 |
| **面试陪练** | Agent 多步推理：检索题库 → 出题 → 评分 → 自主决定追问/换题/深挖 |
| **复盘报告** | 结构化报告：总分、通过判断、逐题分析、Top3 短板、改进计划 |
| **训练计划** | 基于历史弱项生成下一阶段训练任务 |
| **OPC 度量看板** | 成本 / 耗时 / AI 完成占比 / 迭代轮次，用于证明"一人可运营" |

## 技术栈

```
Next.js 16.2.6 (App Router + Turbopack)   React 19
TypeScript 5 (strict)                     Tailwind CSS v4 + shadcn/ui v4
Vercel AI SDK v6 (@ai-sdk/deepseek)       DeepSeek v4 Pro
Drizzle ORM + @libsql/client (SQLite)     Zod v4
Monaco Editor / recharts / react-markdown / docx
pnpm · 部署端口 5000
```

## 快速开始

```bash
pnpm install
pnpm run dev        # http://localhost:5000
```

生产构建：

```bash
pnpm run build
pnpm run start
```

## 环境变量

复制 `.env.example` 为 `.env.local` 并填写：

```env
OPENAI_API_KEY=你的 DeepSeek API Key
OPENAI_BASE_URL=https://api.deepseek.com/v1
INTERVIEW_MODEL=deepseek-v4-pro
ANALYSIS_MODEL=deepseek-v4-pro
DATABASE_URL=file:./interview.db
```

> 未配置 API Key 时，平台会自动切换到**离线降级模式**（静态题库 + 规则版简历检查），保证基础可用性。
> 请勿将真实密钥提交到仓库。

## 目录结构

```
src/
├── app/
│   ├── api/          # chat / upload / interview / career 接口
│   ├── interview/    # 面试创建、进行、复盘
│   ├── resume/       # 简历诊断与修改清单
│   ├── chain/        # 岗位追问链
│   ├── studio/       # OPC 度量看板
│   └── trust/        # 数据安全与来源声明
├── lib/
│   ├── ai/           # 模型客户端、Agent 工具链、Prompt、Schema
│   ├── db/           # Drizzle + libSQL 初始化与表结构
│   └── parsers/      # 简历文档解析（PDF/DOCX）
├── components/       # UI 组件（ui / layout / interview / resume / ...）
├── config/           # 面试流程与题库配置
└── hooks/            # React Hooks
```

## 数据安全与合规

- **匿名会话隔离**：所有数据按会话隔离，互不可见
- **一键删除**：可随时删除本会话全部数据
- **人工复核**：所有 AI 生成内容标注状态，需用户确认后方视为定稿
- **来源声明**：使用的模型、平台、题库数据来源均在各处显式说明

## 关于来源与致谢

本项目在开发过程中参考并继承了早期团队协作项目的工程基座（Agent 工具链设计、分阶段流程建模等），
相关说明与致谢见 [`NOTICE.md`](./NOTICE.md)。
