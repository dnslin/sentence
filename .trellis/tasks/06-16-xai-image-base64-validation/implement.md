# Implementation Plan: xAI image base64 validation failures

## Checklist

1. Add failing regression coverage in `node-tests/xai-generation-pipeline.test.ts`:
   - valid JPEG or WebP base64 with `mimeType: null` is accepted and records inferred MIME.
   - non-image base64 with `mimeType: null` remains an `image_validation` failure after two attempts.
2. Update `lib/generation/image-result.ts`:
   - decode base64 once.
   - detect actual MIME from PNG/JPEG/WebP byte signatures.
   - use detected MIME when provider MIME is missing or unsupported.
   - keep rejecting bytes without a supported image signature.
3. Run the focused feedback loop:
   - `pnpm test:xai`
4. Run project-level verification relevant to a TypeScript backend change:
   - `pnpm typecheck`
5. Update `.trellis/spec/backend/database-guidelines.md` if the executable contract wording needs to mention MIME inference from decoded bytes.
6. Re-run focused checks after any spec/test/code adjustment.

## Risk Points

- `normalizeGeneratedBase64Image(...)` is shared by smoke and ready-card generation; tests must cover both metadata and failure behavior.
- Error text should remain useful but must not include raw base64 or secrets.
- Do not change the production xAI request body unless evidence shows it is wrong; current request shape is already covered by tests and specs.

## Validation Commands

```bash
pnpm test:xai
pnpm typecheck
```

Optional operator-only live check if credentials are available and external API cost is acceptable:

```bash
pnpm smoke:xai
```
