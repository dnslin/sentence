# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- Install dependencies: `pnpm install`
- Start the dev server: `pnpm dev` (runs `pnpm db:setup` first)
- Build for production: `pnpm build`
- Start the built app: `pnpm start` (runs `pnpm db:setup` first)
- Lint: `pnpm lint`
- Type-check: `pnpm typecheck`
- Format TypeScript/TSX: `pnpm format`
- Add a shadcn UI component: `pnpm dlx shadcn@latest add <component>`

Database:

- `pnpm db:generate` — regenerate `drizzle/*.sql` from `lib/db/schema.ts` (drizzle-kit).
- `pnpm db:migrate` — apply pending `drizzle/*.sql` via the custom runner `scripts/migrate.ts`.
- `pnpm db:seed` — seed the stable ready cards.
- `pnpm db:setup` — `db:migrate` then `db:seed`; `dev`/`start` run it automatically.

Generation worker / smoke (require `XAI_API_KEY`):

- `pnpm worker:ready-pool` — long-running ready-pool replenishment loop (the second service alongside `web`).
- `pnpm smoke:xai` — one-shot real xAI generation for manual verification.

Tests:

- Unit/logic tests run on Node's built-in test runner: `pnpm test:rate-limit`, `pnpm test:hitokoto`, `pnpm test:xai`, `pnpm test:worker`. Each maps to a file in `node-tests/`. Run one directly with `node --import tsx --test node-tests/<file>.test.ts`. External services (xAI, Hitokoto) are dependency-injected fakes, so these run offline.
- Browser e2e: `pnpm test:e2e` (Playwright; rebuilds and serves on `127.0.0.1:3100` against an isolated `test-data/e2e` DB). Reset that DB with `pnpm test:e2e:reset-db`. The ready-card route is the contracted surface verified here.

## Product language and constraints

句画 is a lightweight prototype that combines one random sentence with one non-attributed picture-book-style illustration into a shareable vertical 图文卡片.

Use the domain language from `CONTEXT.md` consistently:

- **图文卡片**: one shareable vertical artifact made from one 随机短句 and one 非署名绘本风 illustration.
- **一言 / 随机短句**: short sentence source from Hitokoto; do not describe it as user input, article content, or curated healing copy.
- **图文绑定**: one canonical illustration belongs to one sentence under the current card shape/style; avoid independent gallery or random image-pool semantics in product copy.
- **刷新生成**: replaces the current card during the visit; it does not imply accounts, saved history, posting, or collections.
- **非署名绘本风**: describe visual traits, not a named living artist style.

Public copy must stay truthful: refresh, download, and share should only claim capabilities their completed slices actually implement.

## Architecture overview

Next.js 16 App Router, React 19, TypeScript strict, pnpm, Tailwind CSS v4, shadcn UI, next-themes. The app is a fully local mock/prototype with a real end-to-end generation backend running against SQLite. Understanding it requires reading across the layers below.

### Data and serving layer

- `lib/db/client.ts` — `node:sqlite` `DatabaseSync` wrapped in Drizzle's `sqlite-proxy`. Sets `busy_timeout=5000`, `foreign_keys=ON`, `journal_mode=WAL`. `resolveDatabasePath()` honors `JUHUA_DATABASE_PATH` (default `data/juhua.sqlite`). Write paths run inside `runImmediateTransaction()` (`BEGIN IMMEDIATE`). Routes that open a client must `client.sqlite.close()` in `finally`.
- `lib/db/schema.ts` — tables: `sentences`, `hitokoto_sentence_metadata`, `cards` (status constrained to `ready`; accent `dawn|rain|moon`; unique on `sentenceId + styleVersion`), `ready_card_views` (per-visitor recency), `rate_limit_windows` (hourly fixed windows per action), `ready_pool_generation_days` (daily cap counter), `generation_attempts` (per-stage pipeline audit).
- `lib/cards/ready-card-repository.ts` — `getNextReadyCardForVisitorInTransaction` selects the least-recently-seen ready card outside a recent window of 50, records a view, prunes old views, and maps the row to `PublicReadyCard`.
- `lib/cards/rate-limited-ready-card.ts` — wraps the `refresh` rate-limit check plus card selection in a single immediate transaction.
- `lib/cards/public-ready-card.ts` — `PublicReadyCard` DTO, API response shapes, and type guards shared by server and client. Treat this as the route contract.
- `lib/cards/ready-card-request-context.ts` — derives `visitorKey` (sha256 of the anonymous cookie) and `requestContextKey` (sha256 of cookie + `x-real-ip`). Raw IP/cookie values are never stored.
- `lib/rate-limit/` — fixed 1-hour windows; limits are refresh 120, download 60, share 60; windows older than 3 days are pruned.

