# 技术设计：受保护的运营状态页面与状态 API

## 架构总览

```text
请求 (Bearer header 或 ?token=)
  → lib/admin/admin-auth.ts            认证：恒定时间比较，未配置即拒绝
  → lib/admin/operational-status.ts    数据：计数 + 最近错误 + 存储指标（纯读，注入式边界）
  → app/api/admin/status/route.ts      JSON API（401 / 200）
  → app/admin/status/page.tsx          服务端渲染受保护页面（复用同一认证+数据源）
```

设计原则：认证与数据收集都做成**可注入、可单测的纯函数模块**，路由与页面只是薄适配层。这让 node:test 能直接测核心行为，不必起 HTTP 服务，符合「测试公共接口、能在重构中存活」的要求。

## 模块边界与契约

### 1. `lib/admin/admin-auth.ts`（认证）

```typescript
export const adminStatusTokenEnvKey = "JUHUA_ADMIN_STATUS_TOKEN"

export type AdminAuthResult =
  | { authorized: true }
  | { authorized: false; reason: "not_configured" | "missing_token" | "invalid_token" }

// 从环境读取配置 token；空白/缺失视为未配置
export function resolveAdminStatusToken(env?: NodeJS.ProcessEnv): string | null

// 恒定时间比较两个候选 token 与配置 token
export function verifyAdminStatusToken(input: {
  presentedToken: string | null
  configuredToken: string | null
}): AdminAuthResult

// 从 Web Request 提取候选 token：先 Authorization: Bearer，再 ?token=
export function extractPresentedAdminToken(request: Request): string | null

// 一站式：从 request + env 得出授权结论
export function authorizeAdminStatusRequest(input: {
  request: Request
  env?: NodeJS.ProcessEnv
}): AdminAuthResult
```

恒定时间比较实现要点：
- 用 `crypto.timingSafeEqual`，它要求两 Buffer 等长，否则抛错。
- 因此先对两侧做 `sha256` 摘要再比较——摘要恒为 32 字节，既规避长度泄露，又让长度差不导致提前返回。
- `configuredToken` 为 `null`（未配置）→ 直接 `not_configured`，不进入比较。
- `presentedToken` 为 `null`/空串 → `missing_token`。

`extractPresentedAdminToken`：
- `Authorization` 头匹配 `^Bearer (.+)$`（忽略大小写的 scheme），取捕获组并 trim；空则视为无。
- 否则用 `new URL(request.url).searchParams.get("token")`，trim；空则 `null`。
- header 优先于 query。

### 2. `lib/admin/operational-status.ts`（数据收集）

```typescript
export type OperationalCounts = {
  ready: number
  failed: number
  inProgress: number
}

export type RecentGenerationError = {
  attemptId: string
  stage: string | null       // generation_attempts.error_stage（已是受控枚举或 null）
  message: string | null     // 再次 sanitize 后的 error_message
  occurredAt: string         // updated_at 的 ISO 字符串
}

export type StorageIndicator =
  | { kind: "database"; exists: boolean; byteLength: number }
  | { kind: "generated_illustrations"; exists: boolean; fileCount: number; byteLength: number }

export type OperationalStatus = {
  counts: OperationalCounts
  recentErrors: RecentGenerationError[]
  storage: { database: StorageIndicator; generatedIllustrations: StorageIndicator }
  generatedAt: string
}

export const recentGenerationErrorLimit = 10

// 计数：复用 countPublicReadyCards；failed / inProgress 用 Drizzle count + 状态过滤
export async function collectOperationalCounts(client: DatabaseClient): Promise<OperationalCounts>

// 最近错误：status='failed' 取 limit 条，按 updated_at desc；message 再 sanitize
export async function collectRecentGenerationErrors(input: {
  client: DatabaseClient
  limit?: number
}): Promise<RecentGenerationError[]>

// 存储指标：注入 statFile / listDir 以便测试；生产用 node:fs/promises
export async function collectStorageIndicators(input?: {
  resolveDatabasePath?: () => string
  resolveIllustrationRoot?: () => string
  statBytes?: (path: string) => Promise<number | null>      // 不存在→null
  listIllustrationFiles?: (root: string) => Promise<string[] | null> // 目录不存在→null
}): Promise<OperationalStatus["storage"]>

// 顶层编排
export async function collectOperationalStatus(input: {
  client: DatabaseClient
  now?: () => Date
  recentErrorLimit?: number
  storage?: Parameters<typeof collectStorageIndicators>[0]
}): Promise<OperationalStatus>
```

