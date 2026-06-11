# CLAUDE.md

@AGENTS.md

## Commands

- Install dependencies: `pnpm install`
- Start the development server: `pnpm dev`
- Build for production: `pnpm build`
- Start the built app: `pnpm start`
- Lint: `pnpm lint`
- Type-check: `pnpm typecheck`
- Format TypeScript/TSX files: `pnpm format`
- Add a shadcn UI component: `pnpm dlx shadcn@latest add <component>`

There is currently no `test` script or test runner configured in `package.json`, so there is no project command for running the full test suite or a single test file yet. For route-visible UI behavior, use lint/typecheck/build plus browser-observable checks appropriate to the change.

## Product language and constraints

句画 is a lightweight prototype that combines one random sentence with one non-attributed picture-book-style illustration into a shareable vertical 图文卡片.

Use the domain language from `CONTEXT.md` consistently:

- **图文卡片**: one shareable vertical artifact made from one 随机短句 and one 非署名绘本风 illustration.
- **一言 / 随机短句**: short sentence source; do not describe it as user input, article content, or curated healing copy.
- **图文绑定**: one canonical illustration belongs to one sentence under the current card shape/style; avoid independent gallery or random image-pool semantics in product copy.
- **刷新生成**: replaces the current card during the visit; it does not imply accounts, saved history, posting, or collections.
- **非署名绘本风**: describe visual traits, not a named living artist style.

Current public copy should stay truthful: refresh/download/share are still placeholder capabilities in the mock UI unless a later slice implements real behavior.

## Architecture overview

- This is a Next.js 16 App Router project using React 19, TypeScript strict mode, pnpm, Tailwind CSS v4, shadcn UI, and next-themes.
- `app/layout.tsx` sets Chinese metadata, imports `app/globals.css`, and wraps all routes in `components/theme-provider.tsx`.
- `/` is implemented by `app/page.tsx` -> `HomeExperience` -> `HomeCardExperience` -> `QuietGalleryCard`.
  - `app/home-card-source.ts` holds the local mock card data.
  - `HomeCardExperience` is the client state boundary for cycling mock cards and announcing placeholder actions.
  - `QuietGalleryCard` is the reusable visual card renderer for the current quiet-gallery direction.
- `/prototype` is a throwaway comparison route for three UI directions: `quiet-gallery`, `immersive-stage`, and `paper-desk`.
  - Query handling is client-side via `useSearchParams().getAll("variant")` inside a `Suspense` boundary so the route can remain static.
  - Missing, unknown, or repeated `variant` values fall back to `quiet-gallery`.
  - The floating prototype switcher is gated with `process.env.NODE_ENV !== "production"` and must not render in production DOM.
- `components/ui/` contains generated shadcn primitives. Import local primitives such as `Button` from `@/components/ui/button`; do not import directly from registry output or reimplement existing primitives.
- `lib/utils.ts` exposes `cn()` using `clsx` + `tailwind-merge`; use it for conditional Tailwind class composition.

## Styling and UI conventions

- Global design tokens live in `app/globals.css`; Tailwind v4 is configured through CSS imports and variables, not a separate `tailwind.config.*` file.
- shadcn config is in `components.json` with aliases: `@/components`, `@/components/ui`, `@/lib`, `@/hooks`, and `@/lib/utils`.
- Formatting is Prettier with no semicolons, double quotes, 2-space indentation, 80-column print width, and `prettier-plugin-tailwindcss` sorting classes against `app/globals.css`.
- Use semantic page structure (`main`, `section`, `article`, `nav`, `aside`) and keep prototype/debug controls visually and programmatically separate from production content.
- The theme provider enables system theme and a plain `d` key hotkey, ignoring typing targets and modified key events.

## Route and frontend contracts

Read `.trellis/spec/frontend/index.md` before frontend edits. The active project-specific frontend contracts are:

- `.trellis/spec/frontend/type-safety.md`: Next.js 16 page `searchParams` are promises when used in Server Components; normalize `string | string[] | undefined` once at the route boundary. For static local UI variant selection, prefer client `useSearchParams()` under `Suspense` and normalize repeated values with `getAll()`.
- `.trellis/spec/frontend/quality-guidelines.md`: prototype-only controls must be excluded from production DOM, not merely hidden with CSS. Browser-visible route behavior should be checked through the browser or an equivalent public interface when it is the contract.
- When checking Tailwind transform/reduced-motion behavior, inspect emitted individual properties such as `rotate`, `scale`, or `translate`, not only `transform`.
- `next.config.ts` currently allows the development origin `127.0.0.1` for local browser automation; do not replace this with wildcard CORS headers.

## Deployment and future backend direction

Accepted ADRs in `docs/adr/` describe the intended production shape, even though the current app is still a local mock/prototype:

- Self-host on a single overseas VPS with Docker Compose and separate `web` and `worker` services from the same Next.js/Node image.
- Serve users from a hybrid pregenerated pool of ready 图文卡片; target around 200 ready cards and replenish below 50, while handling empty-stock states.
- Store sentence/card metadata, rate-limit state, and generation status in SQLite WAL via Drizzle; store generated illustrations as local WebP files rather than SQLite blobs or temporary model URLs.

Do not introduce product semantics that conflict with these ADRs without updating or superseding the relevant ADR.

## Trellis project context

This repository is managed by Trellis. `AGENTS.md` points to the working knowledge under `.trellis/`:

- `.trellis/workflow.md` for task phases and routing.
- `.trellis/spec/` for package/layer-scoped coding guidelines.
- `.trellis/tasks/` for PRDs, research, and task artifacts.
- `.trellis/workspace/` for journals and session traces.

When implementing a Trellis-tracked task, read the current task artifacts and the relevant `.trellis/spec/` guide before editing.
