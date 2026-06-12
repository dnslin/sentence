# Add xAI prompt rewrite and image generation smoke path: Design

## First-Principles Analysis

### Challenge Assumptions

- Assumption: image generation should immediately create a ready 图文卡片. This is wrong for issue #7 because public WebP storage and ready-card serving are issue #8 responsibilities.
- Assumption: xAI image output should be treated as a URL to download. The user confirmed the project path returns base64 images; URL download logic would solve the wrong boundary.
- Assumption: base64 can be stored directly in SQLite for convenience. This conflicts with ADR 0003's local-file direction and creates large DB blobs without user-facing value in this slice.
- Assumption: prompt rewrite failure should fail the whole pipeline. Issue #7 explicitly requires a fixed-template fallback, so prompt rewrite is an optimization over a deterministic prompt, not a hard dependency.
- Assumption: TypeScript SDK types make external responses trustworthy. They do not prove runtime shape from an OpenAI-compatible provider; response content still needs normalization at the integration boundary.
- Assumption: a smoke command can hide missing credentials by skipping xAI calls. That would not be a real smoke path; missing credentials must fail clearly before network calls.

### Decompose to Bedrock Truths

- A generated illustration attempt needs one durable sentence row as input.
- `XAI_API_KEY` is a secret; any client bundle, public route response, DB row, or log line containing it is an irreversible exposure.
- External APIs can fail, return malformed content, or return provider-specific fields outside local assumptions.
- Retry can only make sense around idempotent or safely repeatable external steps; prompt rewrite has a deterministic fallback, while image generation gets one retry before failed state.
- SQLite stores small relational facts well; large base64 image blobs are file-like binary payloads and should not become relational facts.
- A future storage slice needs enough metadata to know which attempt succeeded and whether bytes were valid, but it does not need base64 persisted in SQLite.
- Tests must prove local behavior without live credentials; live xAI belongs only to the smoke command.

### Rebuild From Ground Up

1. Keep Hitokoto ingestion as the first pipeline step and reuse its existing public boundary.
2. Introduce a small xAI adapter interface owned by `lib/generation/`, with methods for prompt rewrite and base64 image generation.
3. Implement production adapter with the OpenAI-compatible SDK configured by server-only environment (`XAI_API_KEY`, `https://api.x.ai/v1`).
4. Normalize prompt rewrite output to a bounded non-empty string. If that fails, build a deterministic fallback prompt from the sentence and 非署名绘本风 constraints.
5. Request one image with `grok-imagine-image-quality`, `response_format: "b64_json"`, `aspect_ratio: "1:1"`, `resolution: "1k"`, and `n: 1` or the SDK extension mechanism for xAI-specific fields.
6. Decode/validate base64 in memory, capture MIME type, decoded byte length, and SHA-256 digest, and discard bytes unless the smoke command writes an ignored inspection artifact.
7. Persist a generation attempt row for every run with status transitions and non-secret error metadata.
8. Never mark `cards.status='ready'`; issue #8 will convert/store local WebP and connect to the ready pool.
9. Expose a smoke script that fails before xAI calls when `XAI_API_KEY` is missing, then runs the real path and prints safe summary metadata.

### Contrast With Convention

A conventional shortcut would call the SDK directly from a script, dump base64 to a file, and skip database state. That would prove only a one-off API call. The fundamental design here treats xAI as a typed server-side pipeline boundary: secrets stay local, malformed output is contained, failure state is durable, and later storage work can build on the same state instead of reverse-engineering script output.

### Conclusion

The correct slice is a server-only xAI generation module plus an additive generation-attempt table and smoke command. It proves real prompt/image generation with base64 output while preserving issue #8's ownership of WebP storage and ready-card publication.

## Architecture and Boundaries

### Files to Add or Change

- `package.json` / `pnpm-lock.yaml` — add `openai` dependency and focused xAI generation test/smoke scripts.
- `lib/generation/xai-config.ts` — server-side config loader and missing-key error.
- `lib/generation/xai-client.ts` — OpenAI-compatible production adapter and typed request constants.
- `lib/generation/illustration-prompt.ts` — prompt rewrite system/user prompt construction, output normalization, fixed fallback prompt.
- `lib/generation/image-result.ts` — base64 image normalization, MIME/byte/digest metadata, failure classes.
- `lib/generation/generation-attempt-repository.ts` — Drizzle persistence for attempt lifecycle/status updates.
- `lib/generation/xai-generation-pipeline.ts` or an expanded `hitokoto-pipeline.ts` boundary — orchestration after Hitokoto sentence storage.
- `lib/db/schema.ts` — additive generation attempt table.
- `drizzle/0004_generation_attempts.sql` — additive migration.
- `node-tests/xai-generation-pipeline.test.ts` — controlled behavior tests with no live credentials.
- `scripts/smoke-xai-generation.ts` — real smoke command.
- `README.md` or task-adjacent docs only if a repo doc already exists and needs command documentation; otherwise keep smoke guidance in script output and `package.json` name.

### Proposed Database Model

Use a separate table instead of widening `cards` because generated outputs are not ready cards yet.

