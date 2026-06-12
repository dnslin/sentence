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
  }
}
```

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

| Condition | Required behavior |
| --- | --- |
| `JUHUA_DATABASE_PATH` missing | Use `process.cwd()/data/juhua.sqlite`. |
| Database parent directory missing | Create it before opening SQLite. |
| Local DB missing tables | `pnpm dev` and `pnpm start` run `pnpm db:setup` before serving; `pnpm db:migrate` creates schema from committed migrations. |
| Seed run repeatedly | Existing sentence/card rows are updated by primary key, not duplicated. |
| Runtime connection opens | Execute WAL and foreign-key pragmas on that connection. |
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

| Condition | Required behavior |
| --- | --- |
| Missing or invalid anonymous cookie | Mint and forward a valid anonymous cookie before page/API selection runs. |
| Existing invalid cookie plus newly minted cookie | Forward only the valid minted cookie for `juhua_anonymous_id`; do not append behind the invalid value. |
| Public HTTPS request reaches Next through HTTP reverse proxy | Set anonymous cookie with `Secure` when trusted forwarded proto is HTTPS. |
| Same anonymous cookie with changed IP headers | Keep the same `visitorKey`; IP context must not reset recent-card history. |
| Same visitor sends concurrent refresh requests | Serialize selection/insert so responses do not choose the same next card from the same recent snapshot. |
| More than 50 ready cards exist | Do not return any card ID from the same visitor's prior 50 served cards. |
| All ready cards are inside the prior 50 | Return the least-recent ready fallback, not `ready_card_not_found`. |
| Visitor has stale future-dated view rows | Clamp or remove stale future rows so new rows do not stay anchored in the future. |
| No ready cards exist | Return the existing `404 { error: "ready_card_not_found" }` API response or homepage setup error. |
| Runtime connection inserts view for missing card | Foreign-key enforcement rejects the write. |

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

| Condition | Required behavior |
| --- | --- |
| Hitokoto HTTP response has `ok=false` | Throw a `HitokotoFetchError` with the HTTP status. |
| Response body is not an object | Throw a `HitokotoNormalizationError`; do not write to SQLite. |
| `hitokoto` is missing, empty, non-string, shorter than 6, or longer than 30 | Throw a `HitokotoNormalizationError`; do not write to SQLite. |
| Optional string field is a number/object/array | Throw a `HitokotoNormalizationError`; do not write to SQLite. |
| Optional integer field is a string/float/object/array | Throw a `HitokotoNormalizationError`; do not write to SQLite. |
| Same usable Hitokoto UUID is ingested again | Return the existing sentence with `inserted: false`; keep one `sentences` row and one metadata row. |
| UUID is missing, blank, or malformed but fallback identity matches an existing row | Return the existing sentence with `inserted: false`; keep one `sentences` row and one metadata row. |
| Existing mock ready-card seed rows have no Hitokoto metadata | They remain valid; ready-card reads still join `cards → sentences` only. |

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

| Condition | Required behavior |
| --- | --- |
| `XAI_API_KEY` missing | Stop before SDK construction/xAI calls with clear setup guidance. |
| Prompt rewrite returns blank/non-string or throws | Use deterministic fallback prompt and keep image generation running. |
| First image generation call throws | Retry once; if retry succeeds, record `image_generated` with `image_generation_attempts=2`. |
| Both image generation calls throw | Record `failed`, `error_stage='image_generation'`, and no image metadata. |
| First image response has invalid/empty base64 | Retry once. |
| Base64 remains invalid after retry | Record `failed`, `error_stage='image_validation'`, and no image metadata. |
| Valid base64 omits padding | Accept it and compute metadata from decoded bytes. |
| Error text contains API keys or bearer/sk-like tokens | Redact before persistence or smoke output. |
| Smoke command has credentials | Apply migrations before opening the shared DB, then run live Hitokoto + xAI path. |
| Smoke command lacks credentials | Do not run migrations, open DB, or call xAI; print setup guidance and exit non-zero. |

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
  | { status: "ready"; card: PublicReadyCard; illustration: { publicPath: string; byteLength: number; sha256: string } }
  | { status: "failed"; error: { stage: "image_generation" | "image_validation" | "image_storage" | "image_conversion" | "prompt_rewrite"; message: string } }
>
```

