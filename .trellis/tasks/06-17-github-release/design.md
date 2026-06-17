# Design: GitHub Actions release workflow

## Trigger

```yaml
on:
  push:
    tags:
      - "v*.*.*"
```

## Jobs

单 job `release`：

1. **Checkout** — `actions/checkout@v4`，默认 fetch 完整历史以生成 release notes。
2. **Docker metadata** — `docker/metadata-action@v5`，动态生成镜像标签。
   - `type=semver,pattern={{version}}` → `1.2.3`
   - `type=semver,pattern={{major}}.{{minor}}` → `1.2`
   - `type=raw,value=latest,enable={{is_default_branch}}` 或直接 always latest；为了简单，这里固定 latest。
3. **Login to GHCR** — `docker/login-action@v3` 使用 `GITHUB_TOKEN`。
4. **Set up Buildx** — `docker/setup-buildx-action@v3`，用于多标签构建与缓存（无需 QEMU，只 amd64）。
5. **Build & push** — `docker/build-push-action@v6`：
   - `context: .`
   - `file: ./docker/Dockerfile`
   - `platforms: linux/amd64`
   - `push: true`
   - `tags` 来自 metadata-action 输出
6. **Create Release** — `softprops/action-gh-release@v2`：
   - `tag_name: ${{ github.ref_name }}`
   - `name: ${{ github.ref_name }}`
   - `generate_release_notes: true`

## Image coordinates

默认使用 `ghcr.io/${{ github.repository }}`，即 `ghcr.io/<owner>/sentence`。

## Permissions

Workflow 需要：

```yaml
permissions:
  contents: write      # 创建 Release
  packages: write      # 推送 ghcr 镜像
```

## Secrets

使用内置 `GITHUB_TOKEN`，无需用户手动配置 secrets。

## Caching

启用 `cache-from: type=gha` / `cache-to: type=gha,mode=max`，加速后续构建。

## 与现有部署的关系

- 该 workflow 产出 ghcr 镜像，主要用于 VPS 直接 `docker pull`。
- 本地 `docker compose build` 仍可继续使用；可以在 VPS 上改成 `docker compose pull` 并基于预构建镜像启动。
- 不改动 `docker/docker-compose.yml`，但会在文档中说明如何切换为远程镜像。
