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

**环境要求**：Node.js ≥ 20.9、pnpm ≥ 9（`package.json` 已声明 `packageManager`，启用 corepack 后会自动使用对应版本）

```bash
corepack enable     # 首次使用，自动匹配 pnpm 版本（可跳过，只要本机有 pnpm）
pnpm install
pnpm dev            # http://localhost:5000
```

生产构建：

```bash
pnpm build
pnpm start
```

### ⚡ 不需要任何配置就能跑起来

`pnpm dev` 之后直接访问 http://localhost:5000 即可。**不配置任何环境变量也能正常使用**：

| 能力 | 无配置时的表现 |
|---|---|
| 岗位浏览（11 大类 / 64 个细分岗位） | ✅ 正常 |
| 题库练习（986 道题 + 4 维考察要点） | ✅ 正常 |
| 岗位追问链 | ✅ 走**人工整理版**内容 |
| 简历诊断 | ✅ 解析 PDF/DOCX，输出的**规则版**修改清单仍然可执行 |
| AI 面试陪练 / AI 生成内容 | ⚠️ 需配置 API Key（见下） |

这不是"残废状态"：题库与追问链本来就准备了完整的离线内容，
设计上就要求**没有 AI 密钥也是可用的产品**，而不是一个报错页。

### 启用 AI 能力（可选）

复制 `.env.example` 为 `.env.local`，至少填这一项即可：

```env
OPENAI_API_KEY=你的 DeepSeek API Key
OPENAI_BASE_URL=https://api.deepseek.com
INTERVIEW_MODEL=deepseek-flash
ANALYSIS_MODEL=deepseek-flash
```

> 也支持任意 OpenAI 兼容端点（`OPENAI_BASE_URL` 换成智谱 GLM 等即可，
> `.env.example` 里给了两套可直接抄的配置）。
> 请勿将真实密钥提交到仓库；`.env.local` 已在 `.gitignore` 中。

## 环境变量

完整清单与说明见 [`.env.example`](./.env.example)（每一项都写了用途和踩坑提示）。
常用几项：

| 变量 | 是否必需 | 说明 |
|---|---|---|
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` | 可选 | 不填则走离线降级模式 |
| `DATABASE_URL` | 可选 | SQLite 路径，默认 `file:./interview.db` |
| `ADMIN_TOKEN` | 可选 | 岗位管理接口令牌；不配则管理接口整体关闭（默认安全） |
| `STUDIO_PASSWORD` | 可选 | OPC 看板口令；不填用内置默认值 |
| `OPC_ROLES_URL` | 可选 | 岗位数据远程热更新地址；不填用随代码发布的 `data/roles/**` |
| `OPC_RATE_LIMIT_PER_HOUR_*` / `OPC_DAILY_BUDGET_CNY` | 可选 | AI 调用限流与当日预算闸门 |

## 自检（改完代码跑一遍，比手点页面可靠）

```bash
pnpm regression          # 端到端回归：数据校验 / 接口 / 简历解析 / 会话隔离 / AI 功能
pnpm regression:offline  # 同上但跳过要调 AI 的用例（快，不花钱）
pnpm ui-check            # 浏览器交互检查（两级选岗、离线入口、看板口令门等）
pnpm loadtest            # 全链路压测与取数（会真实调用 AI 并产生费用）
pnpm roles:validate      # 岗位数据 54 项校验规则
```

> `ui-check` 依赖 Playwright。它不是项目依赖（体积大、要下浏览器），
> 所以脚本做成了**能用就跑、不能用自动跳过**，不会阻塞主回归。
> `regression` 与 `ui-check` 都需要服务先跑起来（`pnpm dev`）。

## 岗位数据（`data/roles/**`）

平台覆盖 **11 个一级大类 / 64 个细分岗位**，数据全部是**可直接阅读的 JSON**：

```
data/roles/
├── taxonomy.json          # 两级分类索引
├── cs-it/                 # 计算机与信息技术（11 个细分岗位）
├── edu-research/          # 教育与科研
├── finance-econ/          # 金融与经济
└── ...                    # 每个子类一个 .json，含题目/考察维度/公司/面经
```

- **校验**：`pnpm roles:validate`（规则在 `src/lib/job-roles/validate.ts`，与运行时共用同一份）
- **远程热更新**：`pnpm roles:bundle` 打包 → 托管 → 配 `OPC_ROLES_URL`，
  之后改内容**无需重新发版**。详见 [`data/roles/README.md`](./data/roles/README.md)
- 内容来源均带 `source` 字段（赛事要求外部数据须说明来源），
  AI 生成的内容会显式标注，不冒充真实面经

## 目录结构

```
src/
├── app/
│   ├── api/          # chat / upload / interview / resume / career 等接口
│   ├── interview/    # 面试创建、进行、复盘
│   ├── resume/       # 简历诊断与逐条修改清单
│   ├── chain/        # 岗位追问链
│   ├── career/       # 求职规划（技能差距 + 学习路径）
│   ├── practice/     # 题库练习（无需 AI，离线可用）
│   ├── feedback/     # 试用反馈收集（I-15 取数）
│   ├── admin/        # 岗位管理端（需 ADMIN_TOKEN）
│   └── studio/       # OPC 度量看板（右下角入口 + 口令门）
├── lib/
│   ├── ai/           # 模型客户端、Agent 工具链、Prompt、Schema、成本计量
│   ├── db/           # Drizzle + libSQL 初始化与表结构
│   ├── job-roles/    # 岗位数据加载 / 校验 / 远程热更新
│   └── parsers/      # 简历文档解析（PDF/DOCX）
├── components/       # UI 组件（ui / layout / roles / interview / resume / ...）
├── config/           # 面试流程、功能开关
├── hooks/            # React Hooks
└── types/            # 共享类型

data/roles/           # 岗位与题库数据（11 大类 / 64 岗位，纯 JSON）
scripts/              # 回归 / 压测 / 数据校验与打包
tests/                # 回归样本与压测报告
```

## 数据安全与合规

- **匿名会话隔离**：所有数据按会话隔离，互不可见
- **一键删除**：可随时删除本会话全部数据
- **人工复核**：所有 AI 生成内容标注状态，需用户确认后方视为定稿
- **来源声明**：使用的模型、平台、题库数据来源均在各处显式说明

## 关于来源与致谢

本项目在开发过程中参考并继承了早期团队协作项目的工程基座（Agent 工具链设计、分阶段流程建模等），
相关说明与致谢见 [`NOTICE.md`](./NOTICE.md)。
