# Design: Docker 部署

## Architecture

采用 Trellis ADR 描述的目标形态：同一镜像承载两个运行时角色。

- **web** 容器：运行 `pnpm start`（实际等价于 `db:setup && next start`），监听 `0.0.0.0:3000`。
- **worker** 容器：运行 `pnpm worker:ready-pool`，每 60s 检查 ready 卡池并补充。
- 两者挂载同一个 `juhua-data` 命名卷到 `/app/data`。

## Image

多阶段 `Dockerfile`：

- **base** 阶段：安装 pnpm 9.x、openssl（`node:sqlite` / `node:crypto` 依赖 glibc 环境，Debian 基础镜像自带）。
- **deps** 阶段：复制 `package.json + pnpm-lock.yaml`，执行 `pnpm install --frozen-lockfile --prod=false`，完整依赖因为 worker 需要 build artifacts 运行。
- **builder** 阶段：基于 deps 复制源码，设置 `ENV NEXT_TELEMETRY_DISABLED=1`，运行 `pnpm build`。
- **runner** 阶段：从 builder 复制 `.next/standalone`、public、package.json、pnpm-lock.yaml、node_modules、scripts、drizzle、data（占位目录），并安装 `dumb-init` 作为 PID 1。

Next.js 16 默认 standalone 输出包含最小运行时；我们额外保留完整 `node_modules` 确保自定义 server scripts（`scripts/migrate.ts` 等）能使用 tsx。

## Compose

- 使用 `docker-compose.yml`（v3.8），便于单机 Docker 使用。
- image 名称 `juhua:latest`，build context 为根目录。
- `web` 服务：端口 `3000:3000`，依赖环境变量文件 `.env`，卷 `juhua-data:/app/data`。
- `worker` 服务：命令覆盖 `pnpm worker:ready-pool`，同样挂载 `juhua-data:/app/data`。
- restart policy: `unless-stopped`。

## 数据持久化

- 命名卷 `juhua-data` 挂载到 `/app/data`。
- `lib/db/client.ts` 默认 `data/juhua.sqlite`；`JUHUA_GENERATED_ILLUSTRATIONS_DIR` 默认 `data/generated-illustrations`，因此两个服务自然共享。
- 不将本地 `data/` 目录 COPY 进镜像，避免构建机数据污染线上环境；容器中首次启动时 `ensureDatabaseDirectory` 会创建目录。

## 环境变量

由用户在项目根目录放置 `.env`：

```text
XAI_API_KEY=...
XAI_BASE_URL=                  # 可选
JUHUA_ADMIN_TOKEN=             # 可选
```

## 迁移与种子

`package.json` 中 `start` 脚本是 `"db:setup && next start"`，web 容器启动即会迁移 + 种子，worker 共享同一数据库，无需重复执行。

## 升级流程

1. `git pull`（或替换源码）。
2. `docker compose build --no-cache`。
3. `docker compose up -d`。
4. web 容器会自动执行 `db:migrate`，应用新的 drizzle SQL。

## 安全与兼容性

- 不暴露 SQLite 到外网端口。
- 不出于 Docker 改动业务代码、路由或 API 响应。
- 保持开发命令（`pnpm dev`）不变。
