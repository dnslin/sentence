# Add xAI prompt rewrite and image generation smoke path: Implementation Plan

## Test Scenarios From Requirements

1. Happy path — controlled Hitokoto response is stored, controlled `grok-4.3` rewrite returns a concrete prompt, controlled `grok-imagine-image-quality` returns base64, and the pipeline records a non-ready successful generation attempt with MIME/byte/digest metadata.
2. Prompt fallback — prompt rewriting throws or returns unusable content; pipeline uses the deterministic 非署名绘本风 fallback prompt, records fallback usage, and still generates the image.
3. Image generation retry — first image generation call fails; second call succeeds; pipeline records two image attempts and a successful non-ready state.
4. Image validation retry — first image response has empty/invalid base64; second call succeeds or, in a separate scenario, fails again and records failed state.
5. Exhausted image failure — both image generation attempts fail; attempt row is `failed` with sanitized `error_stage='image_generation'` and no base64 blob.
6. Missing credentials — production xAI config fails clearly before any live SDK call when `XAI_API_KEY` is absent.
7. Smoke command guard — smoke path communicates that `XAI_API_KEY` is required and does not echo secrets or base64 payloads.
8. Regression — existing Hitokoto ingestion and ready-card public behavior are unchanged.

## Ordered TDD Checklist

### Setup and dependency

- [ ] Add `openai` dependency with `pnpm add openai` so the lockfile is updated by pnpm.
- [ ] Add focused scripts to `package.json`, likely:
  - `test:xai`: `node --import tsx --test node-tests/xai-generation-pipeline.test.ts`
  - `smoke:xai`: `tsx scripts/smoke-xai-generation.ts`
- [ ] Keep existing `test:hitokoto` unchanged.

### Vertical slice 1: successful controlled pipeline

- [ ] RED 1: add one Node test that uses temporary SQLite and controlled Hitokoto + xAI client responses to assert successful rewrite/image metadata and `image_generated` row.
- [ ] GREEN 1: add additive `generation_attempts` schema/migration, attempt repository, xAI adapter interface, prompt normalizer, base64 normalizer, and pipeline orchestration needed for the test.

### Vertical slice 2: prompt fallback

- [ ] RED 2: add one test where prompt rewrite throws or returns blank and assert deterministic fallback prompt, `prompt_source='fallback'`, and image generation still succeeds.
- [ ] GREEN 2: implement fallback prompt builder and prompt rewrite error handling without swallowing image errors.

### Vertical slice 3: image generation retry

- [ ] RED 3: add one test where first image generation call throws and second succeeds; assert two attempts and success.
- [ ] GREEN 3: implement one-retry wrapper around image generation only.

### Vertical slice 4: base64 validation retry/failure

- [ ] RED 4: add one test where first `b64_json` is invalid/empty and second succeeds.
- [ ] GREEN 4: harden base64 validation and retry on invalid output.
- [ ] RED 5: add one test where validation fails twice and assert failed row with sanitized metadata and no raw base64.
- [ ] GREEN 5: persist failed state after retry exhaustion.

### Vertical slice 5: server-only config and production adapter

- [ ] RED 6: add test for missing `XAI_API_KEY` failing before SDK construction/calls.
- [ ] GREEN 6: implement config loader and production OpenAI-compatible client factory with `baseURL: "https://api.x.ai/v1"`.
- [ ] Add production adapter mapping:
  - chat model `grok-4.3`
  - image model `grok-imagine-image-quality`
  - `response_format: "b64_json"`
  - `n: 1`
  - xAI-specific `aspect_ratio: "1:1"` and `resolution: "1k"` via direct typed fields or SDK extension (`extra_body`) if needed.

### Vertical slice 6: smoke command

- [ ] RED/guard: add behavior-level smoke helper tests if practical for missing credentials and safe output formatting.
- [ ] GREEN: implement `scripts/smoke-xai-generation.ts`:
  - opens DB through shared client
  - runs migrations assumption/documented `pnpm db:setup` prerequisite or invokes shared DB path after setup
  - fetches/stores one Hitokoto sentence
  - runs real xAI rewrite/image generation
  - optionally writes decoded image bytes under `test-results/xai-smoke/`
  - prints attempt ID, sentence ID, prompt source, MIME, bytes, digest prefix/full digest, and artifact path if written
  - never prints `XAI_API_KEY` or raw base64.

### Refactor and docs/spec hygiene

- [ ] Refactor duplicated retry/status logic into small helpers only if duplication appears in 2+ places.
- [ ] Update `.trellis/spec/backend/database-guidelines.md` after implementation if a new durable generation-attempt contract is established.
- [ ] Keep frontend specs untouched unless frontend files change.

## Validation Commands

Run after implementation:

- `pnpm test:xai`
- `pnpm test:hitokoto`
- `pnpm db:setup`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test:e2e`

Manual/live smoke, only when the user has configured credentials:

- `XAI_API_KEY=<redacted> pnpm smoke:xai`

If live smoke is not run because credentials are unavailable, report that explicitly and do not claim live xAI verification.

## Risky Files / Rollback Points

- `lib/db/schema.ts` and `drizzle/0004_generation_attempts.sql`: migration must be additive and must not weaken existing `cards.status` behavior.
- `package.json` / `pnpm-lock.yaml`: dependency and script changes should be pnpm-managed.
- `lib/generation/xai-client.ts`: must stay server-only; do not import from client components or public route payload code.
- `scripts/smoke-xai-generation.ts`: may make real external calls and incur cost; missing credentials must stop before xAI calls.
- `node-tests/xai-generation-pipeline.test.ts`: keep under `node-tests/` so Playwright `testDir: "./tests"` remains browser-only.
- `test-results/xai-smoke/`: safe ignored smoke artifact area; do not write generated images into public asset paths in this slice.

## Pre-Start Review Gate

- PRD has no blocking open questions.
- Design keeps local WebP storage and ready-card publication out of scope.
- Test plan maps each requirement to at least one behavior scenario.
- Context7 research and user base64 confirmation are captured.
- Implement/check manifests include the relevant specs and research file.
- User approves starting implementation after reviewing these artifacts.
