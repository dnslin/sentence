# Implement: Docker 部署

## Checklist

1. [ ] 确认 `package.json` 关键脚本与依赖（`start`、`worker:ready-pool`、`db:setup`）。
2. [ ] 创建 `.dockerignore`。
3. [ ] 创建 `Dockerfile`（多阶段 build → runner）。
4. [ ] 创建 `docker-compose.yml`（web + worker + 共享卷）。
5. [ ] 验证 `next.config.ts` 已开启或兼容 `output: 'standalone'`。
6. [ ] 运行 `docker compose build`。
7. [ ] 运行 `docker compose up` 并测试首页与 API。
8. [ ] 验证数据持久化：down/up 后数据仍在。
9. [ ] 更新 `CLAUDE.md` 部署章节。
10. [ ] 收尾：trellis-check、commit。

## 风险与回滚

- `node:sqlite` 在默认 Node 22 Debian 镜像中可用，无需额外安装 SQLite 库。
- 若 build 失败，检查 pnpm-lock.yaml 是否已提交，以及 `node_modules/.modules.yaml` 是否被 `.dockerignore` 忽略。
- 回滚：删除 `Dockerfile`、`docker-compose.yml`、`.dockerignore`，并恢复 `CLAUDE.md`。

## 验证命令

```bash
# 构建
docker compose build

# 启动（需要 .env 文件包含 XAI_API_KEY）
docker compose up -d

# 健康检查
curl -f http://localhost:3000/api/ready-card
curl -f http://localhost:3000/

# 查看 worker 日志
docker compose logs -f worker

# 验证持久化
docker compose down
docker compose up -d
```
