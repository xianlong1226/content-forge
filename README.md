# ContentForge - 智能内容工厂

基于 AI 的内容生产工具，自动将日报素材转化为多平台（微信公众号、小红书）的优质内容，并内置合规审查机制。

## 核心流程

```
上传日报 → 话题选取 → AI 双平台生成 → 合规审查 → 导出发布
```

## 技术栈

- **框架**: Next.js 16 (App Router) + React 19 + TypeScript
- **样式**: Tailwind CSS v4
- **数据库**: SQLite (better-sqlite3) + Drizzle ORM
- **AI 集成**: Vercel AI SDK，支持 DeepSeek / OpenAI / Anthropic
- **Markdown 渲染**: marked

## 功能概览

| 功能 | 说明 |
|------|------|
| 日报解析 | 上传 Markdown 格式日报，通过规则引擎提取话题、核心数据、关键洞察 |
| 智能选题 | 基于热度排序 + 敏感词过滤 + 去重的自动选题算法 |
| 双平台生成 | 同一话题同时生成微信公众号文章（800-1200 字）和小红书笔记（300-500 字） |
| 合规审查 | 两阶段审查：关键词/正则扫描 + LLM 深度审查，自动替换违禁词并添加免责声明 |
| 多主题导出 | 微信公众号支持墨金、清雪、墨绿、暖玫瑰四种排版主题 |
| 流式输出 | 内容生成采用 SSE 流式传输，实时展示生成进度 |
| LLM 配置 | 支持配置不同 AI 服务商、模型、API Key 和温度参数 |

## 项目结构

```
contentforge/
├── data/                          # SQLite 数据库文件
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── page.tsx               # 仪表盘
│   │   ├── create/page.tsx        # 内容创建向导（5 步流程）
│   │   ├── content/[id]/page.tsx  # 内容详情页
│   │   ├── history/page.tsx       # 历史记录
│   │   ├── settings/page.tsx      # 设置中心
│   │   └── api/                   # API 路由
│   │       ├── parse/route.ts     # 日报解析
│   │       ├── generate/route.ts  # 内容生成（SSE 流式）
│   │       ├── review/route.ts    # 合规审查
│   │       ├── export/route.ts    # 导出
│   │       ├── stats/route.ts     # 统计数据
│   │       ├── settings/route.ts  # 设置读写
│   │       ├── history/route.ts   # 历史内容查询
│   │       ├── reports/route.ts   # 日报查询
│   │       └── contents/[id]/     # 内容 CRUD
│   ├── components/                # 共享 UI 组件
│   └── lib/
│       ├── adapters/              # 平台格式化器（微信 HTML、小红书文本）
│       ├── compliance/            # 合规审查引擎（关键词扫描 + 正则匹配）
│       ├── db/                    # 数据库 Schema + 连接
│       ├── llm/                   # LLM 集成（报告解析、Prompt 构建、流式生成、审查）
│       ├── parser/                # Markdown 日报解析器（规则引擎）
│       ├── selector/              # 话题选取算法
│       └── types.ts               # 共享类型定义
├── drizzle.config.ts              # Drizzle ORM 配置
├── next.config.ts                 # Next.js 配置
└── package.json
```

## 数据库设计

| 表 | 说明 |
|----|------|
| `reports` | 上传的日报原文（Markdown） |
| `topics` | 从日报提取的话题（热度、核心数据、推荐标题） |
| `contents` | 生成的文章内容（平台、风格、状态、Markdown + HTML） |
| `reviews` | 合规审查结果（违规项、自动修正文本、是否通过） |
| `settings` | 应用配置（键值对：LLM 设置、内容风格等） |

内容状态流转：`draft` → `generated` → `reviewed` → `exported`

## 快速开始

### 前置要求

- Node.js 18+
- npm

### 安装与运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000 即可使用。

### 首次使用

1. 进入 **设置** 页面，配置 AI 服务商和 API Key
2. 进入 **创建** 页面，上传或粘贴 Markdown 格式日报
3. 系统自动解析话题，选择需要的话题后点击生成
4. 审查生成内容，通过合规检查后即可导出

### AI 服务配置

支持以下服务商：

| 服务商 | Base URL（示例） | 模型（示例） |
|--------|------------------|-------------|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| Anthropic | — | `claude-sonnet-4-20250514` |

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/parse` | 解析上传的日报 |
| `POST` | `/api/generate` | 流式生成内容（SSE） |
| `POST` | `/api/review` | 合规审查 |
| `POST` | `/api/export` | 导出内容 |
| `GET` | `/api/stats` | 获取仪表盘统计 |
| `GET/PUT` | `/api/settings` | 读写配置 |
| `GET` | `/api/history` | 查询历史内容 |
| `GET` | `/api/reports` | 查询日报列表 |
| `GET` | `/api/reports/[id]` | 查询单个日报及话题 |
| `GET/PUT` | `/api/contents/[id]` | 读写单篇内容 |

## 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint 检查 |
