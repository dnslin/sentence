# [Issue #2] Bootstrap 句画 app shell and UI prototype route

## Goal

Create the base 句画 app shell and a throwaway UI prototype route that presents three structurally different visual directions: Quiet Gallery, Immersive Stage, and Paper Desk.

## User Value

The team can open one documented local command, compare three shareable prototype variants, and choose the public experience direction before building the real Quiet Gallery page in Slice 02.

## Confirmed Facts

- Source requirement: GitHub issue #2, open, labelled `epic:juhua-mvp`, `ready-for-agent`, `afk`, `priority:p1`, `type:feature`, `area:ui`.
- Parent: issue #1 / Trellis task `.trellis/tasks/06-09-juhua-mvp-issue-1`.
- Blocked by: none; this is the first implementation target.
- Current app is a Next.js 16.2.6 / React 19.2.4 / TypeScript / Tailwind / shadcn app with a placeholder homepage.
- Existing scripts: `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm format`, `pnpm typecheck`.
- Current README is a generic Next.js template and does not document the 句画 command.
- Existing project vocabulary is defined in `CONTEXT.md` and must be used: 句画, 图文卡片, 随机短句, 非署名绘本风.
- Accepted future direction is Quiet Gallery, but this slice must still expose three prototype variants.
- Next.js 16 App Router page `searchParams` is asynchronous and should be awaited in Server Components.
- `agent-browser` is available as a Playwright-backed CLI and supports `open`, `snapshot`, `get`, `find`, `screenshot`, and related browser checks.

## Requirements

- Document the one local command to start the app: `pnpm dev`.
- Provide a throwaway prototype route at `/prototype`.
- Provide three variants selected by `?variant=`:
  - `quiet-gallery`: single centered 4:5 图文卡片, calm whitespace, action row separated from card.
  - `immersive-stage`: larger stage-like visual emphasis with sentence/action context arranged differently from Quiet Gallery.
  - `paper-desk`: paper/desktop composition that is structurally different from both previous variants.
- Missing, invalid, or array-like variant values must fall back to `quiet-gallery` without an error page.
- Render a floating prototype switcher that is visibly separate from page content in non-production builds.
- Hide the prototype switcher in production builds.
- Use Chinese-first app copy and the required project vocabulary.
- Keep the prototype data local/static; do not fetch Hitokoto, call xAI, persist data, implement refresh, download, share, or final homepage behavior in this slice.
- Follow TDD vertical slices: one browser-observable behavior check, minimal implementation, repeat.

## Acceptance Criteria

- [ ] The app can be started with the documented `pnpm dev` command.
- [ ] `/prototype` is available and renders the Quiet Gallery default variant.
- [ ] `/prototype?variant=quiet-gallery`, `/prototype?variant=immersive-stage`, and `/prototype?variant=paper-desk` render distinct visible variants.
- [ ] Invalid or missing variant values fall back to Quiet Gallery without an error page.
- [ ] The prototype switcher is visibly separate from the page in non-production builds.
- [ ] The prototype switcher is hidden in production builds.
- [ ] The route uses the vocabulary: 句画, 图文卡片, 随机短句, 非署名绘本风.
- [ ] TDD browser checks through `agent-browser` cover route availability, variant selection, invalid fallback, vocabulary rendering, and production switcher hiding.
- [ ] `pnpm lint`, `pnpm typecheck`, and relevant `agent-browser` checks pass before completion.

## Resolved Decisions

- The throwaway prototype route will be `/prototype`, with active variants selected by `?variant=`.
- Use `agent-browser` as the Playwright-backed automated browser check for TDD instead of adding a separate Playwright dependency in this slice.
- Default variant is `quiet-gallery` because it is the accepted future public direction and the only provided visual prototype asset.

## Out of Scope

- Final homepage Quiet Gallery implementation for Slice 02.
- SQLite/Drizzle, API routes, Hitokoto, xAI, image generation, local WebP storage, workers, rate limiting, download, share, Docker, admin status, backups, and external smoke tests.
- User accounts, saved history, user-submitted sentences, independent gallery assets, and named living-artist styles.

## Open Questions

- None before drafting design and implementation plan.
