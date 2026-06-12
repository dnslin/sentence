# [Slice 07] Store generated illustrations as local WebP and serve public image URLs

## Goal

Complete the generated 图文绑定 storage loop after the existing xAI base64 generation smoke path: convert a successful generated illustration into a local WebP asset, record a ready 图文卡片 with a browser-renderable public image URL, and keep failed storage/conversion attempts out of the ready pool.

## Source issue

- GitHub issue: https://github.com/dnslin/sentence/issues/8
- Parent: #1
- Blocker: #7 is closed.

## Confirmed facts

- The current generation path stops at `generateXaiIllustrationForHitokotoSentence(...)`, which returns decoded image bytes and records `generation_attempts` metadata. It does not create public image URLs or ready cards.
- The current xAI image request uses `response_format: "b64_json"`; there is no temporary model URL in the current implementation. The storage loop therefore persists the decoded model image result from memory and must not retain a raw/original file after conversion.
- `cards.illustration_path` already exists but is nullable, and `PublicReadyCard` currently omits any illustration URL.
- The homepage currently renders a CSS illustration fallback. It must keep working for seeded/mock rows with `illustration_path = null` while rendering a real WebP image when a generated card has a stored image path.
- ADR 0003 requires SQLite for metadata and local WebP files for generated illustrations instead of SQLite blobs or temporary model URLs.
- Generation-pipeline behavior tests use `node:test` under `node-tests/`; route-visible homepage/API behavior uses Playwright e2e tests.

## Requirements

1. Store successful generated illustrations as WebP files in a local VPS data area.
   - Use WebP quality `88` for conversion.
   - Use a configurable generated-illustration root with a safe default under `data/`.
   - Store only the final WebP as the durable asset; raw/original model image files and temporary conversion files must not remain after successful conversion.
2. Preserve failed state without admitting failed cards to the ready pool.
   - A storage or conversion failure must update the related generation attempt to `status = 'failed'` with a sanitized error stage/message.
   - A storage or conversion failure must not create or update a ready `cards` row.
   - Partial files must be cleaned up when possible.
3. Record successful 图文绑定 metadata in SQLite.
   - The database must record a ready `cards` row with `illustration_path` set to the same-origin public WebP URL.
   - The ready card must retain the project domain shape: one 随机短句, one canonical 非署名绘本风 illustration, current card style version, scene label, and accent fallback metadata.
   - Do not store raw base64 or large binary blobs in SQLite.
4. Serve generated illustration assets through a public image URL.
   - The URL must be same-origin and safe for browser rendering and DOM-to-PNG export.
   - The image-serving route must only resolve validated WebP filenames under the configured generated-illustration root.
   - Missing or invalid asset requests must not expose arbitrary filesystem paths.
5. Update public card rendering contracts.
   - `PublicReadyCard` / `ReadyCardResponse` must expose an `illustrationUrl: string | null` field.
   - API and homepage consumers must use the shared typed DTO/guard.
   - `QuietGalleryCard` must render a real `<img>` with the existing scene label when `illustrationUrl` exists, and retain the current CSS fallback for null illustration URLs.
6. Follow strict TypeScript type safety.
   - External bytes, file paths, DB rows, and route params must be normalized at clear boundaries.
   - Avoid unsafe casts except after runtime guards.

## Acceptance criteria

- [ ] A controlled successful xAI generation result is converted to a local `.webp` file at quality `88` under the generated-illustration data area.
- [ ] Original model image files and conversion temp files are not retained after successful conversion.
- [ ] The successful storage path creates or updates a ready 图文卡片 row with a public same-origin WebP URL in `cards.illustration_path`.
- [ ] `GET /api/ready-card` returns `illustrationUrl` through the shared public DTO and only returns rows with valid ready-card fields.
- [ ] `/` renders the stored WebP image for a card that has `illustrationUrl`, and still renders the existing fallback illustration for seeded cards with `illustrationUrl = null`.
- [ ] The public generated-image route serves valid WebP files with `image/webp` and rejects missing/invalid filenames without path traversal.
- [ ] Failed storage or conversion attempts record `generation_attempts.status = 'failed'`, preserve sanitized failure details, do not create/update a ready card, and do not leave partial durable assets.
- [ ] No raw base64 payloads or image blobs are written to SQLite.
- [ ] Requirement-driven TDD is followed vertically: each behavior is introduced by a failing public-interface test, then implemented, then refactored while green.
- [ ] `pnpm test:xai`, `pnpm test:hitokoto`, `pnpm db:setup`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass.

## Out of scope

- Worker scheduling, pool replenishment thresholds, or batch generation orchestration.
- Docker Compose production wiring.
- Real download/share PNG behavior.
- Live xAI smoke execution without user-provided credentials.
- Introducing user accounts, saved history, gallery semantics, or multiple independent images for one 图文绑定.

## Open questions

None blocking. The repository and issue define the needed public behavior; implementation should prefer same-origin local file serving from the data area rather than writing runtime assets into Next.js `public/`.
