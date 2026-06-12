# xAI Context7 Research

## Source

- Context7 library: `/websites/x_ai_developers`
- xAI docs snippets returned from:
  - https://docs.x.ai/developers/model-capabilities/legacy/chat-completions.md
  - https://docs.x.ai/developers/model-capabilities/imagine.md
  - https://docs.x.ai/developers/model-capabilities/images/generation.md
  - https://docs.x.ai/developers/rest-api-reference/inference/images.md
  - https://docs.x.ai/developers/model-capabilities/text/streaming.md

## Confirmed facts

- xAI exposes an OpenAI-compatible API base URL: `https://api.x.ai/v1`.
- JavaScript OpenAI SDK initialization uses:
  - `import OpenAI from "openai"`
  - `apiKey: process.env.XAI_API_KEY`
  - `baseURL: "https://api.x.ai/v1"`
  - optional long timeout for reasoning models.
- Chat completions use `client.chat.completions.create(...)`.
- `grok-4.3` is shown in xAI chat completion examples.
- xAI docs examples read `XAI_API_KEY` from the environment; the project must keep this server-side only.
- Image generation endpoint is `POST /v1/images/generations`.
- OpenAI-compatible image generation uses `client.images.generate(...)`.
- `grok-imagine-image-quality` is the documented image generation model.
- Image generation request requires `prompt`; `model` is optional in the REST schema but required by issue #7.
- xAI image generation REST parameters include:
  - `response_format: "b64_json" | "url"`
  - `aspect_ratio: "1:1" | ...`
  - `resolution: "1k" | "2k"`
  - `n` for number of images.
- If `response_format: "b64_json"` is specified, response `data[*].b64_json` contains a base64-encoded image string without a data-URI prefix.
- Response data can include `mime_type`.
- JavaScript SDK example saves base64 with `Buffer.from(response.data[0].b64_json, "base64")`.
- Issue #8 owns converting/storing successful images as local WebP and marking cards ready. Issue #7 should not complete WebP storage or public image URL serving.
- User confirmed for this project: xAI returns base64 images, not image URLs.

## Planning implications

- Add the `openai` package only in implementation, with TypeScript types from the package.
- Create a server-only xAI client factory that rejects missing `XAI_API_KEY` before network calls.
- Keep credentials out of client components, public API payloads, DB rows, logs, and smoke output.
- Use injectable xAI client/test doubles at the pipeline boundary so tests verify behavior without live credentials.
- The smoke command should require a manually configured `XAI_API_KEY` and should fail with a clear setup message before making xAI requests when the key is missing.
- Request image generation with `model: "grok-imagine-image-quality"`, `response_format: "b64_json"`, `aspect_ratio: "1:1"`, `resolution: "1k"`, and `n: 1` if the SDK type accepts it.
- If the OpenAI SDK TypeScript surface does not include xAI-specific `aspect_ratio` or `resolution`, pass those parameters through the SDK-supported extension mechanism such as `extra_body`, while keeping the local request builder typed.
- Do not store base64 blobs in SQLite; store digest/size/MIME metadata and keep image bytes in memory for smoke output or future WebP conversion.
- If smoke writes an inspection image, use an ignored path such as `test-results/xai-smoke/`.
