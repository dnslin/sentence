# Design: local WebP generated-illustration storage

## First-principles reasoning

### Challenge assumptions

- Unverified assumption: generated images must live under Next.js `public/`. This is wrong for a runtime worker/web deployment because `public/` is build-time static content, not the durable VPS data area named by the ADR.
- Unverified assumption: the xAI result must be downloaded from a URL. Current code requests `b64_json`, so the actual boundary is decoded bytes in memory.
- Potentially wrong assumption: every ready card must have an image URL immediately. Existing seeded prototype cards have `illustration_path = null`, so public rendering must remain backward-compatible.
- Potentially wrong assumption: storing files alone is enough. The browser needs a same-origin URL and the ready-card DTO must carry it.

### Bedrock truths

- Browser rendering requires an HTTP-accessible URL, not a local filesystem path.
- SQLite rows should hold small metadata; WebP bytes belong in files per ADR 0003.
- A failed conversion cannot produce a valid ready 图文卡片 because the card would point at a missing or non-WebP asset.
- Current xAI output bytes can be converted directly; writing and keeping a raw original file is not necessary for durable operation.
- Existing public userspace must not break: seed cards with null illustration paths must still render.

### Rebuild from ground up

1. Normalize generated model output once into bytes and MIME metadata using the existing generation path.
2. Convert those bytes into exactly one durable WebP file under a configured generated-illustration data root.
3. Expose that file through a same-origin route that maps validated filenames to files under the data root.
4. Persist only the route URL in `cards.illustration_path` and expose it as `PublicReadyCard.illustrationUrl`.
5. The renderer chooses the real image when the URL exists; otherwise it keeps the current CSS fallback.
6. Any storage/conversion failure marks the attempt failed before the card becomes ready.

### Contrast with convention

A conventional static-site shortcut would write files into `public/` and assume the web server can see them. That is suboptimal here because the product direction is runtime generation on a VPS with a shared data area; a route backed by the data root is the smaller invariant and works for both browser rendering and worker-generated assets.

### Conclusion

Use a server-only storage module plus a public image-serving route. Persist same-origin WebP URLs in SQLite, not filesystem paths exposed to clients and not image blobs.

## Architecture and boundaries

### New or changed modules

- `lib/generation/generated-illustration-storage.ts`
  - Resolves the generated-illustration data root.
  - Converts a normalized generated image to WebP quality `88`.
  - Writes via temporary files and atomically moves the final `.webp` into place.
  - Cleans up raw source/temp files after success and best-effort after failure.
  - Returns `{ publicPath, filePath, byteLength, sha256 }` for the final WebP.
- `lib/cards/generated-ready-card-repository.ts`
  - Creates or updates the canonical ready card for `(sentence_id, style_version)` after storage succeeds.
  - Stores `illustration_path` as the same-origin public path.
  - Returns `PublicReadyCard` through existing DTO conversion rules.
- `lib/generation/xai-generation-pipeline.ts`
  - Adds a higher-level public function that composes existing Hitokoto+xAI generation, WebP storage, and ready-card persistence.
  - Existing `generateXaiIllustrationForHitokotoSentence(...)` remains available for the non-ready smoke path.
- `app/generated-illustrations/[filename]/route.ts`
  - Serves validated `.webp` files from the generated-illustration root with `Content-Type: image/webp`.
  - Returns `404` for invalid names or missing files.
- `lib/cards/public-ready-card.ts`, `lib/cards/ready-card-repository.ts`, `app/quiet-gallery-card.tsx`
  - Add `illustrationUrl: string | null` to public DTO/guard/repository mapping.
  - Render `<img>` when a URL exists and fallback visual otherwise.

### Database changes

- Extend `generation_attempts.error_stage` check to include storage/conversion failures, at minimum:
  - `image_storage`
  - `image_conversion`
- Add a uniqueness guard for canonical 图文绑定:
  - unique index on `cards(sentence_id, style_version)`.
- Keep `cards.status` constrained to `ready` for this slice; failed attempts are represented in `generation_attempts`, and failed rows do not enter `cards`.

### Data flow

```text
Hitokoto sentence
  → xAI prompt rewrite/fallback
  → xAI base64 image generation
  → normalized decoded bytes
  → WebP conversion at quality 88 in generated-illustration data root
  → cards row with status='ready' and illustration_path='/generated-illustrations/<id>.webp'
  → PublicReadyCard.illustrationUrl
  → API/homepage renderer
  → public image route streams local WebP
```

### Public contracts

```typescript
type PublicReadyCard = {
  id: string
  sentence: string
  sceneLabel: string
  accent: "dawn" | "rain" | "moon"
  status: "ready"
  illustrationUrl: string | null
}
```

Generated illustration URL shape:

```text
/generated-illustrations/<uuid>.webp
```

Generated illustration root:

```text
JUHUA_GENERATED_ILLUSTRATIONS_DIR=<absolute-or-relative-path>
# default: process.cwd()/data/generated-illustrations
```

### Compatibility

- Existing seed rows with null `illustration_path` remain valid and render the fallback art.
- Existing API clients using the shared guard must update to accept the new nullable `illustrationUrl` field.
- Existing generation smoke behavior remains non-ready unless the new higher-level storage function is called.

### Error handling

- Conversion errors from WebP creation are normalized to `image_conversion`.
- Filesystem write/rename/read errors are normalized to `image_storage`.
- Persisted error messages continue to use the existing secret sanitizer.
- The storage module best-effort deletes temporary raw/source and temp WebP files on both success and failure.

### Operational and rollback considerations

- Rolling back code after applying the migration leaves an extra unique index and broader `error_stage` constraint; both are backward-compatible with existing code.
- Generated WebP assets are runtime data and should be ignored by git.
- The public image route must not reveal absolute paths in responses or errors.