### Public routes (`app/`)

- `/` (`app/page.tsx`, `force-dynamic`) — runs the rate-limited refresh selection, then `HomeExperience` → ready card, limited state, or empty-stock state.
- `app/api/ready-card/route.ts` (GET, `nodejs`) — same selector; returns `{ card }`, `429 ready_card_limited` with `Retry-After`, or `404 ready_card_not_found`.
- `app/api/card-action/route.ts` (POST, `nodejs`) — validates `{ action: "download" | "share" }`, consumes the rate limit, returns allowed/limited. It only gates; the PNG render and share happen client-side.
- `app/generated-illustrations/[filename]/route.ts` (GET, `nodejs`) — streams a stored WebP with immutable cache headers. The filename must match the `UUID.webp` pattern and resolve inside the storage root (path-traversal guarded).

### Client export boundary

- `HomeExperience` → `HomeCardExperience` → `QuietGalleryCard`. `HomeCardExperience` is the client state boundary for refresh, PNG download, Web Share, and `aria-live` announcements. It calls `/api/card-action` to gate, then renders the live card node to PNG.
- `lib/card-export/png.ts` — `html-to-image` `toBlob` at fixed export dimensions; waits for fonts and images first.
- `lib/card-export/share.ts` / `download.ts` — Web Share with file support, else download fallback; a dismissed share sheet (`AbortError`) is a calm cancel, not a failure.

### Generation pipeline (server/worker only, `lib/generation/`)

- `hitokoto-client.ts` / `hitokoto-pipeline.ts` — fetch a 6–30 char sentence from `v1.hitokoto.cn` (categories `d/e/i/k`), normalize, dedupe by uuid/identity, and store the sentence plus metadata.
- `illustration-prompt.ts` — prompt-rewrite model `grok-4.3`, image model `grok-imagine-image-quality`, 1:1 / 1k. Non-attributed picture-book system prompt with a deterministic fallback prompt when rewrite fails.
- `xai-client.ts` / `xai-config.ts` — OpenAI SDK pointed at `https://api.x.ai/v1`; `XAI_API_KEY` is required.
- `xai-generation-pipeline.ts` — orchestrates rewrite → image (2 attempts) → base64 normalize → store WebP → upsert card, recording each stage in `generation_attempts`. Returns `ready` or `failed`.
- `generated-illustration-storage.ts` — `sharp` → WebP quality 88, atomic temp-write + rename, filenames are `UUID.webp` under `JUHUA_GENERATED_ILLUSTRATIONS_DIR` (default `data/generated-illustrations`).

### Worker (`lib/worker/`, `scripts/run-ready-pool-worker.ts`)

`runReadyPoolWorkerLoop` runs every 60s: if ready inventory is below 50 it replenishes toward 200, capped at 250 generations per UTC day, logging JSON summaries and stopping on SIGINT/SIGTERM. This is the `worker` service that pairs with `web` (see ADRs 0001/0002).

### Database migrations

