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
  "test:e2e": "playwright test"
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
  }
}
```

### 3. Contracts

- SQLite WAL must be enabled on the actual runtime SQLite connection with `PRAGMA journal_mode = WAL` before Drizzle queries run.
- Runtime reads and seed/upsert writes must use Drizzle APIs through the shared client; raw SQL is allowed only for the migration runner that applies committed SQL files.
- Current Drizzle package access uses `drizzle-orm/sqlite-proxy` with a `DatabaseSync` adapter because the installed `drizzle-orm@0.45.2` does not expose `drizzle-orm/node-sqlite` in this project; the adapter must return array rows in SQL selected-column order via `statement.setReturnArrays(true)`.
- Migration SQL files live under `drizzle/` and are committed.
- Local SQLite files are ignored (`data/*.sqlite*`, `data/*.db*`, `test-data/`); migrations are not ignored.
- The seed must be idempotent and transactional: repeated `pnpm db:seed` must not create duplicate user-visible cards or leave sentence/card rows half-updated.
- UI code must consume `PublicReadyCard` / `ReadyCardResponse` from `lib/cards/public-ready-card.ts`; it must not parse database rows or duplicate API payload types.
- The homepage may load the shared server-side repository directly in a Server Component; it does not need to HTTP-fetch its own `/api/ready-card` route.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| `JUHUA_DATABASE_PATH` missing | Use `process.cwd()/data/juhua.sqlite`. |
| Database parent directory missing | Create it before opening SQLite. |
| Local DB missing tables | `pnpm dev` and `pnpm start` run `pnpm db:setup` before serving; `pnpm db:migrate` creates schema from committed migrations. |
| Seed run repeatedly | Existing sentence/card rows are updated by primary key, not duplicated. |
| Runtime connection opens | Execute WAL pragma on that connection. |
| Ready card missing from API | Return `404` with `error: "ready_card_not_found"`. |
| Ready card missing from homepage | Fail clearly and instruct local setup (`pnpm db:setup`); do not silently fall back to frontend mock data. |
| Row has unknown `status` or `accent` | DB constraints reject new invalid rows; repository filters existing corrupt rows as unavailable before returning public data. |

> **Warning**: `node:sqlite` emits an ExperimentalWarning on Node 22. This is expected for the current local runtime and is not by itself a failing check when commands pass.

### 5. Good/Base/Bad Cases

- Good: `pnpm db:setup && pnpm db:seed` succeeds, `GET /api/ready-card` returns `{ card: { status: "ready" } }`, and `/` renders the same seeded sentence and scene label.
- Base: a developer sets `JUHUA_DATABASE_PATH=test-data/e2e/juhua.sqlite`; migrations and seed use that isolated file.
- Bad: homepage imports a local mock array, or API and homepage each define their own `{ card }` type.
- Bad: repository uses `sqlite.prepare(...).get()` for feature reads while Drizzle schema exists only for migration generation.

### 6. Tests Required

For changes to this path, add or update behavior tests that assert:

- `GET /api/ready-card` returns HTTP `200` and exactly the public `{ card: ... }` shape for the seeded ready card.
- `/` visibly renders the seeded sentence and scene label through public DOM queries.
- Repeated seed/setup access keeps the public ready-card response stable.
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
- Options: `httpOnly`, `sameSite: "lax"`, `path: "/"`, `secure` only on HTTPS
- Lifetime: session cookie unless a future product decision adds retention

**Request context**

```typescript
type ReadyCardRequestContext = {
  visitorKey: string
}

function createReadyCardRequestContext(input: {
  cookiesList: { get(name: string): { value: string } | undefined }
  headersList: { get(name: string): string | null }
}): ReadyCardRequestContext
```

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
- Server request context must derive `visitorKey` from the anonymous cookie plus normalized request IP context (`x-forwarded-for` first token, then `x-real-ip`, then `unknown`) and store only the hash, not raw cookie/IP values.
- Homepage and API must call the same selection/recording path; do not keep a separate `getOneReadyCard` path for homepage.
- Selection must avoid the visitor's most recent 50 served cards when there is any ready card outside that window.
- If all ready cards are in the recent window, selection returns a ready fallback rather than a false empty-stock response.
- Every returned card from this path must be recorded in `ready_card_views` with a strictly increasing `seen_at` for that visitor to avoid same-millisecond ordering ambiguity.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Missing or invalid anonymous cookie | Mint and forward a valid anonymous cookie before page/API selection runs. |
| Existing invalid cookie plus newly minted cookie | Forward only the valid minted cookie for `juhua_anonymous_id`; do not append behind the invalid value. |
| Missing IP headers | Use `unknown` as the IP context component. |
| More than 50 ready cards exist | Do not return any card ID from the same visitor's prior 50 served cards. |
| All ready cards are inside the prior 50 | Return the least-recent ready fallback, not `ready_card_not_found`. |
| No ready cards exist | Return the existing `404 { error: "ready_card_not_found" }` API response or homepage setup error. |
| Rapid repeated requests share a timestamp millisecond | Persist `seen_at` as greater than that visitor's latest recorded value. |

### 5. Good/Base/Bad Cases

- Good: a visitor loads `/`, clicks `再来一张`, and the API response is selected with the initial homepage card already in the recent window.
- Base: a fresh API visitor receives the stable first ready card and a `Set-Cookie` header.
- Base: a second anonymous visitor is not affected by the first visitor's `ready_card_views` rows.
- Bad: using only `localStorage` or `exclude=currentId`; the server cannot enforce recent-50 behavior or count the server-rendered initial card.
- Bad: storing raw cookie values or raw IP addresses in SQLite for this feature.

### 6. Tests Required

For changes to this path, add or update public API/browser tests that assert:

- `GET /api/ready-card` sets an anonymous cookie for a fresh visitor.
- With enough seed cards, repeated API calls for one visitor never return an ID from the prior 50 responses.
- A separate anonymous request context starts independently from the first visitor.
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
