# 受保护的运营状态页面与状态 API

> GitHub issue #14 · [Slice 13] Add protected status page for inventory and generation health
> Blocked by #9（已 CLOSED）。覆盖 user stories 39, 40, 41, 42, 55。

## Goal

为站点所有者提供一个受 admin token 保护的运营状态视图：展示 ready / failed / in-progress 计数、最近的生成错误（不泄露密钥），以及数据库与图片目录的基础存储指标。未携带有效 token 的请求不能访问运营状态。

## Scope

交付两层（用户已确认「受保护页面 + 底层 API」）：

1. `GET /api/admin/status` — 返回结构化 JSON 的运营状态接口。
2. `/admin/status` — 服务端渲染的受保护页面，复用同一状态数据源。

认证方式（用户已确认「Bearer header + query param 双支持」）：

- 环境变量 `JUHUA_ADMIN_STATUS_TOKEN` 提供 admin token。
- API 接受 `Authorization: Bearer <token>`。
- 浏览器页面访问接受 `?token=<token>` query 参数（同时也接受 Bearer header）。
- token 比较使用恒定时间比较（`crypto.timingSafeEqual`），避免时序侧信道。

## Requirements

### 认证与授权

- 未配置 `JUHUA_ADMIN_STATUS_TOKEN`（缺失或空白）时，所有运营状态访问一律拒绝（视为未授权），即使请求未带 token。绝不因为「服务端没配 token」而默认放行。
- 未携带 token、token 为空、或 token 不匹配时：API 返回 `401`，页面渲染「未授权」状态，均不暴露任何运营数据。
- token 校验必须恒定时间比较，长度不同也不能提前返回导致时序泄露。
- 认证失败响应不得回显用户提交的 token、不得透露正确 token 的任何特征。

### 状态数据内容

- **计数**（均为数据库事实）：
  - `ready`：复用公开 ready-card 资格口径（`countPublicReadyCards`）。
  - `failed`：`generation_attempts.status = 'failed'` 的行数。
  - `inProgress`：`generation_attempts.status IN ('started', 'prompt_fallback')` 的行数（尚未产出图片、也未失败的进行中尝试）。
- **最近生成错误**：取最近若干条（默认 10 条）`status = 'failed'` 的 `generation_attempts`，按 `updated_at` 倒序，每条暴露 `errorStage`、已脱敏的 `errorMessage`、`updatedAt`。绝不暴露 `prompt_text`、`image_sha256`、`XAI_API_KEY` 或任何 secret。即使持久化时已脱敏，状态边界仍需再次 `sanitizeErrorMessage` 做防御性处理。
- **存储指标**：
  - 数据库：SQLite 文件是否存在、字节大小。
  - 图片目录：生成插画目录是否存在、其中合法 `.webp` 文件数量、合计字节大小。
  - 指标以「有用的级别」呈现，不暴露绝对文件系统路径给客户端响应体。

### 约束

- 复用现有仓库与 helper，不新建数据库表，不新增迁移（全部读现有 `cards` / `sentences` / `generation_attempts` 表与现有存储目录解析器）。
- 严格 TypeScript 类型安全：边界数据按 `unknown` 处理并经类型守卫收窄；响应负载用强类型；不使用 `any`、不使用非空断言绕过、不使用不安全 `as` 造假。
- 不允许最小化实现：页面、API、认证、计数、错误、存储指标、测试全部完整交付。
- 公开错误文案与运营文案分层：运营页面是给所有者看的，可以显示技术级别的 stage/计数，但仍不得泄露 secret 或绝对路径。
- API 路由 `runtime = "nodejs"`、`dynamic = "force-dynamic"`，与现有路由一致；使用后即 `client.sqlite.close()`。

## Acceptance Criteria

- [ ] 未携带有效 admin token 的请求无法访问运营状态（API `401`，页面未授权态），且响应体不含任何计数 / 错误 / 存储数据。
- [ ] 已认证访问可见 ready、failed、in-progress 三类计数，数值与数据库事实一致。
- [ ] 最近生成错误可见且不暴露 secret（无 API key、无 bearer/sk token、无 prompt 原文、无 sha256）。
- [ ] 数据库与图片目录的存储指标在「有用级别」可见（存在性、大小、文件数），且响应体不含绝对路径。
- [ ] 测试覆盖「拒绝访问」与「允许访问」两条路径；并覆盖未配置 token 时一律拒绝。
- [ ] `JUHUA_ADMIN_STATUS_TOKEN` 未配置时一律拒绝（不默认放行）。
- [ ] token 比较为恒定时间比较。
- [ ] `pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm test:e2e`、新增 `pnpm test:admin-status` 全部通过。

## Out of Scope

- 不做 admin 登录会话 / cookie 管理（用户选择 query param + Bearer，不引入表单+cookie）。
- 不做状态数据的写操作、重试触发、手动补货按钮。
- 不做多用户 / 角色权限体系（单一 owner token）。
- 不修改 worker、生成管线、公开 ready-card 路径的既有行为。

## Notes

- TDD（clear.md）：垂直切片，一次一个行为，红→绿→重构。tracer bullet 先打通「认证拒绝」端到端。
- node:test 测试文件放在 `node-tests/`（避免被 Playwright 的 `testDir: "./tests"` 收录）。
- 新增 `JUHUA_ADMIN_STATUS_TOKEN` 需在 Playwright `webServer.env` 注入，e2e 才能验证允许态。
