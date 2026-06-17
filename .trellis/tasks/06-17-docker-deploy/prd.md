# Docker 部署 support：web + worker + SQLite 数据持久化

## Goal

让项目可以用 Docker Compose 一键部署到单机（本地或 VPS），web 服务和 worker 服务共享同一个镜像，SQLite 数据库与生成图片通过命名卷持久化。

## Requirements

- 提供可构建的 `Dockerfile`，基于 Node.js 22，使用 pnpm 安装依赖。
- 提供 `docker-compose.yml`，同时启动 `web` 与 `worker` 两个服务，共享同一个镜像和同一个数据卷。
- `web` 服务暴露 `3000` 端口，运行生产构建后的 Next.js 应用，并自动执行数据库迁移与种子（`db:setup`）。
- `worker` 服务运行 `pnpm worker:ready-pool`，持续补充图文卡片池。
- SQLite 数据库文件（默认 `data/juhua.sqlite`）与生成图片目录（默认 `data/generated-illustrations`）必须持久化到命名卷，容器重建后不丢失。
- 提供 `.dockerignore`，排除 `node_modules`、本地 `.next`、`data/*`、测试数据等。
- 部署文档写入 `CLAUDE.md`，说明如何构建、启动、配置环境变量、升级。
- 不引入新的产品语义或破坏现有 API / 页面行为。

## Acceptance Criteria

- [ ] `docker compose build` 成功。
- [ ] `docker compose up` 启动后 `curl http://localhost:3000/api/ready-card` 返回合法 JSON；页面 `http://localhost:3000` 可访问。
- [ ] worker 容器持续运行并正确识别已持久化的数据库与图片目录（可在日志中看到轮询）。
- [ ] 停止并 `docker compose down` 后重新 `up`，之前的 SQLite 数据和图片文件仍然保留。
- [ ] `.trellis/spec/` 或 `CLAUDE.md` 中已记录部署指令。

## Notes

- 项目当前使用 Next.js 16 + React 19 + pnpm + `node:sqlite` + Tailwind v4。
- `XAI_API_KEY` 是 worker 实际生成图片的必需变量，部署时必须由用户配置。
- `JUHUA_ADMIN_TOKEN` 可选，仅影响 `/api/admin/status` 的访问。
