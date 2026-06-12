# Add xAI prompt rewrite and image generation smoke path

## Goal

Connect the server-side generation pipeline to xAI for the next 句画 MVP slice: take one stored Hitokoto 随机短句, rewrite it into a concrete 非署名绘本风 illustration prompt with `grok-4.3`, generate one 1K square base64 illustration with `grok-imagine-image-quality`, and expose a real smoke path that only runs when the user manually provides `XAI_API_KEY`.

## User Value

This slice proves the real model path for future 图文绑定 before the project adds production local WebP storage and ready-pool worker automation. It lets a developer verify that sentence ingestion, prompt rewriting, and image generation can run end-to-end without exposing secrets or marking incomplete image assets as public ready cards.

## Source Issue

- GitHub issue: #7 `[Slice 06] Add xAI prompt rewrite and image generation smoke path`
- Parent: #1 句画 MVP
- Blocked by: #6, already closed in GitHub and implemented in this repository.
- Follow-up boundary: #8 stores generated illustrations as local WebP, records the public image path, and marks 图文卡片 ready.

## Confirmed Facts

- Existing generation entry: `fetchAndStoreHitokotoSentence({ client, fetchFn? })` in `lib/generation/hitokoto-pipeline.ts`.
- Existing Hitokoto ingestion persists `sentences` plus `hitokoto_sentence_metadata` and deliberately does not call xAI or create ready cards.
- Current `cards.status` only allows `'ready'`; generation status is not yet modeled despite ADR 0003 requiring generation status in SQLite.
- Current local test style for generation is Node `node:test` under `node-tests/` with controlled external responses and temporary SQLite databases.
- `package.json` has `test:hitokoto`; there is no general unit-test runner beyond Node tests and Playwright e2e.
- Context7 xAI docs confirm OpenAI-compatible API usage:
  - base URL: `https://api.x.ai/v1`
  - JavaScript OpenAI SDK can initialize with `apiKey`, `baseURL`, and optional timeout.
  - chat completions use `client.chat.completions.create(...)`.
  - `grok-4.3` is a documented chat model example.
  - image generation uses `POST /v1/images/generations` / `client.images.generate(...)`.
  - `grok-imagine-image-quality` is the documented image generation model.
  - image generation supports `response_format: "b64_json"`.
  - image generation supports `aspect_ratio: "1:1"` and `resolution: "1k"` in the REST body.
  - image response data includes `b64_json`, `mime_type`, and may also include URL/file fields depending on request shape.
- User confirmed the project’s xAI image path returns base64 images, not image URLs.
- `XAI_API_KEY` must remain server-side only.
- `.gitignore` ignores `test-results/` but does not ignore arbitrary image files under `data/`.

## Requirements

1. xAI configuration
   - Add a server-only xAI client/config boundary using the OpenAI-compatible SDK setup.
   - Read `XAI_API_KEY` only from server-side environment variables.
   - Do not expose API keys in client bundles, public routes, logs, database rows, smoke output, or thrown user-facing messages.
   - Fail fast with a clear setup error when `XAI_API_KEY` is missing.

2. Prompt rewriting
   - Use `grok-4.3` to turn the stored 随机短句 into a concrete visual prompt.
   - The rewritten prompt must preserve the sentence as the source, avoid treating the sentence as user input or curated copy, and wrap the result in 非署名绘本风 visual constraints.
   - The prompt constraints must describe visual traits rather than naming a living artist.
   - The prompt output must be normalized to a non-empty bounded string before image generation.
   - If xAI prompt rewriting fails or returns unusable content, the pipeline must fall back to a deterministic fixed template using the sentence text and the agreed 非署名绘本风 constraints.

3. Image generation
   - Use `grok-imagine-image-quality` for image generation.
   - Request exactly one 1K square illustration with `response_format: "b64_json"`, `aspect_ratio: "1:1"`, and `resolution: "1k"` when calling the xAI image endpoint.
   - Feed image generation with the normalized rewritten prompt or fallback prompt.
   - Treat image generation output as external/untrusted data and normalize the base64 image payload before persistence or smoke output.
   - Do not implement URL download logic in this slice because the project path is base64-only.

