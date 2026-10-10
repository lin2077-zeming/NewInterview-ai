<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 职镜 OPC — AGENTS.md

## 项目概览
- **项目名**: 职镜 OPC — AI 模拟面试 + 职业规划
- **框架**: Next.js 16.2.6 (App Router + Turbopack)
- **语言**: TypeScript 5 (strict mode)
- **UI**: Tailwind CSS v4 + shadcn/ui v4 (Base UI 内核，非 Radix)
- **AI 框架**: Vercel AI SDK v6
- **LLM**: DeepSeek v4 Pro（通过 @ai-sdk/deepseek 原生 provider）
- **数据库**: SQLite（@libsql/client + drizzle-orm/libsql）
- **部署端口**: 5000
- **包管理**: pnpm

## 构建和启动命令
```bash
pnpm install          # 安装依赖
pnpm run build        # 构建（TypeScript + Next.js 打包）
pnpm run start        # 启动生产服务（端口 5000）
pnpm run dev          # 启动开发服务（端口 5000）
pnpm run lint         # ESLint 检查
```

## 环境变量
- `OPENAI_API_KEY`: DeepSeek API Key
- `OPENAI_BASE_URL`: https://api.deepseek.com/v1
- `DATABASE_URL`: SQLite 数据库路径（默认 file:./interview.db）
- `INTERVIEW_MODEL`: 面试对话模型（默认 deepseek-v4-pro）
- `ANALYSIS_MODEL`: 分析任务模型（默认 deepseek-v4-pro）

## 项目结构
```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # AI 面试对话（SSE 流式）
│   │   ├── upload/route.ts        # 简历上传
│   │   └── career/                # 职业规划 API（SSE 流式）
│   │       ├── generate/route.ts  # 职业推荐
│   │       ├── roadmap/route.ts   # 学习路线
│   │       ├── resources/route.ts # 学习资源
│   │       ├── chat/route.ts      # AI 顾问对话
│   │       └── analyze/route.ts   # 求职规划分析
│   ├── interview/                 # 面试页面
│   ├── career/                    # 职业规划页面
│   ├── student/                   # 大学生规划页面
│   ├── profile/                   # 个人信息
│   └── (auth)/sign-in/            # 登录页（Coze 环境跳转首页）
├── lib/
│   ├── ai/                        # AI 核心逻辑
│   │   ├── client.ts              # LLM 客户端（DeepSeek + OpenAI 适配）
│   │   ├── interview-flow.ts      # 面试 Agent 工具定义
│   │   ├── actions.ts             # Server Actions
│   │   ├── sse-stream.ts          # SSE 流式响应封装
│   │   ├── schemas.ts             # Zod schemas
│   │   ├── career-tools.ts        # 职业工具
│   │   └── prompts/               # 系统提示词
│   └── db/                        # 数据库
│       ├── index.ts               # SQLite + Drizzle 初始化
│       └── schema.ts              # 表结构定义
├── components/
│   ├── ui/                        # shadcn/ui 组件
│   ├── layout/                    # 布局组件
│   └── student/                   # 学生模块组件
├── config/                        # 面试题库等配置
├── types/                         # TypeScript 类型
└── hooks/                         # React Hooks
```

## API 路由清单
| 路由 | 方法 | 说明 | 响应格式 |
|------|------|------|----------|
| /api/chat | POST | AI 面试对话 | AI SDK v6 UI stream |
| /api/upload | POST | 简历上传 | JSON |
| /api/career/generate | POST | 职业推荐 | SSE 流 |
| /api/career/roadmap | POST | 学习路线 | SSE 流 |
| /api/career/resources | POST | 学习资源 | SSE 流 |
| /api/career/chat | POST | AI 顾问对话 | SSE 流 |
| /api/career/analyze | POST | 求职规划分析 | JSON |

## 代码风格指南
- 使用 TypeScript strict mode
- 组件使用函数式组件 + hooks
- UI 组件遵循 shadcn/ui v4（Base UI 内核）规范
- Select 组件 onValueChange 签名: `(value: string | null, eventDetails) => void`，必须处理 null
- AI 流式响应使用 SSE 协议，格式: `data: {"content": "文字..."}\n\n`
- 数据库操作使用 Drizzle ORM，表在首次导入时自动创建

## 已知问题
- Coze 代理环境下 Server Actions 可能因 x-forwarded-host 不匹配而失败
- 中间件已改为直通模式（无 Clerk 认证）
- better-sqlite3 是 C++ 原生模块，早期版本使用过；现已替换为 `@libsql/client`，无需原生编译环境
