# GitHub Actions：推送 tag 构建 amd64 Docker 镜像并发布 Release

## Goal

当仓库推送一个语义化版本 tag（如 `v1.2.3`）时，GitHub Actions 自动构建 linux/amd64 平台的 Docker 镜像，并将镜像推送到 GitHub Container Registry（ghcr.io），同时在该 tag 上发布一个 GitHub Release。

## Requirements

- 新增 workflow 文件 `.github/workflows/release.yml`。
- 触发条件：推送匹配 `v*.*.*` 的 tag。
- 镜像构建：
  - 使用 `docker/build-push-action`。
  - 目标平台仅 `linux/amd64`。
  - 基于仓库根目录的 `docker/Dockerfile`。
  - tag 同时打上 `ghcr.io/<owner>/<repo>:<git-tag>` 和 `ghcr.io/<owner>/<repo>:latest`。
- GitHub Release：
  - 使用 `softprops/action-gh-release` 或 `actions/create-release`。
  - Release 标题使用 tag 名（如 `v1.2.3`）。
  - 自动生成 release notes / body，允许后续手动补充。
- 默认使用 `GITHUB_TOKEN` 完成 ghcr 登录和 Release 创建，无需用户配置 PAT。
- 保持 workflow 简洁，不引入第三方市场的未经验证 action（优先使用官方或知名 action）。
- 不修改 Dockerfile、docker-compose.yml 等业务部署配置，仅新增 CI/CD 流程。

## Acceptance Criteria

- [ ] `.github/workflows/release.yml` 文件存在，语法通过 GitHub Actions schema 校验。
- [ ] 推送 `v0.1.0` 格式的 tag 后 workflow 被触发。
- [ ] workflow 成功登录 ghcr、构建并推送 amd64 镜像。
- [ ] workflow 在同一 tag 上创建 GitHub Release。
- [ ] `docker/README.md` 和/或 `CLAUDE.md` 已补充镜像拉取与版本升级说明。

## Notes

- 仓库已通过 Docker Compose 支持本地部署；CI 镜像应当与本地镜像一致（同一 Dockerfile）。
- 由于只需要 `linux/amd64`，不需要 `docker/setup-buildx-action` 的 QEMU 支持，但仍使用 buildx 以获得缓存、标签等能力。
