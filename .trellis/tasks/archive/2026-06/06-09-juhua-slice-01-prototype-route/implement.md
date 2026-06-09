# Implementation Plan — [Issue #2] Bootstrap 句画 app shell and UI prototype route

## TDD Scenario Inventory

Each scenario is verified through the public browser interface with `agent-browser`.

1. Route availability and vocabulary
   - Given the app is running, `/prototype` renders successfully.
   - The page visibly includes `句画`, `图文卡片`, `随机短句`, and `非署名绘本风`.
2. Default variant fallback
   - `/prototype` renders Quiet Gallery.
   - `/prototype?variant=unknown` renders Quiet Gallery without an error page.
3. Variant selection
   - `/prototype?variant=quiet-gallery` renders Quiet Gallery.
   - `/prototype?variant=immersive-stage` renders Immersive Stage.
   - `/prototype?variant=paper-desk` renders Paper Desk.
4. Development switcher
   - In the dev server, the floating prototype switcher is visible and separate from the main page content.
   - Switcher links expose shareable URLs for all three variants.
5. Production switcher hiding
   - In a production build/server, the switcher label is not visible in browser output.
6. Start command documentation
   - `README.md` documents `pnpm dev` as the local start command.

## Ordered Checklist

### Cycle 1 — Route and Vocabulary

1. Start the dev server with `pnpm dev`.
2. RED: open `/prototype` with `agent-browser`; confirm it fails or returns the existing 404/not-found state.
3. Implement the minimal `/prototype` page with default Quiet Gallery static content and required vocabulary.
4. GREEN: rerun `agent-browser open http://localhost:3000/prototype` and inspect text/snapshot for route availability and vocabulary.

### Cycle 2 — Variant Selection

1. RED: open `/prototype?variant=immersive-stage` and `/prototype?variant=paper-desk`; confirm those variant headings/structures are absent.
2. Add variant data and `searchParams` normalization for `quiet-gallery`, `immersive-stage`, and `paper-desk`.
3. GREEN: use `agent-browser` to verify each query value renders its corresponding visible variant.

### Cycle 3 — Invalid Fallback

1. RED: open `/prototype?variant=unknown`; confirm fallback behavior is not explicitly satisfied yet.
2. Add/adjust normalization so invalid, missing, or array-like values fall back to `quiet-gallery`.
3. GREEN: verify invalid and missing variant routes show Quiet Gallery and no error page.

### Cycle 4 — Prototype Switcher

1. RED: inspect `/prototype` in dev and confirm no separate floating switcher exists.
2. Add a non-production switcher rendered separately from main content, with links to all variants.
3. GREEN: verify the switcher is visible in dev and links point to `/prototype?variant=...`.

### Cycle 5 — Production Switcher Hiding

1. RED: reason from current implementation or run production build if switcher is always present.
2. Gate switcher rendering with `process.env.NODE_ENV !== "production"`.
3. Build and start production server.
4. GREEN: use `agent-browser` to verify production `/prototype` output does not include the switcher label.

### Cycle 6 — App Shell and Documentation

1. RED: inspect current README/homepage/layout and confirm generic template wording remains.
2. Update README with `pnpm dev` and 句画-specific wording.
3. Update app shell/homepage copy to Chinese-first without implementing Slice 02 behavior.
4. GREEN: verify README content by inspection and run final quality commands.

## Validation Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- Dev browser checks:
  - `agent-browser open http://localhost:3000/prototype`
  - `agent-browser snapshot --compact`
  - `agent-browser open http://localhost:3000/prototype?variant=immersive-stage`
  - `agent-browser open http://localhost:3000/prototype?variant=paper-desk`
  - `agent-browser open http://localhost:3000/prototype?variant=unknown`
- Production browser check after `pnpm build` and `pnpm start`:
  - `agent-browser open http://localhost:3000/prototype`
  - `agent-browser get text body` and confirm the switcher label is absent.

## Risky Files and Rollback Points

- `app/layout.tsx`: changing `lang` and metadata affects every page; keep edits minimal.
- `app/page.tsx`: avoid implementing final public card behavior early; keep it as an app shell/link page.
- `app/prototype/page.tsx`: prototype-only route; safe rollback by deleting the directory/file.
- `README.md`: replace template content, but keep commands accurate.

## Review Gates Before `task.py start`

- PRD, design, and implementation plan are present.
- User has approved proceeding with implementation.
- Active task path is `.trellis/tasks/06-09-juhua-slice-01-prototype-route`.