`scripts/migrate.ts` is a custom runner: it applies `drizzle/*.sql` in filename order, strips `--> statement-breakpoint`, and records applied filenames in `__drizzle_migrations`. After editing `lib/db/schema.ts`, generate SQL with `pnpm db:generate`; do not hand-edit already-applied migration files.

### Prototype route

`/prototype` is a throwaway comparison of three UI directions (`quiet-gallery`, `immersive-stage`, `paper-desk`). Variant handling is client-side via `useSearchParams().getAll("variant")` inside a `Suspense` boundary so the route stays static; missing/unknown/repeated values fall back to `quiet-gallery`. The floating switcher is gated with `process.env.NODE_ENV !== "production"` and must not render in production DOM.

### Environment variables

- `XAI_API_KEY` — required for the worker, smoke script, and any real generation.
- `JUHUA_DATABASE_PATH` — default `data/juhua.sqlite`; e2e uses `test-data/e2e/juhua.sqlite`.
- `JUHUA_GENERATED_ILLUSTRATIONS_DIR` — default `data/generated-illustrations`.

### Shared primitives

`components/ui/` holds generated shadcn primitives — import locals such as `Button` from `@/components/ui/button`; do not import registry output directly or reimplement primitives. `lib/utils.ts` exposes `cn()` (`clsx` + `tailwind-merge`) for conditional Tailwind composition.

## Styling and UI conventions

- Global design tokens live in `app/globals.css`; Tailwind v4 is configured through CSS imports and variables, not a `tailwind.config.*` file.
- shadcn config is in `components.json` with aliases `@/components`, `@/components/ui`, `@/lib`, `@/hooks`, `@/lib/utils`.
- Formatting is Prettier with no semicolons, double quotes, 2-space indentation, 80-column width, and `prettier-plugin-tailwindcss` sorting classes against `app/globals.css`.
- Use semantic page structure (`main`, `section`, `article`, `nav`, `aside`) and keep prototype/debug controls visually and programmatically separate from production content.
- The theme provider enables the system theme and a plain `d` key hotkey, ignoring typing targets and modified key events.

## Route and frontend contracts

Read `.trellis/spec/frontend/index.md` before frontend edits. Active project-specific contracts:

- `type-safety.md`: Next.js 16 page `searchParams` are promises in Server Components; normalize `string | string[] | undefined` once at the route boundary. For static local variant selection, prefer client `useSearchParams()` under `Suspense` and normalize repeated values with `getAll()`.
- `quality-guidelines.md`: prototype-only controls must be excluded from production DOM, not just hidden with CSS. Check browser-visible route behavior through the browser or an equivalent public interface when it is the contract.
- When checking Tailwind transform/reduced-motion behavior, inspect emitted individual properties such as `rotate`, `scale`, or `translate`, not only `transform`.
- `next.config.ts` allows the dev origin `127.0.0.1` for local browser automation; do not replace it with wildcard CORS headers.

## Deployment and future backend direction

Accepted ADRs in `docs/adr/` describe the intended production shape:

- Self-host on a single overseas VPS with Docker Compose and separate `web` and `worker` services from the same Next.js/Node image.
- Serve users from a hybrid pregenerated pool of ready 图文卡片; target ~200 ready cards, replenish below 50, and handle empty-stock states.
- Store sentence/card metadata, rate-limit state, and generation status in SQLite WAL via Drizzle; store generated illustrations as local WebP files rather than SQLite blobs or temporary model URLs.

Do not introduce product semantics that conflict with these ADRs without updating or superseding the relevant ADR.

## Trellis project context

This repository is managed by Trellis. `AGENTS.md` points to working knowledge under `.trellis/`:

- `.trellis/workflow.md` for task phases and routing.
- `.trellis/spec/` for package/layer-scoped coding guidelines (read before editing a given layer).
- `.trellis/tasks/` for PRDs, research, and task artifacts.
- `.trellis/workspace/` for journals and session traces.

When implementing a Trellis-tracked task, read the current task artifacts and the relevant `.trellis/spec/` guide before editing.
