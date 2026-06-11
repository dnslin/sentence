# [Issue #4] Design: SQLite/Drizzle ready card API

## First-Principles Analysis

### Challenge Assumptions

- Assumption: the homepage must HTTP-fetch its own `/api/*` route to count as API-backed. This is unverified and can be wrong in a Server Component because build/request origin and server availability are real constraints.
- Assumption: adding SQLite requires a native package such as `better-sqlite3`. This is unverified for this environment because local Node is v22.17.0 and Drizzle documents a `node:sqlite` driver.
- Assumption: this slice should model the entire future card pool. This is potentially wrong because issue #4 only needs one ready card; future slices own refresh avoidance, Hitokoto, image generation, WebP storage, and worker thresholds.
- Assumption: API responses need a generic `{ success, data, error }` envelope. This is analogy-driven; the repository has domain vocabulary but no generic response vocabulary.
- Assumption: local mock card arrays can remain as fallback. This would preserve hidden frontend-only data and weaken the issue requirement that the homepage render from the ready-card data path.

### Bedrock Truths

- A visible homepage card needs only the data `QuietGalleryCard` renders today: sentence text, scene label, and accent variant.
- A persisted ready-card path needs durable storage, a schema, a migration command, and a seed command that can be repeated without duplicating the visible card.
- SQLite WAL is a database connection setting, not a TypeScript type; implementation must execute the pragma against the local database.
- Server Components can import server-only modules directly; they do not need to open an HTTP connection to the same process to reuse an API contract.
- Public route handlers are the external API boundary; tests can hit that boundary over HTTP and separately verify the homepage renders the same seeded card.
- TypeScript strictness only holds if raw database rows and raw JSON are normalized once into exported typed contracts, not cast locally in UI components.

### Rebuild From Ground Up

1. Define one public DTO that matches the agreed API response shape: `{ card: PublicReadyCard }`.
2. Store the minimum durable facts needed for the first ready 图文卡片 while preserving the sentence/card binding boundary.
3. Query SQLite through one repository/service that maps database rows into `PublicReadyCard`.
4. Expose the same service through `GET /api/ready-card` as the public HTTP API.
5. Render `/` from the same typed server-side ready-card projection rather than from local frontend-only arrays.
6. Keep the client component responsible only for UI state and action announcements, not data ownership.
7. Verify behavior at the public HTTP API and browser-visible homepage boundaries.

### Contrast With Convention

A conventional shortcut would keep local mock arrays for the page and add an API route separately, or make the page self-fetch `/api/ready-card` over HTTP. The first splits the source of truth; the second adds an avoidable same-process network/origin dependency. The essential difference here is that the API response contract is shared in TypeScript while the HTTP boundary remains externally testable.

### Conclusion

The simplest correct design is a shared server-side ready-card service plus a public route handler. The route and homepage both consume the same typed projection, SQLite is the only persistent source, and tests verify the external API and visible page behavior.

## Architecture and Boundaries

### Proposed Files

- `drizzle.config.ts` — Drizzle Kit SQLite migration configuration.
- `drizzle/*.sql` — committed migration files for local initialization.
- `lib/db/schema.ts` — Drizzle table definitions and inferred row types.
- `lib/db/client.ts` — database path resolution, SQLite/Drizzle client creation, and WAL pragma execution.
- `lib/cards/public-ready-card.ts` — public `PublicReadyCard`, `ReadyCardResponse`, and accent/status unions.
- `lib/cards/ready-card-repository.ts` — database query and row-to-DTO mapping.
- `lib/cards/seed-ready-card.ts` — stable seed data and idempotent seed operation.
- `scripts/ensure-database-dir.mjs` — creates the local database directory before migration/seed commands.
- `scripts/seed-ready-card.ts` — CLI entrypoint for seeding.
- `app/api/ready-card/route.ts` — public API route.
- `app/page.tsx`, `app/home-experience.tsx`, `app/home-card-experience.tsx`, `app/quiet-gallery-card.tsx` — homepage rendering path updated to receive ready-card data.
- `tests/ready-card.spec.ts`, `playwright.config.ts` — behavior tests for API and visible homepage.

### Dependency Choices

- Runtime dependency: `drizzle-orm`.
- Dev dependencies: `drizzle-kit`, `tsx`, `@playwright/test`.
- SQLite driver: Drizzle `node:sqlite`, because local Node v22.17.0 provides `node:sqlite` and avoids a native add-on dependency for this slice.

### Database Path