**Public image route**

- `GET /generated-illustrations/[filename]`
- Valid filename shape: lowercase UUID plus `.webp`, e.g. `00000000-0000-4000-8000-000000000001.webp`.
- Success headers include `Content-Type: image/webp` and immutable public cache.

**Database contracts**

- `cards.illustration_path` stores the same-origin public path such as `/generated-illustrations/<uuid>.webp`, not an absolute filesystem path.
- `cards(sentence_id, style_version)` has a unique index for the canonical 图文绑定 under the current card shape/style.
- `generation_attempts.error_stage` includes `image_storage` and `image_conversion` for WebP storage failures.

### 3. Contracts

- Convert successful generated image bytes to WebP with quality `88` before a card enters the ready pool.
- Store generated WebP files under `JUHUA_GENERATED_ILLUSTRATIONS_DIR` or the default `data/generated-illustrations`; do not write runtime generated assets into Next.js `public/`.
- Persist only metadata and the public path in SQLite. Do not store raw base64, original model bytes, or WebP blobs in SQLite.
- Use temporary files for conversion and atomically move the final `.webp` into place.
- After successful conversion, retain only the final WebP file. Temporary/source conversion files must be removed.
- If ready-card persistence fails after WebP storage succeeds, remove the just-stored WebP before recording the failed attempt.
- The public image route must validate the filename before resolving a path and must never expose absolute paths in errors.
- Existing non-ready smoke generation remains valid; only `generateReadyCardForHitokotoSentence(...)` may mark a generated card ready.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| `JUHUA_GENERATED_ILLUSTRATIONS_DIR` missing | Use `process.cwd()/data/generated-illustrations`. |
| Configured illustration root parent is missing | Create the root directory before conversion. |
| Configured illustration root is a file, not a directory | Return/persist `failed` with `error_stage='image_storage'`; do not create a ready card. |
| Input bytes cannot be decoded/converted by Sharp | Return/persist `failed` with `error_stage='image_conversion'`; remove temp files; do not create a ready card. |
| Final rename/read/stat fails | Return/persist `failed` with `error_stage='image_storage'`; remove temp/final partial files. |
| WebP storage succeeds but card DB write fails | Remove the stored WebP and record the attempt as `failed`; do not leave an orphan durable asset. |
| Public route receives a traversal or non-UUID filename | Return `404`; do not read from the filesystem. |
| Public route receives a valid filename for a missing file | Return `404`. |
| Public route receives a valid stored WebP filename | Return `200` with `Content-Type: image/webp`. |

### 5. Good/Base/Bad Cases

- Good: controlled xAI generation returns valid image bytes; storage writes one `.webp`, `cards.illustration_path` becomes `/generated-illustrations/<uuid>.webp`, and the returned card has `illustrationUrl`.
- Good: conversion fails for invalid image bytes; the attempt row records `image_conversion`, no ready card exists, and no durable WebP remains.
- Good: a stored WebP can be fetched through the same-origin public route with `image/webp`.
- Base: seeded mock ready cards keep `illustration_path=null` and remain valid public ready cards.
- Bad: writing raw `b64_json`, original generated bytes, or WebP blobs into SQLite.
- Bad: persisting `C:\...\data\generated-illustrations\x.webp` or `/var/.../x.webp` in `cards.illustration_path`.
- Bad: path-joining an unvalidated route filename and letting `../` escape the data root.

### 6. Tests Required

For changes to this path, add or update behavior tests that assert:

- A controlled successful generation creates one ready card with `illustrationUrl`, writes a local `.webp`, and leaves no temporary/source files behind.
- `cards.illustration_path` stores the same-origin public path and SQLite never stores raw base64 or image blobs.
- Conversion failure records `status='failed'`, `error_stage='image_conversion'`, no ready card, and no durable WebP.
- Storage failure records `status='failed'`, `error_stage='image_storage'`, no ready card, and sanitized error text.
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
