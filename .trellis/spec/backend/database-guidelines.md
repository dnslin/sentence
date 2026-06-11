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

**Environment key**

- `JUHUA_DATABASE_PATH?: string` — optional local SQLite file path.
- Default when unset: `process.cwd()/data/juhua.sqlite`.

**Package scripts**

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "tsx scripts/migrate.ts",
  "db:seed": "tsx scripts/seed-ready-card.ts",
  "db:setup": "pnpm db:migrate && pnpm db:seed"
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
- `cards(id text primary key, sentence_id text, status text, scene_label text, accent text, illustration_path text nullable, style_version text, created_at integer, updated_at integer)`.

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
- Current Drizzle package access uses `drizzle-orm/sqlite-proxy` with a `DatabaseSync` adapter because the installed `drizzle-orm@0.45.2` does not expose `drizzle-orm/node-sqlite` in this project.
- Migration SQL files live under `drizzle/` and are committed.
- Local SQLite files are ignored (`data/*.sqlite*`, `data/*.db*`, `test-data/`); migrations are not ignored.
- The seed must be idempotent: repeated `pnpm db:seed` must not create duplicate user-visible cards.
- UI code must consume `PublicReadyCard` / `ReadyCardResponse` from `lib/cards/public-ready-card.ts`; it must not parse database rows or duplicate API payload types.
- The homepage may load the shared server-side repository directly in a Server Component; it does not need to HTTP-fetch its own `/api/ready-card` route.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| `JUHUA_DATABASE_PATH` missing | Use `process.cwd()/data/juhua.sqlite`. |
| Database parent directory missing | Create it before opening SQLite. |
| Local DB missing tables | `pnpm db:migrate` creates schema from committed migrations. |
| Seed run repeatedly | Existing sentence/card rows are updated by primary key, not duplicated. |
| Runtime connection opens | Execute WAL pragma on that connection. |
| Ready card missing from API | Return `404` with `error: "ready_card_not_found"`. |
| Ready card missing from homepage | Fail clearly and instruct local setup (`pnpm db:setup`); do not silently fall back to frontend mock data. |
| Row has unknown `status` or `accent` | Throw at the repository/DTO boundary before returning public data. |

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