- Environment variable: `JUHUA_DATABASE_PATH`.
- Local default: `data/juhua.sqlite`.
- Tests use an isolated path under a gitignored temporary/database directory.
- `.gitignore` should ignore local SQLite files and transient SQLite sidecar files, e.g. `data/*.sqlite*` and test database artifacts, while keeping migration SQL committed.

## Data Model

Use two tables to preserve the product boundary between 一言 and 图文绑定:

- `sentences`
  - `id` text primary key.
  - `text` text not null.
  - `source` text not null, initially `mock`.
  - `created_at` integer timestamp not null.
- `cards`
  - `id` text primary key.
  - `sentence_id` text not null references `sentences.id`.
  - `status` text not null, initially only `ready` is served.
  - `scene_label` text not null.
  - `accent` text not null, constrained in TypeScript to `"dawn" | "rain" | "moon"`.
  - `illustration_path` text nullable for future local WebP storage; this slice can leave it null.
  - `style_version` text not null for future binding/version changes.
  - `created_at` integer timestamp not null.
  - `updated_at` integer timestamp not null.

The public DTO remains intentionally smaller than the database row:

```ts
type PublicReadyCard = {
  id: string
  sentence: string
  sceneLabel: string
  accent: "dawn" | "rain" | "moon"
  status: "ready"
}

type ReadyCardResponse = {
  card: PublicReadyCard
}
```

## API Contract

Route: `GET /api/ready-card`

Success response:

```json
{
  "card": {
    "id": "seed-quiet-gallery-card",
    "sentence": "...",
    "sceneLabel": "...",
    "accent": "dawn",
    "status": "ready"
  }
}
```

Route settings:

- `export const runtime = "nodejs"` because SQLite access is Node-only.
- `export const dynamic = "force-dynamic"` because the route reads local database state.
- Return `Response.json(...)` / `NextResponse.json(...)` with typed payloads.

No-card behavior:

- Return HTTP 404 with a small error payload if the database has no ready card.
- The homepage is not required to implement full empty-stock UX in this slice; future issue #10 owns operational empty-stock behavior. The seeded local path should make the happy path available for issue #4.

## Homepage Data Flow

```
SQLite row → repository → PublicReadyCard DTO → HomeExperience props → HomeCardExperience → QuietGalleryCard
                                      ↘ GET /api/ready-card
```

- `app/page.tsx` becomes an async Server Component that loads one ready card through the repository/service layer.
- `HomeExperience` receives the card as a prop and renders existing public layout/copy.
- `HomeCardExperience` becomes a client component that receives a card prop and only manages action announcements.
- `QuietGalleryCard` accepts `PublicReadyCard` (or a narrow compatible card prop) instead of `CardMock`.
- `app/home-card-source.ts` should be removed or cease being the homepage source of truth.
- Refresh/download/share remain placeholder announcements until their later slices.

## Migration and Seed Flow

Package scripts should document local initialization:

- `db:generate` — generate Drizzle migrations when schema changes.
- `db:migrate` — ensure database directory exists, then apply migrations.
- `db:seed` — ensure directory exists, enable WAL via client path, and upsert the stable ready card.
- `db:setup` — run migration then seed.
- `test` or `test:e2e` — run behavior tests.

Seed behavior:

- Use stable IDs for the mock sentence and card.
- Upsert by primary key so repeated `pnpm db:seed` does not create duplicates.
- Keep the visible seed content Chinese and aligned with `CONTEXT.md` vocabulary.

## Testing Strategy

Use vertical TDD slices rather than writing all tests first:

1. API happy path: after migration/seed, `GET /api/ready-card` returns `{ card: ... }` with `status: "ready"` and the seeded visible fields.
2. Homepage visible path: `/` renders the seeded sentence and scene label from the ready-card data path.
3. Seed idempotence: running seed repeatedly keeps the public API response stable and does not create additional user-visible cards.
4. Build/type safety: `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass.

Playwright is the best fit for this slice because the required behavior spans HTTP API and browser-visible homepage output.

## Compatibility and Rollback

- No production data exists yet, so the migration is additive for local development.
- Local SQLite files are ignored and can be deleted to reset development state.
- If `node:sqlite` becomes incompatible in a deployment target, the repository boundary isolates the driver swap to `lib/db/client.ts` plus dependency/config updates.
- If the homepage cannot find a ready card, it should fail clearly during local development rather than silently falling back to frontend-only mock data.

## Risks

- Next build may execute Server Component code without a migrated local database. Implementation should either document `pnpm db:setup` before `pnpm build` or make the page dynamic and fail with a clear missing-database message.
- Playwright requires browser binaries; implementation should run and report the exact command/failure if browsers are not installed.
- WAL pragma must be applied to the actual runtime connection, not only migration setup.
