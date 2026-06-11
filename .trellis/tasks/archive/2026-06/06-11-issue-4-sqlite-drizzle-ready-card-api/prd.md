# [Issue #4] SQLite/Drizzle ready card store and API

## Goal

Introduce the first end-to-end ready-card path: persist one ready 图文卡片 in SQLite via Drizzle, expose that ready card through a public API, and render the homepage from the API-backed data path instead of frontend-only mock data.

## User Value

Visitors opening `/` should see a real ready 图文卡片 served through the same data boundary future refresh and pool behavior can extend, while keeping the current Quiet Gallery public experience and placeholder action truthfulness.

## Source Requirement

GitHub issue #4: `[Slice 03] Add SQLite/Drizzle card store with one ready mock card served through API`.

## Confirmed Facts

- Parent: issue #1 / `.trellis/tasks/06-09-juhua-mvp-issue-1`.
- Blocked by: issue #3, already delivered and archived; current homepage is `/` → `HomeExperience` → `HomeCardExperience` → `QuietGalleryCard`.
- Current homepage uses local frontend-only mock cards from `app/home-card-source.ts`.
- Product vocabulary is defined in `CONTEXT.md`: 图文卡片, 一言, 图文绑定, 刷新生成, 随机短句, 非署名绘本风.
- Accepted ADRs require SQLite WAL via Drizzle for metadata/status/rate-limit state and local WebP files for illustrations; generated images should not be SQLite blobs.
- This slice precedes real Hitokoto fetching, real image generation, local WebP asset storage, refresh avoidance, and empty-stock behavior.
- The app stack is Next.js 16.2.6 App Router, React 19.2.4, TypeScript strict mode, Tailwind CSS 4, pnpm.
- Current `package.json` has no test script or test runner; `pnpm-lock.yaml` currently lists no root test dev dependency.
- Local runtime is Node v22.17.0, so Drizzle's `node:sqlite` driver is available for local SQLite access if chosen during design.
- Backend Trellis guidelines are placeholders; frontend type-safety and quality guidelines require explicit route/data contracts and browser-visible verification.

## Requirements

- Add a local SQLite database path and migration flow that can be initialized locally.
- Enable SQLite WAL for the local database.
- Define a Drizzle schema that stores one ready 图文卡片 as a sentence/card binding, including enough fields to render the existing Quiet Gallery card.
- Seed exactly one ready mock 图文卡片 into the database in an idempotent way.
- Expose a public API endpoint that returns one ready 图文卡片 using project/domain response vocabulary.
- Update the homepage data path so the rendered card comes from the API-backed ready-card source rather than local frontend-only mock arrays.
- Preserve existing public copy truthfulness: refresh/download/share remain placeholder capabilities unless later slices implement them.
- Preserve the current accessible Quiet Gallery rendering behavior: semantic card, scene label, sentence text, and action announcements.
- Keep TypeScript strict: avoid `any`, untyped JSON casts in UI, and duplicated payload interpretation across API, service, and components.
- Add behavior tests that verify the visible ready-card path through the API and homepage.

## Acceptance Criteria

- [ ] The database can be initialized and migrated locally with documented package scripts.
- [ ] The local SQLite connection enables WAL mode.
- [ ] A ready 图文卡片 can be seeded into the database repeatedly without duplicate user-visible cards.
- [ ] The public API returns one ready 图文卡片 using agreed project/domain response vocabulary.
- [ ] The homepage renders the API-backed card text and scene label.
- [ ] The homepage no longer depends on frontend-only mock card arrays for its primary card data.
- [ ] Tests verify the public API serves the ready card.
- [ ] Tests verify the homepage visibly renders the served ready card.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass.

## Out of Scope

- Fetching real Hitokoto sentences.
- Calling image generation models or storing generated WebP files.
- Building the full pregenerated pool worker, replenish thresholds, or daily caps.
- Implementing real refresh avoidance, download PNG, or Web Share behavior.
- Adding user accounts, saved card history, user-submitted sentences, independent gallery assets, or named living-artist styles.
- Production Docker Compose, backups, or protected status pages.

## Resolved Decisions

- Public API success responses use the agreed domain-first shape `{ card: ... }`, with the first slice returning `card.id`, `card.sentence`, `card.sceneLabel`, `card.accent`, and `card.status: "ready"`.

## Open Questions

- None before technical design.
