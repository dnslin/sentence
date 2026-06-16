# Design: xAI image base64 validation failures

## Problem Boundary

The production xAI image path is already JSON/base64 oriented:

```text
sdk.images.generate(...) -> data[0].b64_json -> normalizeGeneratedBase64Image(...) -> Sharp WebP conversion -> cards.illustration_path
```

The failing boundary is `normalizeGeneratedBase64Image(...)`: it treats a missing or unsupported provider MIME as `image/png`, then validates decoded bytes against PNG. That makes valid non-PNG image bytes fail before Sharp can convert them.

## First-Principles Reasoning

- A base64 string is only an encoding of bytes; it does not prove a media type.
- MIME metadata from an external provider can be missing, stale, or unsupported by the SDK type surface.
- The decoded bytes carry deterministic file signatures for the formats this project supports: PNG, JPEG, and WebP.
- The storage layer needs decodable image bytes, not specifically PNG bytes, because Sharp converts supported input bytes to canonical WebP.
- Therefore the normalizer should derive the accepted MIME from decoded bytes when provider MIME is absent or unusable, and reject bytes that do not identify as a supported image.

## Data Flow

1. Validate that `b64Json` is non-empty base64 text and normalize padding.
2. Decode bytes once.
3. Detect actual supported image MIME from byte signatures:
   - PNG signature: `89 50 4E 47 0D 0A 1A 0A`
   - JPEG signature: `FF D8 ... FF D9`
   - WebP signature: `RIFF....WEBP`
4. If provider MIME is one of the supported types and matches detected bytes, keep it.
5. If provider MIME is missing or unsupported, use the detected MIME.
6. If no supported byte signature is detected, throw `GeneratedImageNormalizationError` with an image-validation message.

## Compatibility

- Existing valid PNG behavior remains unchanged.
- Existing invalid base64 and non-image base64 failures remain `image_validation` failures.
- Existing database schema remains valid because `generation_attempts.image_mime_type` is a free text metadata column.
- Existing smoke artifact extension mapping already supports PNG/JPEG/WebP.
- Existing storage behavior remains valid because Sharp accepts the supported decoded input bytes and writes WebP.

## Trade-Offs

- Trusting byte signatures over absent metadata avoids false failures from provider JSON that lacks `mime_type`.
- Keeping declared-MIME mismatch rejection catches genuinely inconsistent provider output and protects metadata accuracy.
- This fix does not add support for every image format; it stays limited to the three formats already documented and tested.

## Rollback

Revert the normalizer and tests if this broadens acceptance too far. No migration or data rollback is needed.
