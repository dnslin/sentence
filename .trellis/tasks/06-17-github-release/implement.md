# Implement: GitHub Actions release workflow

## Checklist

1. [ ] 确认仓库当前无现有 `.github/workflows`，决定文件路径与命名。
2. [ ] 创建 `.github/workflows/release.yml`。
3. [ ] 确认 `docker/Dockerfile` 路径正确，可直接用于 build-push-action。
4. [ ] 在 `docker/README.md` 中补充 CI 构建出的 ghcr 镜像拉取/升级说明。
5. [ ] 在 `CLAUDE.md` 中引用新的 release 流程文档。
6. [ ] 本地运行 actionlint（如有）或至少 `pnpm lint` 不报错。
7. [ ] 提交并记录任务完成。

## 风险与回滚

- `softprops/action-gh-release` 是社区 action，若不可信可替换为 `gh release create` 命令；但它是当前最广泛使用的 release action。
- 如果 tag 被误推，会触发构建和 release。这是 tag 触发 workflow 的固有风险，可通过 GitHub Actions 设置或删除 release 回滚。
- 回滚：删除 `.github/workflows/release.yml` 及文档改动，并删除已推送到 ghcr 的镜像标签。

## 验证

 workflow 无法在非 GitHub 环境完整运行，最终验证需在 GitHub 仓库推送测试 tag。本地至少保证 YAML 语法无错误。
