# Add Hitokoto fetch and sentence normalization

## Goal

Add the first generation-pipeline data slice for 句画: fetch real Hitokoto 一言 records, normalize the returned sentence fields into SQLite, and make sentence ingestion idempotent before xAI illustration generation exists.

## User Value

Future background generation can build 图文卡片 from durable, de-duplicated 一言 records instead of frontend mock sentences or one-off external responses.

## Confirmed Facts

- GitHub issue #6 is open and part of epic #1.
- Issue #4, the blocker for #6, is closed.
- `CONTEXT.md` defines 一言 as a Hitokoto sentence and 随机短句 as a 6–30 character Hitokoto sentence with no tone filtering beyond chosen API parameters.
- Hitokoto random API endpoint is `https://v1.hitokoto.cn/`.
- Hitokoto supports repeated `c` category query parameters.
- The agreed category pool for this task is `d,e,i,k`: literature, original, poetry, and philosophy.
- Hitokoto supports `min_length` and `max_length`; this task must use 6 and 30.
- Hitokoto JSON responses include `id`, `uuid`, `hitokoto`, `type`, `from`, `from_who`, `creator`, `creator_uid`, `reviewer`, `commit_from`, `created_at`, and `length`.
- Current SQLite uses Drizzle schema in `lib/db/schema.ts`, migrations under `drizzle/`, and runtime connections from `lib/db/client.ts` with WAL enabled.
- Current `sentences` rows only store `id`, `text`, `source`, and `created_at`; this task needs additional sentence metadata persistence.
- Existing tests are Playwright e2e for ready-card public behavior; no unit-test runner is configured yet.
- The task must be test-driven using vertical red-green slices and public or exported module interfaces, not private implementation details.

## Requirements

- Fetch Hitokoto records through a small generation-pipeline interface that can be called without xAI credentials or xAI network calls.
- Use Hitokoto query parameters `min_length=6`, `max_length=30`, `encode=json`, and category pool `d,e,i,k`.
- Normalize the Hitokoto response into a strict TypeScript domain shape before writing to SQLite.
- Persist the sentence text and Hitokoto metadata needed by 句画 in the database.
- Prevent duplicate sentence records when the same Hitokoto `uuid` is returned again.
- Prevent duplicate sentence records for equivalent sentence identities when a UUID is missing or unusable.
- Preserve existing ready-card API, homepage, refresh, seed, and e2e behavior.
- Keep xAI prompt rewriting, image generation, WebP storage, worker thresholds, and public card creation out of scope for this slice.

## Acceptance Criteria

- [ ] Hitokoto fetch requests use `min_length=6`, `max_length=30`, `encode=json`, and category pool `d,e,i,k`.
- [ ] Returned 一言 fields needed by 句画 are normalized into strict TypeScript values and stored in SQLite.
- [ ] Duplicate Hitokoto UUIDs do not create duplicate `sentences` rows.
- [ ] Equivalent sentence identities without a UUID do not create duplicate `sentences` rows.
- [ ] The pipeline can run without importing or calling xAI code.
- [ ] Controlled-response tests cover successful fetch normalization.
- [ ] Controlled-response tests cover duplicate UUID handling.
- [ ] Controlled-response tests cover equivalent identity duplicate handling.
- [ ] Existing ready-card API/homepage e2e behavior still passes.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build`, and relevant tests pass.

## Out of Scope

- Calling xAI or storing xAI prompt/image results.
- Creating ready 图文卡片 from fetched Hitokoto records.
- Download/share behavior, public empty-stock UX, rate limiting, Docker deployment, backups, or launch smoke verification.
- User-facing display of Hitokoto source metadata inside the public card.

## Open Questions

- None blocking. The category pool decision is `d,e,i,k`.