in-progress 口径：`generation_attempts.status IN ('started', 'prompt_fallback')`。
- `image_generated` 不计入 in-progress（它已产出图片，属于成功侧的中间态，但本 slice 的「进行中」聚焦尚未成片且未失败的尝试）。
- 在 design 中固定该口径，避免实现期摇摆。

存储指标安全：
- 仅暴露 `exists` / `byteLength` / `fileCount`，**不**在返回结构中放绝对路径。
- 图片文件计数复用 `isValidGeneratedIllustrationFilename` 过滤，只数合法 `.webp`。

### 3. `app/api/admin/status/route.ts`（JSON API）

```typescript
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<NextResponse>
```

流程：
1. `authorizeAdminStatusRequest({ request })`；若 `!authorized` → `401`，体为 `AdminStatusUnauthorizedResponse`（仅含 `error: "admin_status_unauthorized"` + 安全文案），并带 `WWW-Authenticate: Bearer` 头。**不创建数据库连接**（认证先行，避免无谓开销）。
2. 授权通过 → `createDatabaseClient()`，`try { collectOperationalStatus } finally { close }`。
3. 返回 `200` `AdminStatusResponse`。

类型在 `lib/admin/admin-status-contract.ts` 内集中定义并提供 guard（与 `public-ready-card.ts` 风格一致），供页面、API、测试共享。

### 4. `app/admin/status/page.tsx`（受保护页面）

- Server Component，`searchParams` 读取 `token`。Next 16 中 `searchParams` 为 Promise，需 `await`。
- 构造一个最小 `Request`（用 token 拼出 URL）交给 `authorizeAdminStatusRequest`，或直接调用 `verifyAdminStatusToken`（页面侧用 query token + env）。为复用同一判定，页面侧调用 `verifyAdminStatusToken({ presentedToken, configuredToken })`。
- 未授权 → 渲染「未授权」区块（标题 + 安全说明，无任何运营数据），HTTP 仍是 200 的页面（Server Component 难以自定义状态码且非必需；安全保证来自不渲染数据）。
- 授权 → `createDatabaseClient()`，收集状态，渲染计数卡片、最近错误列表、存储指标，`finally` 关闭连接。
- `dynamic = "force-dynamic"`，避免静态化缓存运营数据。

### 5. 契约类型 `lib/admin/admin-status-contract.ts`

```typescript
export type AdminStatusResponse = { status: OperationalStatus }
export type AdminStatusUnauthorizedResponse = {
  error: "admin_status_unauthorized"
  message: string
}
export function isAdminStatusResponse(v: unknown): v is AdminStatusResponse
export function isAdminStatusUnauthorizedResponse(v: unknown): v is AdminStatusUnauthorizedResponse
```

## 数据流与查询

- ready：`countPublicReadyCards(client)`（已存在，复用）。
- failed：`select count() from generation_attempts where status='failed'`。
- inProgress：`select count() from generation_attempts where status in ('started','prompt_fallback')`。
- recentErrors：`select id, errorStage, errorMessage, updatedAt from generation_attempts where status='failed' order by updatedAt desc, id desc limit N`。
- storage.database：`resolveDatabasePath()` + `fs.stat`（WAL 模式下只报主 `.sqlite` 文件大小，作为「有用级别」指标即可）。
- storage.generatedIllustrations：`resolveGeneratedIllustrationRoot()` + `readdir` 过滤合法 webp，对每个文件 `stat` 累加大小。

## 类型安全策略

- 所有 Drizzle 查询用 select 投影，返回类型由 schema 推断。
- `count()` 结果 `row?.value ?? 0` 兜底。
- 注入的 `statBytes` / `listIllustrationFiles` 用显式返回类型；不存在路径返回 `null` 而非抛错。
- 路由对 `request` 来源数据（header / query）始终当作可能为 `null` 的字符串处理。
- 不使用 `any`；外部/未知数据经 guard 收窄。

## 兼容性与回滚

- 纯新增文件 + 一处 `package.json` 脚本 + 一处 Playwright env 注入；不改现有运行时行为。
- 回滚 = 删除新增文件、撤销 package.json / playwright 改动。无数据库迁移，无 schema 变更，回滚零风险。

## 安全设计审查（自检）

- 新增受 token 保护的端点：默认拒绝（未配置 token 即拒绝），恒定时间比较，错误响应不回显 token、不泄露 secret/路径。满足受保护语义。
- 这是「展示运营健康」的只读端点，无写操作、无副作用。
