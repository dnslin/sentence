# Diagnose xAI image base64 validation failures

## Goal

Fix the ready-pool generation path so valid xAI image JSON responses that carry base64 image data can become generated 图文卡片 instead of failing image validation only because the provider omits `mime_type`.

## User Value

The worker should replenish the ready pool from real xAI image responses. Operators should see genuine failures in `generation_attempts`, not false `image_validation` failures for valid base64 images.

## Confirmed Facts

- The user observed repeated `generation_attempts` failures at `error_stage='image_validation'` with `Generated image bytes do not match image/png`.
- The provided rows have no stored image MIME/size/hash metadata, so validation failed before image metadata was recorded.
- The current production client asks xAI for JSON base64 output through `response_format: "b64_json"` and maps `data[0].b64_json` plus optional `data[0].mime_type`.
- The current normalizer defaults missing or unsupported MIME values to `image/png` before validating image bytes.
- A minimal offline repro confirms that valid JPEG base64 with `mimeType: null` fails with `Generated image bytes do not match image/png`.
- The storage layer already converts decoded image bytes to local WebP with Sharp and supports PNG/JPEG/WebP inputs when the normalizer accepts them.

## Requirements

- Accept valid base64 image data returned from xAI JSON when `mime_type` is missing or unsupported, as long as the decoded bytes identify a supported image format.
- Supported decoded image formats remain PNG, JPEG, and WebP.
- Record the MIME type that matches the decoded bytes when provider MIME is absent or unusable.
- Keep rejecting empty base64, structurally invalid base64, decoded non-image bytes, and unsupported image formats.
- Preserve retry behavior: image normalization failures retry once, then persist `status='failed'` with `error_stage='image_validation'`.
- Preserve the no-raw-image-data contract: do not store raw base64 or image blobs in SQLite or logs.
- Preserve secret redaction in persisted and displayed error messages.
- Do not change xAI model names, prompt rewrite behavior, ready-pool thresholds, daily cap semantics, or public card copy.

## Acceptance Criteria

- [x] A regression test proves valid JPEG or WebP base64 with missing MIME is accepted and records the inferred image MIME.
- [x] A regression test proves valid base64 text/non-image bytes with missing MIME still fails as `image_validation` after retry exhaustion.
- [x] Existing tests for PNG success, invalid base64 retry, provider failure retry, WebP storage conversion, smoke safety, and request shape still pass.
- [x] `pnpm test:xai` passes.
- [x] `pnpm typecheck` passes.
- [x] If implementation changes documented generation contracts, `.trellis/spec/backend/database-guidelines.md` is updated to match executable behavior.

## Out of Scope

- Live xAI smoke execution with real credentials unless the operator explicitly chooses to run it.
- Changing generated illustration storage format away from local WebP.
- Changing worker scheduling, inventory targets, or daily cap accounting.
- Backfilling already failed `generation_attempts` rows.
