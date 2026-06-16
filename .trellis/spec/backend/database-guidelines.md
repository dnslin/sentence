# Database Guidelines

> Database patterns and executable contracts for this project.

---

## Scenario: Ready-card SQLite store with Drizzle

### 1. Scope / Trigger

Use this contract when a change touches the local ready-card database path, Drizzle schema, migrations, seeding, the public ready-card API, or homepage data loading.

This applies to the first ready 图文卡片 path:

```text
SQLite row → Drizzle repository → PublicReadyCard DTO → GET /api/ready-card
                                      ↘ app/page.tsx → homepage card
```

### 2. Signatures

**Runtime**

- Node.js `>=22.17.0` is required because the ready-card database path uses `node:sqlite` and `StatementSync#setReturnArrays(true)`.

**Environment key**

- `JUHUA_DATABASE_PATH?: string` — optional local SQLite file path.
- Default when unset: `process.cwd()/data/juhua.sqlite`.

**Package scripts**

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "tsx scripts/migrate.ts",
  "db:seed": "tsx scripts/seed-ready-card.ts",
  "db:setup": "pnpm db:migrate && pnpm db:seed",
  "dev": "pnpm db:setup && next dev",
  "start": "pnpm db:setup && next start",
  "test:e2e": "playwright test",
  "test:rate-limit": "node --import tsx --test node-tests/rate-limit.test.ts"
}
```

**Database client**

```typescript
const client = createDatabaseClient()
try {
  // use client.db for Drizzle reads/writes
} finally {
  client.sqlite.close()
}
```

**Tables**

- `sentences(id text primary key, text text, source text, created_at integer)`.
- `cards(id text primary key, sentence_id text, status text check(status in ('ready')), scene_label text, accent text check(accent in ('dawn','rain','moon')), illustration_path text nullable, style_version text, created_at integer, updated_at integer)` with `cards_ready_lookup_idx(status, created_at, id)`.
- `ready_card_views(id text primary key, visitor_key text, card_id text references cards(id), seen_at integer)` with `ready_card_views_recent_idx(visitor_key, seen_at)` and `ready_card_views_card_idx(visitor_key, card_id, seen_at)`.

**Public API**

- `GET /api/ready-card`
- Success payload:

```typescript
type ReadyCardResponse = {
  card: {
    id: string
    sentence: string
    sceneLabel: string
    accent: "dawn" | "rain" | "moon"
    status: "ready"
    illustrationUrl: string | null
  }
}
```

- Empty-stock public error payload:

```typescript
type ReadyCardErrorResponse = {
  error: "ready_card_not_found"
  message: string
}
```

`message` must be calm public Chinese copy. It must not mention local store, `pnpm db:setup`, SQLite/database internals, generation stack traces, model/provider errors, or setup commands.

### 3. Contracts

- SQLite WAL must be enabled on the actual runtime SQLite connection with `PRAGMA journal_mode = WAL` before Drizzle queries run.
- SQLite foreign keys must be enabled on every runtime connection with `PRAGMA foreign_keys = ON`; declared references such as `ready_card_views.card_id -> cards.id` are otherwise not enforced by SQLite.
- Runtime reads and seed/upsert writes must use Drizzle APIs through the shared client; raw SQL is allowed only for the migration runner that applies committed SQL files.
- Current Drizzle package access uses `drizzle-orm/sqlite-proxy` with a `DatabaseSync` adapter because the installed `drizzle-orm@0.45.2` does not expose `drizzle-orm/node-sqlite` in this project; the adapter must return array rows in SQL selected-column order via `statement.setReturnArrays(true)`.
- Migration SQL files live under `drizzle/` and are committed.
- Local SQLite files are ignored (`data/*.sqlite*`, `data/*.db*`, `test-data/`); migrations are not ignored.
- The seed must be idempotent and transactional: repeated `pnpm db:seed` must not create duplicate user-visible cards or leave sentence/card rows half-updated.
- UI code must consume `PublicReadyCard` / `ReadyCardResponse` from `lib/cards/public-ready-card.ts`; it must not parse database rows or duplicate API payload types.
- The homepage may load the shared server-side repository directly in a Server Component; it does not need to HTTP-fetch its own `/api/ready-card` route.

### 4. Validation & Error Matrix

| Condition                            | Required behavior                                                                                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JUHUA_DATABASE_PATH` missing        | Use `process.cwd()/data/juhua.sqlite`.                                                                                                                                                                                                            |
| Database parent directory missing    | Create it before opening SQLite.                                                                                                                                                                                                                  |
| Local DB missing tables              | `pnpm dev` and `pnpm start` run `pnpm db:setup` before serving; `pnpm db:migrate` creates schema from committed migrations.                                                                                                                       |
| Seed run repeatedly                  | Existing sentence/card rows are updated by primary key, not duplicated.                                                                                                                                                                           |
| Runtime connection opens             | Execute WAL and foreign-key pragmas on that connection.                                                                                                                                                                                           |
| Ready card missing from API          | Return `404` with a typed safe public payload: `{ error: "ready_card_not_found", message: string }`. The message uses calm Chinese copy and must not expose local store, setup commands, database, stack, model, provider, or generation details. |
| Ready card missing from homepage     | Render the calm public empty-stock state. Do not throw a local setup error, do not render a frontend mock fallback, and do not start browser-triggered generation.                                                                                |
| Row has unknown `status` or `accent` | DB constraints reject new invalid rows; repository filters existing corrupt rows as unavailable before returning public data.                                                                                                                     |

> **Warning**: `node:sqlite` emits an ExperimentalWarning on Node 22. This is expected for the current local runtime and is not by itself a failing check when commands pass.

### 5. Good/Base/Bad Cases

- Good: `pnpm db:setup && pnpm db:seed` succeeds, `GET /api/ready-card` returns `{ card: { status: "ready" } }`, and `/` renders the same seeded sentence and scene label.
- Good: with zero ready rows, `GET /api/ready-card` returns a safe `ready_card_not_found` payload and `/` renders the calm empty-stock state instead of a technical setup error.
- Base: a developer sets `JUHUA_DATABASE_PATH=test-data/e2e/juhua.sqlite`; migrations and seed use that isolated file.
- Bad: homepage imports a local mock array, or API and homepage each define their own `{ card }` type.
- Bad: repository uses `sqlite.prepare(...).get()` for feature reads while Drizzle schema exists only for migration generation.
- Bad: public empty-stock copy mentions local store, `pnpm db:setup`, SQLite, stack traces, model/provider errors, or immediate on-demand generation.

### 6. Tests Required

For changes to this path, add or update behavior tests that assert:

- `GET /api/ready-card` returns HTTP `200` and exactly the public `{ card: ... }` shape for the seeded ready card.
- `/` visibly renders the seeded sentence and scene label through public DOM queries.
- With zero ready rows, `GET /api/ready-card` returns HTTP `404`, `error: "ready_card_not_found"`, and a safe public Chinese `message` with no local store/setup/database/generation/model/provider details.
- With zero ready rows, `/` visibly renders the calm empty-stock title/description and does not expose the old local setup error.
- Repeated seed/setup access keeps the public ready-card response stable.
- Runtime SQLite connections enforce `ready_card_views.card_id` foreign keys.
- `pnpm db:setup`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass.

Tests should verify public API/browser behavior, not private repository implementation details.

### 7. Wrong vs Correct

#### Wrong

```typescript
// UI owns a second API contract and a hidden fallback source.
import { mockCards } from "./home-card-source"

type Card = { sentence: string; sceneLabel: string; accent: string }

export function HomeCardExperience() {
  return <QuietGalleryCard card={mockCards[0] as Card} isTilted={false} />
}
```

#### Correct

```typescript
import type { PublicReadyCard } from "@/lib/cards/public-ready-card"

export function HomeCardExperience({ card }: { card: PublicReadyCard }) {
  return <QuietGalleryCard card={card} isTilted={false} />
}
```

#### Wrong

```typescript
// Feature read bypasses Drizzle even though schema owns the table contract.
const row = sqlite.prepare("SELECT * FROM cards LIMIT 1").get()
```

#### Correct

```typescript
const [row] = await client.db
  .select({ id: cards.id, sentence: sentences.text })
  .from(cards)
  .innerJoin(sentences, eq(cards.sentenceId, sentences.id))
  .where(eq(cards.status, "ready"))
  .limit(1)
```

---

## Scenario: Ready-card refresh with anonymous recent-window avoidance

### 1. Scope / Trigger

Use this contract when a change touches refresh selection, anonymous ready-card identity, `proxy.ts`, `/api/ready-card`, homepage ready-card loading, ready-card seed volume, or the `ready_card_views` table.

This is a cross-layer path:

```text
proxy.ts anonymous cookie
  → app/page.tsx / app/api/ready-card/route.ts request context
  → getNextReadyCardForVisitor(...)
  → ready_card_views recent window
  → PublicReadyCard DTO
```

### 2. Signatures

**Anonymous cookie**

- Name: `juhua_anonymous_id`
- Value: UUID string validated before use
- Options: `httpOnly`, `sameSite: "lax"`, `path: "/"`, `secure` when the direct request URL is HTTPS or trusted forwarded proto is HTTPS
- Lifetime: session cookie unless a future product decision adds retention

**Request context**

```typescript
type ReadyCardRequestContext = {
  visitorKey: string
  requestContextKey: string
}

function createReadyCardRequestContext(input: {
  cookiesList: { get(name: string): { value: string } | undefined }
  headersList: { get(name: string): string | null }
}): ReadyCardRequestContext
```

`visitorKey` is the stable recent-window key derived from the anonymous cookie only. `requestContextKey` may include normalized IP context (`x-forwarded-for` first token, then `x-real-ip`, then `unknown`) for server-side request context, but IP changes must not reset the recent-card window for a valid anonymous cookie.

**Selection API**

```typescript
async function getNextReadyCardForVisitor(
  client: DatabaseClient,
  context: ReadyCardRequestContext
): Promise<PublicReadyCard | null>
```

**Database table**

```text
ready_card_views(
  id text primary key,
  visitor_key text not null,
  card_id text not null references cards(id),
  seen_at integer not null
)
```

Required indexes:

- `ready_card_views_recent_idx(visitor_key, seen_at)`
- `ready_card_views_card_idx(visitor_key, card_id, seen_at)`

### 3. Contracts

- `proxy.ts` must match `/` and `/api/ready-card` so the first server-rendered homepage card and later API refreshes share identity.
- If the anonymous cookie is missing or invalid, `proxy.ts` must mint a UUID, remove any stale cookie with the same name from the forwarded `Cookie` header, forward the minted cookie to the downstream request, and set it on the response.
- `proxy.ts` must not import modules that depend on Node-only APIs; shared cookie-name/validation helpers used by proxy must be edge-safe.
- The cookie `secure` flag must account for reverse-proxy HTTPS (`x-forwarded-proto: https`) as well as direct HTTPS URLs.
- Homepage and API must call the same selection/recording path; do not keep a separate `getOneReadyCard` path for homepage.
- Selection and view recording must be atomic for a visitor. In the current SQLite implementation, acquire the write lock before reading recent views, selecting a card, inserting the view, and pruning history (`BEGIN IMMEDIATE` on the same connection).
- Selection must avoid the visitor's most recent 50 served cards when there is any ready card outside that window.
- Recent-history reads must be bounded; do not fetch all historical views for a visitor on every request.
- View rows must have a retention/compaction path. Keep enough rows for the recent window and deterministic fallback, but do not append indefinitely.
- If all ready cards are in the recent window, selection returns a ready fallback rather than a false empty-stock response.
- Every returned card from this path must be recorded in `ready_card_views` with a strictly increasing `seen_at` for that visitor without letting stale future-dated rows poison future ordering.
- Large recent-window test data belongs in test-only fixtures, not in runtime `pnpm db:seed` product content.

### 4. Validation & Error Matrix

| Condition                                                    | Required behavior                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Missing or invalid anonymous cookie                          | Mint and forward a valid anonymous cookie before page/API selection runs.                               |
| Existing invalid cookie plus newly minted cookie             | Forward only the valid minted cookie for `juhua_anonymous_id`; do not append behind the invalid value.  |
| Public HTTPS request reaches Next through HTTP reverse proxy | Set anonymous cookie with `Secure` when trusted forwarded proto is HTTPS.                               |
| Same anonymous cookie with changed IP headers                | Keep the same `visitorKey`; IP context must not reset recent-card history.                              |
| Same visitor sends concurrent refresh requests               | Serialize selection/insert so responses do not choose the same next card from the same recent snapshot. |
| More than 50 ready cards exist                               | Do not return any card ID from the same visitor's prior 50 served cards.                                |
| All ready cards are inside the prior 50                      | Return the least-recent ready fallback, not `ready_card_not_found`.                                     |
| Visitor has stale future-dated view rows                     | Clamp or remove stale future rows so new rows do not stay anchored in the future.                       |
| No ready cards exist                                         | Return the existing `404 { error: "ready_card_not_found" }` API response or homepage setup error.       |
| Runtime connection inserts view for missing card             | Foreign-key enforcement rejects the write.                                                              |

### 5. Good/Base/Bad Cases

- Good: a visitor loads `/`, clicks `再来一张`, and the API response is selected with the initial homepage card already in the recent window.
- Good: parallel refreshes for one anonymous visitor are serialized at the selection service and return distinct cards when enough ready cards exist.
- Base: a fresh API visitor receives the stable first ready card and a `Set-Cookie` header.
- Base: a second anonymous visitor is not affected by the first visitor's `ready_card_views` rows.
- Bad: using only `localStorage` or `exclude=currentId`; the server cannot enforce recent-50 behavior or count the server-rendered initial card.
- Bad: deriving `visitorKey` from IP headers; normal mobile/proxy changes would reset recent-card history.
- Bad: storing raw cookie values or raw IP addresses in SQLite for this feature.

### 6. Tests Required

For changes to this path, add or update public API/browser tests that assert:

- `GET /api/ready-card` sets an anonymous cookie for a fresh visitor.
- With enough test-only fixture cards, repeated API calls for one visitor never return an ID from the prior 50 responses.
- A separate anonymous request context starts independently from the first visitor.
- The same anonymous cookie keeps recent history when `x-forwarded-for` changes.
- Concurrent refresh/API requests for one visitor return distinct cards when enough ready cards exist.
- `x-forwarded-proto: https` produces a `Secure` anonymous cookie.
- Runtime SQLite connections enforce `ready_card_views.card_id` foreign keys.
- Visiting `/` records the initial card so the next `/api/ready-card` response does not repeat it when enough ready cards exist.
- No-ready-card API behavior still returns `ready_card_not_found`.
- `pnpm db:setup`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Separate homepage path: initial card is invisible to refresh history.
const card = await getOneReadyCard(client)
```

#### Correct

```typescript
const context = createReadyCardRequestContext({ cookiesList, headersList })
const card = await getNextReadyCardForVisitor(client, context)
```

#### Wrong

```typescript
// Proxy imports Node-only hashing helper and appends after an invalid cookie.
import { anonymousCookieName } from "@/lib/cards/ready-card-request-context"
requestHeaders.set("cookie", `${oldCookie}; ${anonymousCookieName}=${id}`)
```

#### Correct

```typescript
import { anonymousCookieName } from "@/lib/cards/anonymous-ready-card-identity"

requestHeaders.set(
  "cookie",
  buildCookieHeaderWithoutExistingAnonymousCookie(oldCookie, id)
)
```

#### Wrong

```typescript
// IP changes reset the user's recent-card window.
const visitorKey = hash(`${anonymousId}:${ipContext}`)
```

#### Correct

```typescript
const visitorKey = hash(anonymousId)
const requestContextKey = hash(`${anonymousId}:${ipContext}`)
```

#### Wrong

```typescript
// Race: selection and insertion are separate non-atomic operations.
const card = await selectNextCard(client, visitorKey)
await recordReadyCardView(client, visitorKey, card.id)
```

#### Correct

```typescript
client.sqlite.exec("BEGIN IMMEDIATE")
try {
  const card = await selectAndRecordNextCard(client, visitorKey)
  client.sqlite.exec("COMMIT")
  return card
} catch (error) {
  client.sqlite.exec("ROLLBACK")
  throw error
}
```

---

## Scenario: Public action rate limiting with anonymous context

### 1. Scope / Trigger

Use this contract when a change touches public action limits, `/api/ready-card`, `/api/card-action`, anonymous request context, `proxy.ts`, Drizzle schema/migrations, or browser-visible limit feedback.

This path protects public actions without accounts:

```text
proxy.ts anonymous cookie
  → createReadyCardRequestContext(cookie + trusted IP fallback)
  → getRateLimitedNextReadyCardForVisitor(...) or checkAndConsumeRateLimit(...)
  → protected action route
  → public UI announcement
```

### 2. Signatures

**Focused test command**

```json
{
  "test:rate-limit": "node --import tsx --test node-tests/rate-limit.test.ts"
}
```

**Rate-limited actions**

```typescript
const rateLimitWindowMs = 60 * 60 * 1000
const rateLimitedActions = ["refresh", "download", "share"] as const

type RateLimitedAction = (typeof rateLimitedActions)[number]

const rateLimitConfigs = {
  refresh: { limit: 120, windowMs: rateLimitWindowMs },
  download: { limit: 60, windowMs: rateLimitWindowMs },
  share: { limit: 60, windowMs: rateLimitWindowMs },
} as const
```

**Service boundaries**

```typescript
const rateLimitRetentionMs = 3 * 24 * rateLimitWindowMs

async function checkAndConsumeRateLimit(input: {
  client: DatabaseClient
  action: RateLimitedAction
  contextKey: string
  now?: () => Date
}): Promise<
  | { allowed: true; remaining: number; resetAt: Date }
  | { allowed: false; retryAfterSeconds: number; resetAt: Date }
>

async function checkAndConsumeRateLimitInTransaction(input: {
  client: DatabaseClient
  action: RateLimitedAction
  contextKey: string
  currentTime: Date
}): Promise<RateLimitResult>

async function getRateLimitedNextReadyCardForVisitor(input: {
  client: DatabaseClient
  context: ReadyCardRequestContext
  now?: () => Date
}): Promise<
  | { status: "allowed"; card: PublicReadyCard | null }
  | { status: "limited"; limit: Extract<RateLimitResult, { allowed: false }> }
>
```

**Database table**

```text
rate_limit_windows(
  action text not null check(action in ('refresh','download','share')),
  context_key text not null,
  window_start integer not null,
  count integer not null check(count >= 0),
  created_at integer not null,
  updated_at integer not null,
  primary key(action, context_key, window_start)
)
```

Required index:

- `rate_limit_windows_cleanup_idx(window_start)` for bounded cleanup paths.

**Refresh API limit response**

```typescript
type ReadyCardLimitErrorResponse = {
  error: "ready_card_limited"
  message: string
}
```

**Card action gate API**

- `POST /api/card-action`
- Request: `{ action: "download" | "share" }`
- Allowed response: `{ action, status: "allowed", message: string }`
- Limited response: HTTP `429` with `ReadyCardLimitErrorResponse`
- Invalid action response: HTTP `400` with `{ error: "invalid_card_action", message: string }`

### 3. Contracts

- Limits use `ReadyCardRequestContext.requestContextKey`, which is derived from the anonymous cookie plus trusted IP context. Do not use `visitorKey` for rate limits; recent-card history intentionally remains cookie-only.
- `requestContextKey` must not trust spoofable `x-forwarded-for` values. Use `x-real-ip` when the deployment provides it; otherwise fall back to `unknown` so a client cannot rotate forwarded headers to create fresh quota windows.
- Persist only hashed `context_key` values. Do not persist raw `juhua_anonymous_id`, raw IP headers, user-agent strings, or full cookie headers in rate-limit rows.
- `proxy.ts` must match every public API endpoint that depends on anonymous identity, including `/`, `/api/ready-card`, and `/api/card-action`.
- `/` and `GET /api/ready-card` must use the same refresh-limited selection service. Homepage reloads must not bypass refresh quota.
- Refresh quota consumption and ready-card select/record must share one `BEGIN IMMEDIATE` transaction through `getRateLimitedNextReadyCardForVisitor(...)` so selection failures roll back quota consumption.
- A blocked refresh returns HTTP `429` from `/api/ready-card` or a calm limited homepage state from `/`; it must not call ready-card selection and must not insert `ready_card_views`.
- `POST /api/card-action` is the server-side gate for public `download` and `share` actions. It records/limits the action and returns truthful allowed copy, but the route itself must not generate PNG files, invoke Web Share, or trigger browser downloads; client code performs the allowed action after validating the echoed action.
- Counter updates must run inside `BEGIN IMMEDIATE` on the runtime SQLite connection so same-key concurrent requests cannot over-admit above the configured threshold.
- The limiter must prune windows older than `rateLimitRetentionMs` on the consume path so `rate_limit_windows` remains bounded.
- Route handlers must parse request/response JSON as `unknown` at boundaries and narrow through shared guards from `lib/cards/public-ready-card.ts`.
- Public limit copy must not mention thresholds, SQLite, database setup, cookies, IPs, stack traces, model/provider failures, or internal quota rows.

### 4. Validation & Error Matrix

| Condition                                                                               | Required behavior                                                                                                                                         |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refresh count is below `120` for the current one-hour window                            | Increment the `refresh` row and continue to ready-card selection inside the same transaction.                                                             |
| Refresh count has reached `120`                                                         | `/api/ready-card` returns `429 { error: "ready_card_limited" }` with `Retry-After`; `/` renders calm limited UI; both leave `ready_card_views` unchanged. |
| Download/share count is below `60`                                                      | Increment the matching action row and return a truthful `allowed` response for the requested action.                                                      |
| Download/share count has reached `60`                                                   | Return `429 { error: "ready_card_limited" }` with calm copy.                                                                                              |
| Same context reaches the next fixed hourly window                                       | Create/consume a new window row and allow the action again.                                                                                               |
| Request body to `/api/card-action` is missing, malformed JSON, or an unsupported action | Return `400 { error: "invalid_card_action" }` with safe copy and do not consume any quota.                                                                |
| Anonymous cookie is missing/invalid on a matched route                                  | Proxy mints and forwards a valid anonymous cookie before the route computes `requestContextKey`.                                                          |
| Client spoofs or rotates `x-forwarded-for` for the same cookie                          | Ignore it for rate-limit identity; all requests remain in one quota window unless trusted `x-real-ip` changes.                                            |
| Trusted `x-real-ip` changes for the same cookie                                         | Rate-limit identity changes because `requestContextKey` includes trusted IP context; recent-card `visitorKey` history remains stable.                     |
| Ready-card selection throws after refresh quota is checked                              | Roll back the shared transaction so quota is not consumed for a failed card response.                                                                     |
| Old rate-limit windows are older than `rateLimitRetentionMs`                            | Prune them during a consume transaction.                                                                                                                  |
| Two clients consume the same action/context/window concurrently near the threshold      | Immediate transaction serialization allows at most the configured number of successful consumes.                                                          |

### 5. Good/Base/Bad Cases

- Good: a visitor can refresh up to the hourly exploration limit, then receives calm limit copy while the current 图文卡片 remains visible.
- Good: blocked refresh requests do not add `ready_card_views`, so rate-limit failures do not poison recent-card avoidance.
- Good: `/` and `/api/ready-card` share the same refresh-limited selection service, so homepage reloads cannot bypass refresh quota.
- Good: a ready-card selection failure rolls back the refresh quota consume because both happen in one immediate transaction.
- Good: spoofed `x-forwarded-for` values do not create fresh quota windows for the same anonymous cookie.
- Good: expired rate-limit windows older than the retention horizon are pruned during consume.
- Good: download/share button clicks call `/api/card-action`, are counted separately, and client code proceeds only after the allowed response echoes the requested action.
- Good: rate-limit rows contain action names, hashed context keys, window starts, and counts only.
- Base: an invalid `/api/card-action` body returns a safe `400` without consuming quota.
- Bad: using raw IP-only keys; shared networks would collide and the issue's Cookie-plus-IP requirement would be unmet.
- Bad: trusting user-supplied `x-forwarded-for`; clients could rotate the header to bypass limits.
- Bad: applying the refresh limit after `getNextReadyCardForVisitor(...)`; blocked requests would still consume card history.
- Bad: checking refresh quota and selecting/recording the card in separate transactions; transient selection failures would burn quota without returning a card.
- Bad: leaving download/share as pure client announcements after this slice; server-side download/share limit acceptance would be unverifiable.

### 6. Tests Required

For changes to this path, add or update behavior tests that assert:

- `checkAndConsumeRateLimit(...)` allows below-threshold actions, blocks at threshold, and resets in the next fixed hourly window for `refresh`, `download`, and `share`.
- Rate-limit rows persist hashed context keys and never raw cookie/IP values.
- Spoofed `x-forwarded-for` values do not create separate quota windows for the same anonymous cookie.
- Expired rate-limit windows older than `rateLimitRetentionMs` are pruned.
- Multi-connection or concurrent same-key consumption does not exceed the configured threshold.
- Ready-card selection failures inside `getRateLimitedNextReadyCardForVisitor(...)` roll back refresh quota consumption.
- `GET /api/ready-card` returns `429 ready_card_limited` at the refresh threshold and does not insert `ready_card_views` when blocked.
- `/` renders calm homepage limit feedback at the refresh threshold and does not select/record another card.
- `POST /api/card-action` allows, blocks, resets, and safely rejects invalid action bodies.
- Browser-visible refresh limit keeps the current 图文卡片 and announces calm copy.
- Browser-visible download/share allowed states keep truthful capability copy, and blocked states show calm limit copy.
- Tests should derive limit counts from `rateLimitConfigs` instead of hardcoding `120` or `60`.
- `pnpm test:rate-limit`, `pnpm db:setup`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Too late: selecting the card already records ready_card_views.
const card = await getNextReadyCardForVisitor(client, context)
const limit = await checkAndConsumeRateLimit({
  client,
  action: "refresh",
  contextKey: context.requestContextKey,
})
if (!limit.allowed) return limitedResponse()
return NextResponse.json({ card })
```

```typescript
// Leaks raw/spoofable request facts and lets clients rotate quota windows.
const contextKey = headersList.get("x-forwarded-for") ?? "unknown"
```

```typescript
// Separate transactions: selection failures can burn quota without a card.
const limit = await checkAndConsumeRateLimit({
  client,
  action: "refresh",
  contextKey: context.requestContextKey,
})
if (!limit.allowed) return limitedResponse()
const card = await getNextReadyCardForVisitor(client, context)
```

#### Correct

```typescript
const context = createReadyCardRequestContext({ cookiesList, headersList })
const result = await getRateLimitedNextReadyCardForVisitor({ client, context })

if (result.status === "limited") {
  return NextResponse.json(
    { error: "ready_card_limited", message: publicLimitMessage },
    {
      status: 429,
      headers: { "Retry-After": String(result.limit.retryAfterSeconds) },
    }
  )
}

return result.card
  ? NextResponse.json({ card: result.card })
  : NextResponse.json(notFoundPayload, { status: 404 })
```

---

## Scenario: Hitokoto sentence ingestion for generation pipeline

### 1. Scope / Trigger

Use this contract when a change touches real Hitokoto fetching, sentence normalization, Hitokoto sentence metadata persistence, or the first generation-pipeline step before xAI image generation.

This path stops at durable sentence ingestion:

```text
Hitokoto JSON → strict normalizer → sentences + hitokoto_sentence_metadata → future generation slices
```

### 2. Signatures

**Focused test command**

```json
{
  "test:hitokoto": "node --import tsx --test node-tests/hitokoto-pipeline.test.ts"
}
```

Keep Node `node:test` generation-pipeline tests under `node-tests/`, not `tests/`, so Playwright's `testDir: "./tests"` continues to discover only browser e2e tests.

**Hitokoto request constants**

```typescript
const hitokotoEndpoint = "https://v1.hitokoto.cn/"
const hitokotoMinLength = 6
const hitokotoMaxLength = 30
const hitokotoCategories = ["d", "e", "i", "k"] as const
```

Requests must include `encode=json`, `min_length=6`, `max_length=30`, and repeated `c` parameters for `d`, `e`, `i`, and `k`.

**Public pipeline boundary**

```typescript
type HitokotoFetch = (url: string) => Promise<{
  ok: boolean
  status: number
  json(): Promise<unknown>
}>

async function fetchAndStoreHitokotoSentence(input: {
  client: DatabaseClient
  fetchFn?: HitokotoFetch
}): Promise<StoredHitokotoSentence>
```

The injectable `fetchFn` is the public test seam for controlled API responses; production callers can omit it and use global `fetch`.

**Database tables**

Existing generic table:

```text
sentences(id text primary key, text text not null, source text not null, created_at integer not null)
```

Hitokoto-specific metadata table:

```text
hitokoto_sentence_metadata(
  sentence_id text primary key references sentences(id),
  hitokoto_uuid text unique nullable,
  source_identity text not null unique,
  hitokoto_id integer nullable,
  type text nullable,
  from_text text nullable,
  from_who text nullable,
  creator text nullable,
  creator_uid integer nullable,
  reviewer integer nullable,
  commit_from text nullable,
  hitokoto_created_at text nullable,
  length integer nullable,
  fetched_at integer not null
)
```

### 3. Contracts

- Treat Hitokoto JSON as `unknown` at the external boundary. Normalize once into a typed projection before persistence; do not cast raw fields in repositories or callers.
- `hitokoto` must normalize to a non-empty string whose Unicode code-point length is 6–30.
- Optional string fields (`uuid`, `type`, `from`, `from_who`, `creator`, `commit_from`, `created_at`) may be `null`/missing and should normalize to `null`; non-string values are invalid.
- Optional integer fields (`id`, `creator_uid`, `reviewer`, `length`) may be `null`/missing and should normalize to `null`; non-integers are invalid.
- A usable Hitokoto UUID is a valid UUID string normalized to lowercase. Malformed non-empty UUID strings are unusable, not trusted identities.
- `source_identity` must always be non-null:
  - `hitokoto:uuid:<uuid>` for usable UUIDs.
  - A deterministic fallback identity for UUID-less or unusable-UUID records based on normalized sentence text plus `type`, `from`, and `from_who`.
- Store `sentences.source` as `"hitokoto"` for real Hitokoto rows.
- Duplicate handling must reuse the existing sentence row instead of creating a new `sentences` row when either `hitokoto_uuid` or `source_identity` already exists.
- This slice must not import or call xAI code, create `cards` rows, or mark anything ready for the public card pool.

### 4. Validation & Error Matrix

| Condition                                                                          | Required behavior                                                                                   |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Hitokoto HTTP response has `ok=false`                                              | Throw a `HitokotoFetchError` with the HTTP status.                                                  |
| Response body is not an object                                                     | Throw a `HitokotoNormalizationError`; do not write to SQLite.                                       |
| `hitokoto` is missing, empty, non-string, shorter than 6, or longer than 30        | Throw a `HitokotoNormalizationError`; do not write to SQLite.                                       |
| Optional string field is a number/object/array                                     | Throw a `HitokotoNormalizationError`; do not write to SQLite.                                       |
| Optional integer field is a string/float/object/array                              | Throw a `HitokotoNormalizationError`; do not write to SQLite.                                       |
| Same usable Hitokoto UUID is ingested again                                        | Return the existing sentence with `inserted: false`; keep one `sentences` row and one metadata row. |
| UUID is missing, blank, or malformed but fallback identity matches an existing row | Return the existing sentence with `inserted: false`; keep one `sentences` row and one metadata row. |
| Existing mock ready-card seed rows have no Hitokoto metadata                       | They remain valid; ready-card reads still join `cards → sentences` only.                            |

### 5. Good/Base/Bad Cases

- Good: a controlled response with a valid UUID and nullable `from_who` is fetched with the required query parameters, normalized, inserted into both tables, and returned with `inserted: true`.
- Good: a second controlled response with the same UUID returns the original `sentenceId` and does not add rows.
- Good: two UUID-less responses with equivalent normalized text/source facts deduplicate through `source_identity`.
- Base: seed/mock `sentences` rows use `source="mock"` and have no metadata row.
- Bad: saving only the sentence text and dropping Hitokoto UUID/source metadata.
- Bad: using colon-joined fallback identity fields where embedded colons can create boundary collisions; use an unambiguous encoding such as a JSON array.
- Bad: placing Node `node:test` files under `tests/` without adjusting Playwright discovery.

### 6. Tests Required

For changes to this path, add or update behavior tests that assert:

- The generated Hitokoto URL contains `encode=json`, `min_length=6`, `max_length=30`, and `c` values exactly `d`, `e`, `i`, `k`.
- A controlled successful response stores one `sentences` row and one `hitokoto_sentence_metadata` row with normalized nullable metadata.
- Re-ingesting the same usable UUID returns the same `sentenceId` and leaves row counts unchanged.
- Re-ingesting UUID-less equivalent source facts returns the same `sentenceId` and leaves row counts unchanged.
- Malformed/unusable UUID strings fall back to deterministic identity instead of creating UUID-based duplicates.
- Invalid or out-of-range responses reject before any database write.
- `pnpm test:hitokoto`, `pnpm db:setup`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Raw external JSON is trusted and duplicate identity is caller discipline.
const body = (await response.json()) as { hitokoto: string; uuid: string }
await client.db.insert(sentences).values({
  id: randomUUID(),
  text: body.hitokoto,
  source: "hitokoto",
  createdAt: new Date(),
})
```

#### Correct

```typescript
const sentence = normalizeHitokotoResponse(await response.json())
const stored = await storeHitokotoSentence(client, sentence)
```

#### Wrong

```typescript
// One `c` parameter silently narrows the agreed category pool.
const url = "https://v1.hitokoto.cn/?encode=json&min_length=6&max_length=30&c=d"
```

#### Correct

```typescript
const url = new URL("https://v1.hitokoto.cn/")
url.searchParams.set("encode", "json")
url.searchParams.set("min_length", "6")
url.searchParams.set("max_length", "30")
for (const category of ["d", "e", "i", "k"] as const) {
  url.searchParams.append("c", category)
}
```

---

## Scenario: xAI prompt rewrite and base64 image generation smoke path

### 1. Scope / Trigger

Use this contract when a change touches xAI prompt rewriting, xAI image generation, generated-image attempt status, base64 image normalization, or the live xAI smoke command.

This path proves model integration but stops before public ready-card storage:

```text
Hitokoto sentence row → xAI prompt rewrite/fallback → xAI base64 image → generation_attempts metadata → future WebP storage
```

### 2. Signatures

**Focused test command**

```json
{
  "test:xai": "node --import tsx --test node-tests/xai-generation-pipeline.test.ts",
  "smoke:xai": "tsx scripts/smoke-xai-generation.ts"
}
```

Keep Node `node:test` generation-pipeline tests under `node-tests/`, not `tests/`, so Playwright's `testDir: "./tests"` remains browser e2e only.

**xAI constants**

```typescript
const xaiApiBaseUrl = "https://api.x.ai/v1"
const xaiPromptRewriteModel = "grok-4.3"
const xaiImageGenerationModel = "grok-imagine-image-quality"
const xaiImageAspectRatio = "1:1"
const xaiImageResolution = "1k"
```

Image generation requests must use `response_format: "b64_json"`, `n: 1`, top-level `aspect_ratio: "1:1"`, and top-level `resolution: "1k"`. Do not nest xAI REST fields under `extra_body` for the OpenAI JavaScript SDK v6 path; `images.generate(body)` sends the body object directly.

**xAI client boundary**

```typescript
type XaiGenerationClient = {
  rewriteIllustrationPrompt(input: {
    sentence: string
    systemPrompt: string
    userPrompt: string
  }): Promise<{ content: string | null }>
  generateBase64Image(input: {
    prompt: string
    aspectRatio: "1:1"
    resolution: "1k"
  }): Promise<{ b64Json: string | null; mimeType: string | null }>
}
```

Use this injectable boundary for tests; production callers use the OpenAI-compatible SDK configured with `XAI_API_KEY` and `baseURL: "https://api.x.ai/v1"`.

**Database table**

```text
generation_attempts(
  id text primary key,
  sentence_id text not null references sentences(id),
  status text not null check(status in ('started','prompt_fallback','image_generated','failed')),
  prompt_model text not null,
  image_model text not null,
  prompt_text text not null,
  prompt_source text not null check(prompt_source in ('rewrite','fallback')),
  image_mime_type text nullable,
  image_byte_length integer nullable,
  image_sha256 text nullable,
  error_stage text nullable check(error_stage in ('prompt_rewrite','image_generation','image_validation','smoke_write','image_storage','image_conversion') or error_stage is null),
  error_message text nullable,
  image_generation_attempts integer not null,
  created_at integer not null,
  updated_at integer not null
)
```

### 3. Contracts

- `XAI_API_KEY` is server-only. It must be read from server environment only and must not appear in client bundles, public payloads, database rows, logs, smoke summaries, or thrown user-facing messages.
- Missing `XAI_API_KEY` must fail before constructing a production SDK client or making xAI calls.
- Prompt rewriting uses `grok-4.3`; unusable rewrite output or rewrite errors fall back to the deterministic non-attributed picture-book prompt.
- Prompt constraints must describe visual traits and must not name or imply imitation of living artists.
- Image generation uses `grok-imagine-image-quality` and the base64-only request contract above.
- Normalize image output at one boundary: `b64_json` must decode to non-empty bytes, MIME type must be a supported image MIME or default safely, and SHA-256/byte length are computed from decoded bytes.
- Accept valid base64 with or without padding, but reject empty or structurally invalid base64.
- Never store raw base64 image blobs in SQLite. Store only MIME type, decoded byte length, SHA-256 digest, prompt/status, and sanitized error metadata.
- Image generation SDK failures and invalid base64 responses retry once. After retry exhaustion, persist `status='failed'` with `error_stage` and sanitized `error_message`.
- Smoke artifact writes, if used for inspection, must target ignored paths such as `test-results/xai-smoke/`, retry once, and record `smoke_write` failure if they still fail.
- This slice must not mark `cards.status='ready'`, create public image URLs, or serve generated images through the public page.

### 4. Validation & Error Matrix

| Condition                                             | Required behavior                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `XAI_API_KEY` missing                                 | Stop before SDK construction/xAI calls with clear setup guidance.                           |
| Prompt rewrite returns blank/non-string or throws     | Use deterministic fallback prompt and keep image generation running.                        |
| First image generation call throws                    | Retry once; if retry succeeds, record `image_generated` with `image_generation_attempts=2`. |
| Both image generation calls throw                     | Record `failed`, `error_stage='image_generation'`, and no image metadata.                   |
| First image response has invalid/empty base64         | Retry once.                                                                                 |
| Base64 remains invalid after retry                    | Record `failed`, `error_stage='image_validation'`, and no image metadata.                   |
| Valid base64 omits padding                            | Accept it and compute metadata from decoded bytes.                                          |
| Error text contains API keys or bearer/sk-like tokens | Redact before persistence or smoke output.                                                  |
| Smoke command has credentials                         | Apply migrations before opening the shared DB, then run live Hitokoto + xAI path.           |
| Smoke command lacks credentials                       | Do not run migrations, open DB, or call xAI; print setup guidance and exit non-zero.        |

### 5. Good/Base/Bad Cases

- Good: controlled xAI client returns a rewritten prompt and base64 image; the attempt row records model names, prompt source, MIME type, byte length, digest, and one image attempt.
- Good: a blank rewrite response uses fallback prompt and still records successful image metadata.
- Good: a transient image-generation error retries once and records two image attempts when the second call succeeds.
- Good: live smoke writes decoded bytes only under `test-results/xai-smoke/` and prints digest/metadata, never raw base64.
- Base: live smoke is skipped in automated checks when no real `XAI_API_KEY` is provided; the missing-key guard is still verified.
- Bad: storing `b64_json` in SQLite.
- Bad: adding generated cards to the public ready pool before WebP storage exists.
- Bad: passing xAI `aspect_ratio` / `resolution` under an SDK-only nested field that xAI does not document.

### 6. Tests Required

For changes to this path, add or update behavior tests that assert:

- Successful controlled prompt rewrite + base64 image generation records non-ready metadata.
- Prompt rewrite failure or unusable content falls back to the deterministic fixed template.
- Image generation failures retry once and then either succeed or record failed state.
- Invalid base64 image output retries once and then either succeeds or records `image_validation` failure.
- Missing `XAI_API_KEY` fails before production SDK construction.
- The production image request builder emits top-level `response_format`, `n`, `aspect_ratio`, and `resolution` fields.
- Smoke summaries and persisted errors do not include secrets or raw base64.
- `pnpm test:xai`, `pnpm test:hitokoto`, `pnpm db:setup`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass.

### 7. Wrong vs Correct

#### Wrong

```typescript
await client.images.generate({
  model: "grok-imagine-image-quality",
  prompt,
  response_format: "b64_json",
  extra_body: { aspect_ratio: "1:1", resolution: "1k" },
})
```

#### Correct

```typescript
await client.images.generate({
  model: "grok-imagine-image-quality",
  prompt,
  response_format: "b64_json",
  n: 1,
  aspect_ratio: "1:1",
  resolution: "1k",
})
```

---

## Scenario: Pregenerated ready-pool worker with durable daily cap

### 1. Scope / Trigger

Use this contract when a change touches the independent ready-pool worker, worker package scripts, ready-pool inventory counting, daily generation cap state, or background generation orchestration.

This path runs outside the Next.js web process:

```text
worker CLI → SQLite ready inventory count → durable daily reservation → generateReadyCardForHitokotoSentence(...) → cards/generation_attempts
```

### 2. Signatures

**Package scripts**

```json
{
  "worker:ready-pool": "tsx scripts/run-ready-pool-worker.ts",
  "test:worker": "node --import tsx --test node-tests/ready-pool-worker.test.ts"
}
```

**Worker constants**

```typescript
const readyPoolReplenishThreshold = 50
const readyPoolTargetInventory = 200
const readyPoolDailyGenerationCap = 250
const readyPoolWorkerIntervalMs = 60_000
```

**Worker service boundary**

```typescript
type ReadyPoolGenerator = () => Promise<XaiReadyCardGenerationResult>
type ReadyPoolClock = () => Date
type ReadyPoolStopSignal = { readonly stopped: boolean }
type ReadyPoolSleep = (input: {
  durationMs: number
  stopSignal?: ReadyPoolStopSignal
}) => Promise<void>

type ReadyPoolErrorSummary = {
  stage: "generation_exception" | "replenishment_pass" | "summary_observer"
  message: string
}

type ReadyPoolReplenishmentSummary = {
  startedInventory: number
  endingInventory: number
  threshold: 50
  target: 200
  dailyCap: 250
  readyInventoryGrowthCount: number
  failedCount: number
  reservedCount: number
  skippedReason:
    | "inventory_above_threshold"
    | "daily_cap_exhausted"
    | "stopped"
    | null
  errors: ReadyPoolErrorSummary[]
}

async function replenishReadyPoolOnce(input: {
  client: DatabaseClient
  generateReadyCard: ReadyPoolGenerator
  now?: ReadyPoolClock
  stopSignal?: ReadyPoolStopSignal
}): Promise<ReadyPoolReplenishmentSummary>

async function runReadyPoolWorkerLoop(input: {
  client: DatabaseClient
  generateReadyCard?: ReadyPoolGenerator
  now?: ReadyPoolClock
  sleep?: ReadyPoolSleep
  stopSignal?: ReadyPoolStopSignal
  onSummary?: (summary: ReadyPoolReplenishmentSummary) => void
  onError?: (error: ReadyPoolErrorSummary) => void
}): Promise<void>
```

**Database table**

```text
ready_pool_generation_days(
  day_key text primary key,
  generation_count integer not null check(generation_count >= 0),
  created_at integer not null,
  updated_at integer not null
)
```

### 3. Contracts

- The worker must be independently runnable from the web process through `pnpm worker:ready-pool`.
- The production worker must validate `XAI_API_KEY` before starting the long-running loop and must not print the secret.
- The production worker applies migrations before opening its runtime `DatabaseClient`.
- Ready inventory is a database fact: count rows that public ready-card selection can serve (`cards.status='ready'`, valid accent, joined sentence row). Worker counting must reuse the public ready-card repository eligibility helper instead of duplicating the predicate.
- Replenishment starts only when ready inventory is below `50`; inventory `50` or higher skips generation.
- When inventory is below `50`, one pass generates toward `200`, stopping if the target is reached, the daily cap is exhausted, or the stop signal is set.
- The accepted daily-cap boundary is a worker ready-card generation-job reservation before each `generateReadyCardForHitokotoSentence(...)` call. It does not count each internal xAI image retry as a separate cap unit.
- Daily cap state must be durable in SQLite and guarded by `BEGIN IMMEDIATE` so process restarts do not reset same-day capacity.
- Worker generation concurrency is `1`: await each generation job and re-count inventory before deciding whether to reserve/start another job. Do not launch a `Promise.all` batch for replenishment.
- Failed generation results or thrown generator errors count as failed worker outcomes, consume the already-reserved worker-job capacity, and must not create/update public ready `cards` rows.
- Thrown generator errors after reservation must be included in `summary.errors` with sanitized diagnostics and without secrets, raw base64, or provider credentials.
- `readyInventoryGrowthCount` means positive public-ready inventory delta, not the number of `status='ready'` generator results. Canonical upserts that do not increase inventory must not increment it.
- The long-running worker loop must catch recoverable replenishment-pass and `onSummary` observer errors, report sanitized diagnostics through `onError` or a fallback logger, and continue the next iteration unless stopped.
- Worker idle sleep must be stop-aware in production so SIGINT/SIGTERM can wake the loop promptly instead of waiting for the full interval.
- Pipeline failures that reach an attempt row remain inspectable in `generation_attempts`; worker summaries may report aggregate counts but must not include raw base64 or secrets.

### 4. Validation & Error Matrix

| Condition                                                    | Required behavior                                                                                                                                   |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `XAI_API_KEY` missing for production CLI                     | Print setup guidance for `pnpm worker:ready-pool`, set non-zero exit code, and do not start the worker loop.                                        |
| Ready inventory is `50` or higher                            | Return a summary with `skippedReason='inventory_above_threshold'` and do not call the generator.                                                    |
| Ready inventory is below `50`                                | Reserve capacity and run one generation job at a time until inventory reaches `200`, cap is exhausted, or stopped.                                  |
| Daily row is missing                                         | First reservation for that UTC day inserts `generation_count=1`.                                                                                    |
| Daily row has `generation_count >= 250`                      | Return `cap_exhausted` without calling the generator.                                                                                               |
| Process restarts on the same day                             | Existing `ready_pool_generation_days` count still limits further reservations.                                                                      |
| Generation returns `status='failed'`                         | Increment failed summary count, keep failure inspectable through persisted status, re-count inventory, and continue if cap remains.                 |
| Generator throws                                             | Treat as a failed worker outcome, include a sanitized `generation_exception` error summary, re-count inventory, and continue unless stopped/capped. |
| Replenishment pass throws a recoverable infrastructure error | Report a sanitized `replenishment_pass` error and continue the long-running loop's next iteration.                                                  |
| `onSummary` throws                                           | Report a sanitized `summary_observer` error and continue the long-running loop.                                                                     |
| Stop signal is set between jobs                              | Do not reserve/start another job; return `skippedReason='stopped'`.                                                                                 |
| Stop signal is set during idle sleep                         | Wake the production sleep promptly and exit the loop without waiting the full interval.                                                             |

### 5. Good/Base/Bad Cases

- Good: with 49 ready cards and enough cap, one controlled worker pass serially creates ready cards until inventory reaches 200.
- Good: with 49 ready cards but only limited same-day capacity left, the worker consumes the remaining reservations and then stops with `daily_cap_exhausted`.
- Good: a failed controlled generation records a failed `generation_attempts` row and the worker keeps it out of ready inventory.
- Base: with exactly 50 ready cards, the worker reports an inventory skip and performs no external-service work.
- Base: seeded mock ready cards count as ready inventory because they are public-ready rows.
- Bad: computing `200 - current` once and launching that many generation promises; failures/canonical upserts make the count stale and violate concurrency 1.
- Bad: keeping the daily cap in process memory; restarting the worker would bypass the cap.
- Bad: adding failed rows to `cards` by broadening `cards.status`; public ready-card queries must remain ready-only.

### 6. Tests Required

For changes to this path, add or update behavior tests that assert:

- Below-threshold inventory (`49`) replenishes to the target (`200`) using controlled generation doubles.
- At-threshold inventory (`50`) skips generation and the controlled generator is not called.
- Worker generation jobs do not overlap; maximum active controlled generator calls stays `1`.
- Daily cap reservations persist across closed/reopened database clients for the same injected UTC day.
- Exhausting the daily cap prevents further generation calls and returns `daily_cap_exhausted`.
- Failed controlled generations remain inspectable and are excluded from ready-card inventory.
- Thrown generator errors after reservation are counted and included as sanitized diagnostics without leaking secrets.
- Ready generator results that perform canonical upserts without inventory growth do not increment `readyInventoryGrowthCount`.
- Worker inventory counting shares public ready-card eligibility and excludes the same invalid/corrupt rows public serving excludes.
- Recoverable replenishment-pass errors and `onSummary` observer errors do not permanently terminate the long-running worker loop.
- Stop during idle sleep wakes the production loop promptly rather than waiting the full interval.
- `pnpm test:worker`, `pnpm test:xai`, `pnpm test:hitokoto`, `pnpm db:setup`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass for worker-related changes.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Process-local cap and parallel generation both violate durable cap and concurrency 1.
let generatedToday = 0
const needed = 200 - currentInventory
await Promise.all(
  Array.from({ length: needed }, async () => {
    if (generatedToday >= 250) return
    generatedToday += 1
    return generateReadyCardForHitokotoSentence({ client, xaiClient })
  })
)
```

#### Correct

```typescript
while (inventory < readyPoolTargetInventory) {
  const reservation = await reserveDailyGenerationCapacity({
    client,
    dayKey: getUtcDayKey(now()),
    dailyCap: readyPoolDailyGenerationCap,
    now: now(),
  })
  if (reservation.status === "cap_exhausted") break

  await generateReadyCard()
  inventory = await countReadyPoolInventory(client)
}
```

---

## Scenario: Generated illustration local WebP storage and public serving

### 1. Scope / Trigger

Use this contract when a change touches generated illustration storage, WebP conversion, generated ready-card persistence, `cards.illustration_path`, the public generated-illustration route, or storage/conversion failure handling.

This path completes the 图文绑定 storage loop after successful xAI generation:

```text
Hitokoto sentence row → xAI base64 image → decoded bytes → local WebP file → cards.illustration_path public URL → /generated-illustrations/<uuid>.webp
```

### 2. Signatures

**Focused test command**

```json
{
  "test:xai": "node --import tsx --test node-tests/xai-generation-pipeline.test.ts"
}
```

**Environment key**

- `JUHUA_GENERATED_ILLUSTRATIONS_DIR?: string` — optional generated-illustration data root.
- Default when unset: `process.cwd()/data/generated-illustrations`.

**Storage constants and helpers**

```typescript
const generatedIllustrationWebpQuality = 88
const generatedIllustrationPublicPathPrefix = "/generated-illustrations"

function resolveGeneratedIllustrationRoot(): string
function isValidGeneratedIllustrationFilename(filename: string): boolean
function resolveGeneratedIllustrationFilePath(filename: string): string | null
function resolveGeneratedIllustrationPublicPath(
  publicPath: string
): string | null
function resolveGeneratedIllustrationFilePathFromPublicPath(
  publicPath: string
): string | null
async function removeStoredGeneratedIllustrationByPublicPath(
  publicPath: string
): Promise<void>

async function storeGeneratedIllustrationAsWebp(input: {
  imageBytes: Buffer
  filename?: string
}): Promise<{
  filename: string
  publicPath: string
  filePath: string
  byteLength: number
  sha256: string
}>
```

**Ready-card generation boundary**

```typescript
async function generateReadyCardForHitokotoSentence(input: {
  client: DatabaseClient
  fetchFn?: HitokotoFetch
  xaiClient: XaiGenerationClient
}): Promise<
  | {
      status: "ready"
      card: PublicReadyCard
      illustration: { publicPath: string; byteLength: number; sha256: string }
    }
  | {
      status: "failed"
      error: {
        stage:
          | "image_generation"
          | "image_validation"
          | "image_storage"
          | "image_conversion"
          | "prompt_rewrite"
        message: string
      }
    }
>
```

**Public image route**

- `GET /generated-illustrations/[filename]`
- Valid filename shape: lowercase UUID plus `.webp`, e.g. `00000000-0000-4000-8000-000000000001.webp`.
- Success headers include `Content-Type: image/webp` and immutable public cache.

**Database contracts**

- `cards.illustration_path` stores the same-origin public path such as `/generated-illustrations/<uuid>.webp`, not an absolute filesystem path.
- Public DTO mapping must normalize `cards.illustration_path` through the generated-illustration public-path validator; malformed, absolute, external, traversal-like, or non-UUID values become `illustrationUrl: null` instead of being exposed.
- `cards(sentence_id, style_version)` has a unique index for the canonical 图文绑定 under the current card shape/style.
- Migrations that add this unique index must handle legacy duplicate `(sentence_id, style_version)` rows before index creation so startup does not fail on existing data.
- `generation_attempts.error_stage` includes `image_storage` and `image_conversion` for WebP storage failures.

### 3. Contracts

- Convert successful generated image bytes to WebP with quality `88` before a card enters the ready pool.
- Store generated WebP files under `JUHUA_GENERATED_ILLUSTRATIONS_DIR` or the default `data/generated-illustrations`; do not write runtime generated assets into Next.js `public/`.
- Persist only metadata and the public path in SQLite. Do not store raw base64, original model bytes, WebP blobs, filesystem paths, or external URLs in SQLite public DTO output.
- Use temporary files for conversion and atomically move the final `.webp` into place.
- After successful conversion, retain only the final WebP file. Temporary/source conversion files must be removed.
- Compute returned hash/size from the generated WebP output without rereading the durable file when the output bytes are already available.
- If ready-card persistence fails after WebP storage succeeds, remove the just-stored WebP before recording the failed attempt.
- If regenerating the canonical card replaces a prior safe generated-illustration public path, remove the replaced local WebP after the database write succeeds.
- The public image route must validate the filename before resolving a path, stream valid files from the data root, and must never expose absolute paths in errors.
- Existing non-ready smoke generation remains valid; only `generateReadyCardForHitokotoSentence(...)` may mark a generated card ready.

### 4. Validation & Error Matrix

| Condition                                                                                                     | Required behavior                                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `JUHUA_GENERATED_ILLUSTRATIONS_DIR` missing                                                                   | Use `process.cwd()/data/generated-illustrations`.                                                                  |
| Configured illustration root parent is missing                                                                | Create the root directory before conversion.                                                                       |
| Configured illustration root is a file, not a directory                                                       | Return/persist `failed` with `error_stage='image_storage'`; do not create a ready card.                            |
| Input bytes cannot be decoded/converted by Sharp                                                              | Return/persist `failed` with `error_stage='image_conversion'`; remove temp files; do not create a ready card.      |
| Final rename/write/stat fails                                                                                 | Return/persist `failed` with `error_stage='image_storage'`; remove temp/final partial files.                       |
| WebP storage succeeds but card DB write fails                                                                 | Remove the stored WebP and record the attempt as `failed`; do not leave an orphan durable asset.                   |
| Regenerating a canonical card replaces an old safe generated WebP path                                        | Keep the new DB path and remove the old local WebP file after successful persistence.                              |
| Legacy DB has duplicate `(sentence_id, style_version)` card rows before the unique index migration            | Deterministically keep one canonical row, remove dependent view rows for duplicates, then create the unique index. |
| `cards.illustration_path` contains an external URL, absolute path, traversal-like value, or non-UUID filename | Public `illustrationUrl` is `null`; do not expose the unsafe value to the client.                                  |
| Public route receives a traversal or non-UUID filename                                                        | Return `404`; do not read from the filesystem.                                                                     |
| Public route receives a valid filename for a missing file                                                     | Return `404`.                                                                                                      |
| Public route receives a valid stored WebP filename                                                            | Stream a `200` response with `Content-Type: image/webp`.                                                           |

### 5. Good/Base/Bad Cases

- Good: controlled xAI generation returns valid image bytes; storage writes one `.webp`, `cards.illustration_path` becomes `/generated-illustrations/<uuid>.webp`, and the returned card has `illustrationUrl`.
- Good: conversion fails for invalid image bytes; the attempt row records `image_conversion`, no ready card exists, and no durable WebP remains.
- Good: regenerating the same sentence/style replaces the canonical card's `illustration_path` and removes the superseded generated WebP.
- Good: a stored WebP can be fetched through the same-origin public route with `image/webp`.
- Base: seeded mock ready cards keep `illustration_path=null` and remain valid public ready cards.
- Base: unsafe legacy `illustration_path` values are treated as `illustrationUrl: null` while the row remains otherwise usable.
- Bad: writing raw `b64_json`, original generated bytes, or WebP blobs into SQLite.
- Bad: persisting `C:\...\data\generated-illustrations\x.webp` or `/var/.../x.webp` in `cards.illustration_path`.
- Bad: exposing `https://...`, `//...`, `/generated-illustrations/../x.webp`, or a non-UUID filename as public `illustrationUrl`.
- Bad: path-joining an unvalidated route filename and letting `../` escape the data root.

### 6. Tests Required

For changes to this path, add or update behavior tests that assert:

- A controlled successful generation creates one ready card with `illustrationUrl`, writes a local `.webp`, and leaves no temporary/source files behind.
- Regenerating the same sentence/style keeps one canonical card and removes the replaced local WebP.
- `cards.illustration_path` stores the same-origin public path and SQLite never stores raw base64 or image blobs.
- Unsafe `cards.illustration_path` values are not exposed by `GET /api/ready-card`; the public DTO returns `illustrationUrl: null`.
- Conversion failure records `status='failed'`, `error_stage='image_conversion'`, no ready card, and no durable WebP.
- Storage failure records `status='failed'`, `error_stage='image_storage'`, no ready card, and sanitized error text.
- Provider image generation failures still retry the documented number of attempts and do not write partial image metadata.
- The public route serves valid WebP assets and rejects missing/invalid/traversal filenames with `404`.
- `GET /api/ready-card` and `/` expose/render `illustrationUrl` for stored cards while null-image seed cards still render.
- `pnpm test:xai`, `pnpm test:hitokoto`, `pnpm db:setup`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass.

### 7. Wrong vs Correct

#### Wrong

```typescript
await writeFile("public/generated/card.png", image.bytes)
await client.db.insert(cards).values({
  illustrationPath: "C:/app/public/generated/card.png",
  status: "ready",
})
```

#### Correct

```typescript
const illustration = await storeGeneratedIllustrationAsWebp({
  imageBytes: generation.image.bytes,
})
await upsertGeneratedReadyCard({
  client,
  sentenceId: generation.sentence.id,
  sentenceText: generation.sentence.text,
  illustrationUrl: illustration.publicPath,
})
```

---

## Scenario: Token-protected operational status page and API

### 1. Scope / Trigger

Use this contract when a change touches the owner-only operational status page (`/admin/status`), the status API (`/api/admin/status`), admin token authentication, or the operational status data collector.

This path is owner-facing and read-only:

```text
Bearer header or ?token= → admin auth (constant-time) → operational status collector (counts + recent errors + storage) → /api/admin/status JSON / /admin/status page
```

### 2. Signatures

**Focused test command**

```json
{
  "test:admin-status": "node --import tsx --test node-tests/admin-status.test.ts"
}
```

**Environment key**

- `JUHUA_ADMIN_STATUS_TOKEN?: string` — owner admin token. Missing or blank means the status endpoints are unconfigured and must deny all access.

**Auth boundary**

```typescript
type AdminAuthResult =
  | { authorized: true }
  | { authorized: false; reason: "not_configured" | "missing_token" | "invalid_token" }

function resolveAdminStatusToken(env?: Record<string, string | undefined>): string | null
function verifyAdminStatusToken(input: { presentedToken: string | null; configuredToken: string | null }): AdminAuthResult
function extractPresentedAdminToken(request: Request): string | null
function authorizeAdminStatusRequest(input: { request: Request; env?: Record<string, string | undefined> }): AdminAuthResult
```

**Status collector**

```typescript
type OperationalCounts = { ready: number; failed: number; inProgress: number }
type RecentGenerationError = { attemptId: string; stage: string | null; message: string | null; occurredAt: string }
async function collectOperationalStatus(input: { client: DatabaseClient; now?: () => Date; recentErrorLimit?: number; storage?: StorageProbe }): Promise<OperationalStatus>
```

**API**

- `GET /api/admin/status`
- Unauthorized: HTTP `401` `{ error: "admin_status_unauthorized"; message: string }` with `WWW-Authenticate: Bearer`.
- Authorized: HTTP `200` `{ status: OperationalStatus }`.

### 3. Contracts

- When `JUHUA_ADMIN_STATUS_TOKEN` is missing or blank, every status request is denied (`not_configured`). Never default to open access because the server lacks a token.
- Token comparison must be constant-time. Hash both sides to a fixed-length digest before `crypto.timingSafeEqual` so token length cannot leak through an early return or a length-mismatch throw.
- The API accepts `Authorization: Bearer <token>`; the browser page also accepts `?token=<token>`. Header takes precedence over query.
- Denial responses must not echo the presented token, reveal the configured token, or include any operational data (counts, errors, storage, timestamps).
- The API must authorize before opening a `DatabaseClient`; unauthorized requests must not touch SQLite. Authorized requests use the shared client and `finally { client.sqlite.close() }`.
- Counts are database facts: `ready` reuses `countPublicReadyCards` (public eligibility), `failed` is `generation_attempts.status='failed'`, `inProgress` is `generation_attempts.status IN ('started','prompt_fallback')`. `image_generated` is neither failed nor in-progress for this view.
- Recent errors expose only `stage`, `occurredAt`, and a re-`sanitizeErrorMessage`-d `message`. Never expose `prompt_text`, `image_sha256`, secrets, or bearer/sk-like tokens, even though persisted messages are already sanitized.
- Storage indicators expose existence, byte size, and valid-`.webp` file count only. The operator payload must never contain absolute filesystem paths. File counting reuses `isValidGeneratedIllustrationFilename`.
- The page and API share one auth decision path and one status collector. The page is a Server Component with no `"use client"`, so the token is verified server-side and never reaches the client bundle.
- Both routes set `runtime = "nodejs"` and `dynamic = "force-dynamic"`.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --------- | ----------------- |
| `JUHUA_ADMIN_STATUS_TOKEN` missing/blank | Deny every request (`401` API, unauthorized page); never open access. |
| No token presented | `401` `admin_status_unauthorized` with `WWW-Authenticate: Bearer`; page renders unauthorized view. |
| Wrong token presented | `401`; constant-time comparison; no token echo. |
| Valid Bearer header or `?token=` | `200` with `{ status }`; page renders counts/errors/storage. |
| Header and query both present | Header wins. |
| Unauthorized request | Do not open `DatabaseClient`; body carries no operational data. |
| Failed attempt has a dirty error message | Re-sanitize before exposing; redact secret-like tokens. |
| Database file or illustration directory missing | Report `exists: false` with zeroed metrics; no absolute path in payload. |

### 5. Good/Base/Bad Cases

- Good: with a configured token, `GET /api/admin/status` returns `200` with accurate `ready`/`failed`/`inProgress` counts and sanitized recent errors.
- Good: a request with no token or a wrong token gets `401` and a body with no operational data.
- Good: an unconfigured token env denies even a request that presents some token.
- Base: storage indicators report existence/size/file-count without leaking absolute paths.
- Bad: comparing tokens with `===` (timing side channel) or returning early on length mismatch.
- Bad: defaulting to open access when the token env is unset.
- Bad: exposing prompt text, image digests, secrets, or absolute filesystem paths in the operator payload.
- Bad: opening a `DatabaseClient` before the auth check passes.

### 6. Tests Required

For changes to this path, add or update behavior tests that assert:

- Unconfigured token env denies access regardless of presented token.
- Missing/wrong token yields `401`; correct token (header or query) yields `200`.
- Token comparison does not authorize a longer token that shares a prefix.
- Counts match seeded ready cards and `generation_attempts` statuses (`inProgress` excludes `image_generated`).
- Recent errors are failed-only, most-recent-first, limit-bounded, sanitized, and free of prompt text / digests.
- Storage indicators count only valid `.webp` files and never include absolute paths.
- Denied API responses contain no operational data and set `WWW-Authenticate: Bearer`.
- `pnpm test:admin-status`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Timing side channel + opens access when unconfigured.
if (!configuredToken || presentedToken === configuredToken) return ok()
```

#### Correct

```typescript
if (configuredToken === null) return { authorized: false, reason: "not_configured" }
const ok = timingSafeEqual(sha256(presentedToken), sha256(configuredToken))
```

#### Wrong

```typescript
// Authorizes (and opens SQLite) before checking the token.
const client = createDatabaseClient()
const status = await collectOperationalStatus({ client })
if (!authorized) return unauthorized()
```

#### Correct

```typescript
const auth = authorizeAdminStatusRequest({ request })
if (!auth.authorized) return NextResponse.json(unauthorizedBody, { status: 401 })
const client = createDatabaseClient()
try {
  return NextResponse.json({ status: await collectOperationalStatus({ client }) })
} finally {
  client.sqlite.close()
}
```
