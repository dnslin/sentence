# Implementation plan: issue 8 local WebP storage

## TDD scenarios

Follow vertical red-green-refactor slices. Do not write all tests first.

1. Successful generation-to-ready-card storage
   - RED: Add one `node:test` behavior that calls the new public pipeline with controlled Hitokoto and xAI inputs and asserts a ready card with `illustrationUrl`, a durable `.webp` file, no retained source/temp files, and no SQLite image blob/base64.
   - GREEN: Add WebP storage, card persistence, DTO mapping, migration/schema updates, and the composed pipeline.
   - REFACTOR: Extract storage/path helpers and keep types narrow.
2. Conversion failure stays non-ready
   - RED: Add one behavior where normalized-looking image bytes cannot be converted by Sharp and assert `generation_attempts.status='failed'`, `error_stage='image_conversion'`, no ready card, and no durable WebP.
   - GREEN: Normalize conversion errors and clean partial files.
   - REFACTOR: Simplify error mapping.
3. Storage failure stays non-ready
   - RED: Add one behavior where the configured generated-illustration root is unwritable/not a directory and assert `error_stage='image_storage'`, no ready card, and sanitized error text.
   - GREEN: Normalize filesystem failures.
4. Public image route
   - RED: Add route-visible/e2e coverage that a valid stored WebP URL returns `image/webp`, and invalid/missing filenames return `404` without path traversal.
   - GREEN: Implement `app/generated-illustrations/[filename]/route.ts`.
5. API/homepage rendering contract
   - RED: Add/extend Playwright behavior so a ready card with `illustration_path` appears in `GET /api/ready-card` as `illustrationUrl` and `/` renders a real image with that URL and scene label; existing null-image seed fallback still renders.
   - GREEN: Update DTO guard, repository selection, and `QuietGalleryCard`.
   - REFACTOR: Keep fallback and image branches simple and accessible.

## Ordered checklist

- [ ] Add `sharp` dependency for server-side image conversion.
- [ ] Update Drizzle schema and add committed SQL migration for expanded `generation_attempts.error_stage` and `cards(sentence_id, style_version)` uniqueness.
- [ ] Add `illustrationUrl: string | null` to `PublicReadyCard`, `ReadyCardResponse` guard, ready-card repository mapping, and e2e expected payloads.
- [ ] Implement generated-illustration root/path helpers and storage module.
- [ ] Implement ready-card persistence for stored generated illustrations.
- [ ] Add composed generation pipeline that stores WebP and marks ready only after successful storage.
- [ ] Implement public WebP route with filename validation and safe path resolution.
- [ ] Update `QuietGalleryCard` to render `<img>` when `illustrationUrl` exists and preserve CSS fallback when null.
- [ ] Add/update tests one behavior at a time following the TDD scenarios above.
- [ ] Add generated illustration data directory to `.gitignore`.
- [ ] Run formatting if needed.

## Validation commands

- `pnpm test:xai`
- `pnpm test:hitokoto`
- `pnpm db:setup`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test:e2e`

## Risky files and rollback points

- `drizzle/*.sql`, `lib/db/schema.ts`: migration mistakes can break local setup. Roll back schema/migration together.
- `lib/cards/public-ready-card.ts`: public API DTO change must be reflected in all guards/tests.
- `app/quiet-gallery-card.tsx`: must not regress seeded-card fallback or accessibility.
- `lib/generation/xai-generation-pipeline.ts`: keep existing smoke path behavior intact; new ready-card storage should be an additive function.
- `app/generated-illustrations/[filename]/route.ts`: path validation must prevent traversal and avoid leaking absolute paths.

## Review gate before start

- PRD, design, and implementation plan exist.
- User approves starting implementation from these artifacts.
- Then run `python ./.trellis/scripts/task.py start .trellis/tasks/06-12-issue-8-local-webp-storage` and load pre-development specs before editing.
