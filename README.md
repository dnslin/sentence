# 句画

<p align="center">
  <a href="https://sentence.dnsl.in/" target="_blank">https://sentence.dnsl.in/</a>
</p>

句画是一个轻量产品原型：把一句随机短句和一幅非署名绘本风画面组合成可分享的图文卡片。

## 在线预览

访问已部署站点：

- **正式站点**: https://sentence.dnsl.in/

## 本地启动

前置要求：

- Node.js >= 22.17.0
- pnpm

安装依赖并启动开发服务器：

```bash
pnpm install
pnpm dev
```

启动后打开：

- 首页: http://localhost:3000
- 原型比较: http://localhost:3000/prototype

## 环境变量

根目录创建 `.env`（运行 worker 或生产部署必需）：

```text
XAI_API_KEY=your_xai_api_key
XAI_BASE_URL=                       # 可选，默认 https://api.x.ai/v1
JUHUA_ADMIN_TOKEN=your_secret_token # 可选，用于 /api/admin/status
```

## Docker 部署

项目提供 Docker Compose 编排，包含 `web` 与 `worker` 两个服务，共享 SQLite 数据库与生成图片目录。

### 本地构建运行

```bash
docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml up -d
```

### 使用预构建镜像

推送 `v*.*.*` 标签后会自动构建镜像并发布到 `ghcr.io/dnslin/sentence:<tag>`：

```bash
docker compose -f docker/docker-compose.remote.yml pull
docker compose -f docker/docker-compose.remote.yml up -d
```

详细说明见 [`docker/README.md`](docker/README.md)。

## 项目脚本

```bash
pnpm build              # 生产构建
pnpm start              # 生产启动（自动 db:setup）
pnpm lint               # ESLint
pnpm typecheck          # TypeScript 类型检查
pnpm format             # 格式化

pnpm db:generate        # 生成 drizzle 迁移 SQL
pnpm db:migrate         # 执行迁移
pnpm db:seed            # 种子 ready 卡片
pnpm db:setup           # 迁移 + 种子

pnpm worker:ready-pool  # 启动生成 worker
```

## 原型变体

`/prototype` 是抛弃式 UI 原型路由，可通过 `?variant=` 比较三个方向：

- `quiet-gallery`
- `immersive-stage`
- `paper-desk`

缺失、无效或重复的 `variant` 会回退到 `quiet-gallery`。

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn UI
- SQLite + Drizzle ORM
- xAI (Grok) image generation

## shadcn UI 组件

新增组件时，先通过 CLI 生成到 `components/ui/`：

```bash
pnpm dlx shadcn@latest add button
```

在页面或组件中从本地文件导入生成后的 primitive：

```tsx
import { Button } from "@/components/ui/button"
```

优先复用已有 primitive；例如链接型 CTA 使用 `Button` 的 `asChild` 包裹 Next.js `Link`，避免重复焦点和交互样式。
