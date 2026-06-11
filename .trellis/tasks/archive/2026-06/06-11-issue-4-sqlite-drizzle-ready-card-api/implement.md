# [Issue #4] Implementation Plan

## Preconditions

- Current task remains in `planning` until this plan is reviewed and `task.py start` is run.
- Use TDD vertical slices: add one behavior test, watch it fail for the expected reason, implement only that slice, then repeat.
- Keep public tests behavior-focused: API HTTP response and browser-visible homepage output, not private function shape.

## Public Interface to Preserve

- API: `GET /api/ready-card` returns `{ card: PublicReadyCard }`.
- Page: `/` visibly renders one ready 图文卡片 with the served sentence and scene label.
- UI actions remain placeholders; this task must not implement real refresh/download/share.

## Ordered Checklist

### 1. Dependency and script setup

- [ ] Add `drizzle-orm` as a runtime dependency.
- [ ] Add `drizzle-kit`, `tsx`, and `@playwright/test` as dev dependencies.
- [ ] Add database scripts: `db:generate`, `db:migrate`, `db:seed`, `db:setup`.
- [ ] Add a test script, preferably `test:e2e`, for Playwright behavior tests.
- [ ] Add `.gitignore` entries for local SQLite files and test database artifacts.

Validation after this slice:

- [ ] `pnpm install` or the equivalent package update completes.
- [ ] `pnpm typecheck` still reaches existing code without new dependency type errors.

### 2. First API behavior test (RED)

- [ ] Add Playwright config with an isolated `JUHUA_DATABASE_PATH` for tests.
- [ ] Add a test that requests `/api/ready-card` and expects HTTP 200 plus `{ card: { sentence, sceneLabel, accent, status: "ready" } }`.
- [ ] Run the single test and confirm it fails because the route/data path does not exist yet.

Validation command:

- [ ] `pnpm test:e2e -- tests/ready-card.spec.ts --grep "serves one ready card"`

### 3. Database schema, migration, and seed (GREEN for data availability)

- [ ] Add `drizzle.config.ts` using SQLite dialect and `JUHUA_DATABASE_PATH` with local default.
- [ ] Add Drizzle schema for `sentences` and `cards`.
- [ ] Add an initial migration SQL file.
- [ ] Add `lib/db/client.ts` that resolves the database path, opens Drizzle with `node:sqlite`, and applies `PRAGMA journal_mode = WAL` to the runtime connection.
- [ ] Add seed data and idempotent seed operation.
- [ ] Add CLI seed script.

Validation commands:

- [ ] `pnpm db:migrate`
- [ ] `pnpm db:seed`
- [ ] `pnpm db:seed` again to verify idempotence at the command level.

### 4. API route implementation (GREEN for API test)

- [ ] Add shared public ready-card DTO types.
- [ ] Add repository/service query that selects one `ready` card and maps it to the public DTO.
- [ ] Add `app/api/ready-card/route.ts` with `runtime = "nodejs"` and `dynamic = "force-dynamic"`.
- [ ] Return `{ card }` on success.
- [ ] Return a clear 404 response when no ready card exists, without adding full empty-stock UI.
- [ ] Run the API test until it passes.

Validation command:

- [ ] `pnpm test:e2e -- tests/ready-card.spec.ts --grep "serves one ready card"`

### 5. Homepage behavior test (RED)

- [ ] Add a test that opens `/` and expects the seeded sentence text and scene label to be visible through the rendered card.
- [ ] Confirm the test fails while the homepage still depends on frontend-only mock arrays.

Validation command:

- [ ] `pnpm test:e2e -- tests/ready-card.spec.ts --grep "renders the API-backed ready card"`

### 6. Homepage implementation (GREEN for page test)

- [ ] Make `app/page.tsx` an async Server Component that loads one ready card through the shared service/repository.
- [ ] Pass the card into `HomeExperience` and `HomeCardExperience`.
- [ ] Update `HomeCardExperience` to remove local card array state and preserve only action announcement state.
- [ ] Update `QuietGalleryCard` props to consume the public ready-card type or a narrow compatible prop.
- [ ] Remove or stop using `app/home-card-source.ts` as the homepage source of truth.
- [ ] Update public copy that currently says `本地 mock 数据` so it truthfully describes an already prepared card while keeping refresh/download/share placeholder copy.
- [ ] Run the homepage test until it passes.

Validation command:

- [ ] `pnpm test:e2e -- tests/ready-card.spec.ts --grep "renders the API-backed ready card"`

### 7. Seed idempotence behavior test

- [ ] Extend tests or setup so seed runs twice against the same isolated test database.
- [ ] Verify the public API response remains stable and still returns one ready card.

Validation command:

- [ ] `pnpm test:e2e -- tests/ready-card.spec.ts --grep "keeps seeding idempotent"`

### 8. Final verification

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`
- [ ] If Playwright browsers are missing, run or report `pnpm exec playwright install chromium` as the required environment step, then retry once.

## Risky Files and Rollback Points

- `package.json` / `pnpm-lock.yaml`: dependency and script changes. Roll back together if the chosen test/database tooling changes.
- `drizzle/` migrations: migration filenames/content are persistent contracts. If schema changes during planning, regenerate before implementation starts; if changes during implementation, create a new migration or reset before any production data exists.
- `lib/db/client.ts`: driver choice and WAL behavior. Keep this isolated so a future driver swap does not touch UI/API code.
- `app/page.tsx` and homepage components: do not reintroduce frontend-only fallback mock data; failing loudly is preferable for this slice.
- `.gitignore`: ensure it ignores local database artifacts without ignoring committed migrations.

## Review Gates Before `task.py start`

- [ ] PRD confirms requirements and response shape.
- [ ] Design confirms server-side shared service + public route approach.
- [ ] Implementation plan confirms TDD vertical order and validation commands.
- [ ] `implement.jsonl` and `check.jsonl` include relevant source/spec artifacts for sub-agents.
- [ ] User approves proceeding to implementation.