4. Retry and failure recording
   - Image generation failures are retried once.
   - Invalid/unusable base64 image responses are retried once.
   - Smoke image file write failures, if the smoke command writes an inspection artifact, are retried once and then recorded as failed.
   - After the retry is exhausted, record the attempt as failed with enough non-secret diagnostic detail for future worker/status slices.
   - Prompt rewrite failure should not fail the whole pipeline by itself; it must record fallback usage and continue to image generation.

5. Pipeline and persistence
   - Extend the generation pipeline after Hitokoto sentence storage without changing existing ready-card public behavior.
   - Persist generation attempt/status data in SQLite via Drizzle migrations, not ad-hoc files.
   - Store base64 image bytes only as an in-memory pipeline/smoke result; do not store base64 blobs in SQLite.
   - Record successful base64 image metadata such as MIME type, decoded byte length, and SHA-256 digest so future issue #8 can validate handoff behavior without depending on database blobs.
   - Do not mark generated outputs as `cards.status='ready'` in this slice.
   - Keep future issue #8 compatible: successful model output must be usable in-memory for later local WebP conversion/storage.

6. Smoke command
   - Add a real smoke command that exercises Hitokoto ingestion, xAI prompt rewrite, and xAI image generation.
   - The command must clearly require the user to manually configure `XAI_API_KEY` before running.
   - When credentials are missing, the command must stop before network calls to xAI and print actionable setup guidance.
   - Smoke output must be safe to paste into logs: no secrets, no full credential echo, no large base64 payload dumps.
   - If the smoke command writes a decoded image artifact for visual inspection, write under an ignored path such as `test-results/xai-smoke/`, not a public asset path and not an unignored `data/` image path.

7. TypeScript type safety
   - External SDK responses and base64 payloads must be normalized from SDK-specific or `unknown` shapes at a single boundary.
   - Avoid `any`; any unavoidable type assertion must be local to a runtime guard and justified by actual SDK shape.
   - Public pipeline result types must model success, fallback, retry, and failure states explicitly.

## Acceptance Criteria

- [ ] xAI client configuration keeps API keys server-side only and fails clearly when `XAI_API_KEY` is absent.
- [ ] Prompt rewriting uses `grok-4.3` and produces a concrete visual prompt wrapped in 非署名绘本风 constraints.
- [ ] If prompt rewriting fails or produces unusable content, the pipeline falls back to a deterministic fixed template and records fallback usage.
- [ ] Image generation uses `grok-imagine-image-quality`.
- [ ] Image generation requests one 1K square base64 output via `response_format: "b64_json"`, `aspect_ratio: "1:1"`, and `resolution: "1k"`.
- [ ] Image generation or invalid base64 responses are retried once and then recorded as failed.
- [ ] Successful generation records a non-ready intermediate generation state compatible with future WebP storage without storing base64 blobs in SQLite.
- [ ] A real smoke command exists and clearly requires user-provided credentials before running.
- [ ] Tests cover successful prompt rewrite + image generation with controlled SDK responses.
- [ ] Tests cover prompt rewrite failure falling back to the fixed template.
- [ ] Tests cover image generation failure retrying once and recording failure.
- [ ] Tests cover invalid base64 image output retrying once and recording failure.
- [ ] Tests cover missing `XAI_API_KEY` failing before xAI network calls.
- [ ] `pnpm lint`, `pnpm typecheck`, focused generation tests, and existing relevant regression checks pass.

## Out of Scope

- Public homepage changes or new user-visible product copy.
- Real download/share behavior.
- Worker inventory thresholds, scheduling, daily caps, or background replenishment.
- Converting generated images to local WebP or serving final public image URLs.
- Marking generated cards as ready for the public pool.
- Storing base64 image blobs in SQLite.
- Admin/status UI.
- Docker/deployment changes beyond environment documentation for the smoke command.

## Open Questions

- None. User confirmed the project’s xAI image output is base64, not URL-based.
