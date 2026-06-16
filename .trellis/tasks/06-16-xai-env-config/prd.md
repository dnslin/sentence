# Manage xAI configuration through environment

## Goal

Allow the server-side xAI client configuration to be managed through environment variables so deployments can configure both credentials and the OpenAI-compatible xAI API base URL without code edits.

## User Value

Operators can set or override xAI credentials and endpoint configuration in `.env` / deployment environment configuration. This keeps provider-specific configuration outside source code while preserving the existing safe server-only boundary for secrets.

## Confirmed Facts

- `XAI_API_KEY` is already read from server-side environment variables in `lib/generation/xai-config.ts`.
- The xAI base URL is currently hard-coded as `https://api.x.ai/v1` in `lib/generation/xai-config.ts`.
- Production SDK construction happens through `createProductionXaiClient(...)` in `lib/generation/xai-client.ts`.
- Worker and smoke scripts validate xAI configuration before live generation paths.
- Existing tests cover missing `XAI_API_KEY` and production client creation with preloaded config.
- Project docs and specs currently describe a fixed xAI base URL.

## Requirements

1. The xAI base URL must be configurable from the server-side `XAI_BASE_URL` environment variable.
2. `XAI_API_KEY` must continue to be read only from server-side environment variables and must not be exposed in client bundles, public responses, logs, database rows, or user-facing errors.
3. The configuration loader must fail before SDK construction or live xAI calls when `XAI_API_KEY` is missing.
4. The default xAI base URL must remain `https://api.x.ai/v1` when the base URL environment variable is unset, preserving current behavior for existing deployments.
5. Blank or whitespace-only base URL environment values must not produce an invalid SDK config; they should fall back to the default base URL.
6. Tests must cover environment-provided base URL, fallback default base URL, and existing missing-key behavior.
7. Documentation that names xAI environment variables or fixed base URL behavior must be updated to describe the new environment-managed configuration.

## Acceptance Criteria

- [ ] `loadXaiConfig(...)` returns the base URL from `XAI_BASE_URL` when it is set to a non-blank value.
- [ ] `loadXaiConfig(...)` returns `https://api.x.ai/v1` when `XAI_BASE_URL` is unset or blank.
- [ ] Missing `XAI_API_KEY` still throws `XaiConfigurationError` before client construction.
- [ ] Existing direct injection into `createProductionXaiClient({ apiKey, baseURL })` continues to work.
- [ ] Automated tests cover the new env-var behavior and pass with `pnpm test:xai`.
- [ ] Project-facing documentation mentions both `XAI_API_KEY` and `XAI_BASE_URL`.

## Out of Scope

- Changing xAI model names, prompt behavior, image generation request shape, or rate limits.
- Adding client-visible xAI configuration.
- Adding support for multiple providers or provider switching.
- Changing Playwright `baseURL`, which is unrelated to xAI API configuration.

## Open Questions

- None. The base URL environment variable name is `XAI_BASE_URL`.