# ContentForge 🔮

健康科普内容生产工具 —— 一键将热点日报转化为微信公众号和小红书内容。

## 技术栈
- **框架**: Next.js 15 (App Router)
- **样式**: Tailwind CSS 4
- **存储**: SQLite (better-sqlite3 + Drizzle ORM)
- **LLM**: Vercel AI SDK (支持 DeepSeek / OpenAI / Anthropic)
- **语言**: TypeScript

## 核心流程
```
上传日报 → 选题筛选 → AI双平台生成 → 合规审查 → 导出
```

## 开发
```bash
npm run dev     # 启动开发服务器
npm run build   # 构建
npm run start   # 生产模式运行
```

## 配置
首次使用前，在「配置中心」填入 LLM API Key（推荐 DeepSeek，性价比最高）。

## 项目结构
```
src/
├── app/                    # Next.js 页面 + API
│   ├── create/             # 新建内容（上传→选题→生成）
│   ├── settings/           # 配置中心
│   ├── history/            # 历史记录
│   └── api/                # API 路由
│       ├── parse/          # 日报解析
│       ├── generate/       # 流式生成
│       ├── review/         # 合规审查
│       ├── export/         # 导出
│       └── settings/       # 配置 CRUD
├── lib/                    # 核心逻辑
│   ├── parser/             # 日报解析器
│   ├── selector/           # 选题筛选
│   ├── llm/                # LLM 调用 + 提示词构建
│   ├── adapters/           # 平台适配（公众号HTML/小红书文本）
│   ├── compliance/         # 合规检查引擎
│   └── db/                 # 数据库 schema + 连接
└── prompts/                # 提示词模板
```