```text
generation_attempts(
  id text primary key,
  sentence_id text not null references sentences(id),
  status text not null check(status in ('started','prompt_fallback','image_generated','failed')),
  prompt_model text not null,
  image_model text not null,
  prompt_text text not null,
  prompt_source text not null check(prompt_source in ('rewrite','fallback')),
  image_mime_type text,
  image_byte_length integer,
  image_sha256 text,
  error_stage text check(error_stage in ('prompt_rewrite','image_generation','image_validation','smoke_write') or error_stage is null),
  error_message text,
  image_generation_attempts integer not null,
  created_at integer not null,
  updated_at integer not null
)
```

Status semantics:

- `started` — row created before external xAI work or before image result is valid.
- `prompt_fallback` — prompt rewrite failed or was unusable; fallback prompt is being used. This may be an intermediate status before image generation.
- `image_generated` — base64 image validated in memory and metadata recorded; not public-ready.
- `failed` — image generation, image validation, or optional smoke artifact write failed after retry.

The repository can update one row through the attempt lifecycle. It should not create `cards` rows.

### Data Flow

```text
fetchAndStoreHitokotoSentence(...)
  → create generation_attempts row
  → rewrite prompt with grok-4.3
      ↳ on failure: fixed 非署名绘本风 fallback prompt
  → generate image with grok-imagine-image-quality, response_format=b64_json, aspect_ratio=1:1, resolution=1k, n=1
      ↳ retry once on SDK failure or unusable base64
  → normalize base64 to { mimeType, byteLength, sha256, bytes }
  → update generation_attempts with non-ready success or failed state
  → smoke optionally writes bytes to test-results/xai-smoke/
```

### xAI Adapter Contract

Keep production SDK details behind a small interface for deterministic tests:

```ts
type XaiGenerationClient = {
  rewriteIllustrationPrompt(input: {
    sentence: string
    systemPrompt: string
    userPrompt: string
  }): Promise<{ content: string | null }>
  generateBase64Image(input: {
    prompt: string
    aspectRatio: "1:1"
    resolution: "1k"
  }): Promise<{ b64Json: string | null; mimeType: string | null }>
}
```

Production adapter maps this to:

- `client.chat.completions.create({ model: "grok-4.3", messages: [...] })`
- `client.images.generate({ model: "grok-imagine-image-quality", prompt, response_format: "b64_json", n: 1, ...xAI-specific parameters })`

If OpenAI SDK types do not expose `aspect_ratio` / `resolution` directly, use the SDK-supported extension point such as `extra_body` while preserving local literal types at the adapter boundary.

### Prompt Contract

The prompt builder must include these stable constraints:

- Source sentence is a 随机短句 and must not be framed as user-authored input.
- Generate one concrete illustration scene, not text overlay, typography, logos, UI, or a poster.
- Non-attributed picture-book style only: gentle watercolor picture-book feeling, low saturation, generous whitespace, small human figures, city or nature motifs, fine lines, lonely-but-healing mood.
- Do not name living artists or imply imitation of a named artist.
- Keep output bounded, single-prompt, and image-model-ready.

Fallback template should be deterministic so tests can assert exact behavior.

### Base64 Image Contract

Normalize at one boundary:

- `b64_json` must be a non-empty string.
- Decode with `Buffer.from(value, "base64")` and reject empty output.
- Reject strings that do not round-trip as plausible base64 if Node's permissive decoder would otherwise accept garbage.
- MIME type defaults to a safe known value only if xAI omits it; prefer provider `mime_type` when it is a supported image MIME.
- Compute SHA-256 from decoded bytes.
- Do not log or persist raw base64.

### Error and Retry Contract

- Missing `XAI_API_KEY`: throw `XaiConfigurationError` before constructing live client calls; no retry.
- Prompt rewrite SDK error or unusable content: record fallback source and continue with fixed template; no image retry consumed.
- Image generation SDK error: retry once, then mark failed at `image_generation`.
- Unusable base64 response: retry once, then mark failed at `image_validation`.
- Optional smoke artifact write error: retry once, then mark failed at `smoke_write`.
- Persist sanitized error class/message only. Never persist request headers, API keys, raw SDK payloads, or base64.

### Compatibility and Migration Notes

- Migration is additive and does not alter existing `sentences`, `hitokoto_sentence_metadata`, `cards`, or `ready_card_views` rows.
- Existing ready-card API/homepage behavior remains unchanged.
- No public frontend code imports xAI modules.
- `cards.status` remains ready-only until a future slice introduces non-ready card states or connects generated image storage.

### Testing Strategy

Use requirement-driven Node tests with controlled clients and temporary SQLite:

1. Happy path: stored Hitokoto sentence → rewritten prompt → base64 image metadata → `image_generated` attempt row.
2. Prompt fallback: rewrite throws or returns blank → fallback prompt used → image generation still succeeds → row records `prompt_source='fallback'`.
3. Image generation retry: first image call throws → second succeeds → row records two attempts and success.
4. Image validation retry: first image response has invalid/empty base64 → second succeeds or fails according to scenario.
5. Exhausted failure: two image failures → row status `failed`, sanitized stage/message, no base64 persisted.
6. Missing credentials: config loader errors before live xAI client can make network calls.
7. Regression: existing `pnpm test:hitokoto` still passes.

### Operational and Rollback Considerations

- Real smoke command may incur xAI cost; script output should state that clearly before running when credentials are present.
- Smoke artifact path should be ignored (`test-results/xai-smoke/`) and safe to delete.
- Rollback removes the xAI generation modules/scripts and additive migration/table before production depends on them.
- If live smoke fails due to credentials/quota/provider error, report the provider failure without pretending local tests prove live availability.
