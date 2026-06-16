# 执行计划：受保护的运营状态页面与状态 API

> 方法：TDD 垂直切片（clear.md）。一次一个行为，红→绿→重构。禁止先写全部测试再写全部实现。
> 测试命令：新增 `pnpm test:admin-status`（node:test，文件位于 `node-tests/admin-status.test.ts`）。

## 文件清单（全部新增，除标注外）

- `lib/admin/admin-auth.ts` — 认证模块
- `lib/admin/admin-status-contract.ts` — 共享响应类型与 guard
- `lib/admin/operational-status.ts` — 数据收集模块
- `app/api/admin/status/route.ts` — JSON API
- `app/admin/status/page.tsx` — 受保护页面（Server Component）
- `app/admin/status/admin-status-view.tsx` — 页面展示子组件（纯展示，吃 OperationalStatus）
- `node-tests/admin-status.test.ts` — 单元/集成行为测试
- `tests/admin-status.spec.ts` — Playwright e2e（拒绝态 + 允许态）
- `package.json`（改）— 增加 `test:admin-status` 脚本
- `playwright.config.ts`（改）— `webServer.env` 注入 `JUHUA_ADMIN_STATUS_TOKEN`

## TDD 顺序（每步一个红→绿循环）

### Tracer bullet：认证拒绝端到端

1. **RED** `verifyAdminStatusToken`：未配置 token（configured=null）→ `{authorized:false, reason:"not_configured"}`，即使 presented 有值也拒绝。
   **GREEN** 实现 `resolveAdminStatusToken` + `verifyAdminStatusToken` 的未配置分支。

### 认证模块增量

2. **RED** presented 为 null/空 且 configured 有值 → `missing_token`。
   **GREEN** 加 missing 分支。
3. **RED** presented 与 configured 不等 → `invalid_token`；相等 → `authorized:true`。用恒定时间比较（sha256+timingSafeEqual）。
   **GREEN** 实现比较。
4. **RED** `extractPresentedAdminToken`：`Authorization: Bearer X` 提取 `X`；无 header 时从 `?token=Y` 提取 `Y`；header 优先；scheme 大小写不敏感；空值→null。
   **GREEN** 实现提取。
5. **RED** `authorizeAdminStatusRequest`：组合 extract + resolve + verify，端到端从 Request 得结论。
   **GREEN** 组合实现。

### 数据收集增量

6. **RED** `collectOperationalCounts`：种入 N 个 ready 卡 + 若干 failed / started / prompt_fallback / image_generated 尝试 → counts 精确匹配（ready 复用公开口径，inProgress 只含 started+prompt_fallback）。
   **GREEN** 实现计数查询。
7. **RED** `collectRecentGenerationErrors`：仅取 failed，按 updatedAt desc，limit 生效，message 经 sanitize（注入含 `Bearer <secret>` 的脏 message，断言被 `[redacted]`），暴露 stage/occurredAt，不含 prompt_text/sha256。
   **GREEN** 实现查询 + 二次 sanitize。
8. **RED** `collectStorageIndicators`：注入 statBytes/listIllustrationFiles 桩；DB 存在报大小、不存在报 exists:false；图片目录只数合法 webp 并累加大小；返回结构不含绝对路径字段。
   **GREEN** 实现存储指标（注入式边界，默认实现用 node:fs/promises + 现有路径解析器）。
9. **RED** `collectOperationalStatus`：编排三者 + generatedAt（注入 now）。
   **GREEN** 组合实现。

### API 路由增量

10. **RED** 未授权 GET → 401 + `admin_status_unauthorized` + `WWW-Authenticate` 头，体不含运营数据；通过 `route.ts` 的 `GET(new Request(...))` 直接调用。
    **GREEN** 实现 401 分支（认证先行，不开 DB）。
11. **RED** 已授权（注入 env token + Bearer）→ 200 + `AdminStatusResponse` 形状，计数与种子一致。
    **GREEN** 实现授权分支（开 DB、收集、关闭）。
12. **RED** contract guard：`isAdminStatusResponse` / `isAdminStatusUnauthorizedResponse` 正确收窄。
    **GREEN** 实现 guard。

### 页面与展示

13. 页面 `page.tsx` + `admin-status-view.tsx`：未授权渲染未授权区块（无数据），授权渲染计数/错误/存储。展示组件为纯函数，e2e 覆盖渲染行为，单元层不强测 RSC。

### e2e（Playwright，拒绝 + 允许）

14. `tests/admin-status.spec.ts`：
    - 无 token 访问 `/admin/status` → 看到未授权文案，看不到计数标签。
    - `GET /api/admin/status` 无 token → 401。
    - 带正确 token（来自 webServer.env）访问页面与 API → 看到计数/状态。

### 配置改动

15. `package.json` 增 `test:admin-status`；`playwright.config.ts` 注入 `JUHUA_ADMIN_STATUS_TOKEN`。

## 验证命令（每个增量后跑相关项，收尾全跑）

```bash
pnpm test:admin-status     # node:test 行为测试
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e              # 含 admin-status.spec.ts
```

## 审查门（review gates）

- 认证完成后：确认未配置默认拒绝 + 恒定时间比较，无 token 回显。
- 数据收集完成后：确认无 secret/绝对路径泄露，inProgress 口径与 design 一致。
- 收尾前：跑全套验证命令，全绿才算完成。

## 回滚点

- 任一增量出问题：`git checkout -- <file>` 单文件回退；该步无 DB 迁移。
- 整体回滚：删新增文件 + 还原 package.json / playwright.config.ts。
