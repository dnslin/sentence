# Design — Paper Desk hand-drawn homepage redesign

## Scope

Visual/UX redesign of the production homepage card experience. No backend, schema, route-contract, or export-dimension changes. The redesign is contained in the existing client/server component tree under `app/` plus design tokens in `app/globals.css`.

## Affected surfaces

- `app/home-experience.tsx` — page shell, header, empty-stock state, limited state.
- `app/home-card-experience.tsx` — action row layout and announcement region (logic preserved).
- `app/quiet-gallery-card.tsx` — the exported card article (hand-drawn card surface).
- `app/globals.css` — Paper Desk design tokens (paper colors, hand-drawn radius, texture variables).
- Possibly `app/layout.tsx` — only if a self-hosted hand-drawn-friendly font is added; default keeps current font stack.

## Component boundaries and contracts (unchanged)

- Server boundary: `app/page.tsx` still runs the rate-limited selection and passes `card` / `isLimited` into `HomeExperience`. No change.
- Client state boundary: `HomeCardExperience` keeps owning refresh, download, share, pending state, and `aria-live`. Only its markup/classes change, not its control flow, fetch logic, guards, or announcement strings.
- Export boundary: `exportReadyCardToPng(cardRef.current, currentCard)` still captures the single `QuietGalleryCard` article node. The desk/page decoration lives outside that node and is therefore excluded from the PNG by construction.
- `QuietGalleryCard` keeps its props (`card`, `isRefreshing`, `isTilted`), `forwardRef`, `aria-label="图文卡片预览"`, `aria-busy`, and the real-image vs CSS-fallback branch.

## Art direction (Paper Desk, quiet/refined)

Two layers:

1. Desk surface (page-only, not exported):
   - Warm paper desk background using existing `#f7f2ea` family, with a subtle layered-paper feel behind the card (soft offset paper sheets, gentle tinted shadows, no harsh black shadows).
   - At most one or two restrained hand-drawn accents (a thin sketched underline or frame), gated to desktop where space allows; mobile keeps it calm and single-column.

2. Card surface (inside the exported article):
   - Paper-textured card with a hand-drawn-style border (irregular/organic radius or a subtle sketched stroke via CSS, not an external SVG asset).
   - Keep the existing two-row grid (illustration area + sentence panel) and the `dawn|rain|moon` accent gradients for the CSS fallback illustration.
   - Sentence panel keeps warm paper tone and readable type; quotation marks preserved.

Texture strategy: prefer CSS gradients/box-shadow/border treatments and Tailwind utilities. No new image/SVG/animation dependency unless a later step proves CSS cannot achieve a "hand-drawn" enough result; if so, a single inline lightweight SVG filter/border is the fallback, decided before adding any package.

## Responsive design

- Desktop (`lg`+): desk context may use an asymmetric paper arrangement, card centered/slightly offset, action row beneath as a "label card" on the desk.
- Tablet (`md`): simplified desk, card centered, actions in a row.
- Mobile (`< md`): strict single column, `w-full` with existing `max-w-[min(24rem,calc(100vw-2rem))]` card clamp, no horizontal overflow, actions stack vertically as today (`flex-col sm:flex-row` is already in place).
- Keep `min-h-svh`, never `h-screen`.

## Motion and accessibility

- Keep all motion behind `motion-safe` / `motion-reduce`, mirroring the existing tilt/refresh transitions. Any new hand-drawn motion (e.g. a subtle paper settle) must collapse to static under reduced motion.
- Preserve semantic structure: `main` > `section` > `header` + `article`, action row labeled `图文卡片操作`, announcements in the polite live region.
- Maintain WCAG AA contrast for sentence text, header text, and action buttons against the paper tones.

## Copy

- Preserve all contract strings and labels: `再来一张`, `刷新生成中`, `下载 PNG`, `PNG 准备中`, `分享`, `分享确认中`, `图文卡片预览`, empty-stock heading/body, limited heading/body, and all announcement strings.
- Header copy may be lightly refined for the Paper Desk tone but must keep domain language and truthful capability claims, and must not reintroduce strings the empty-stock test asserts are absent.

## Trade-offs

- CSS-only hand-drawn texture keeps the bundle lean and the PNG export faithful, at the cost of a less literal "ink" look than raster/SVG textures. Accepted for maintainability and export fidelity.
- Keeping `QuietGalleryCard`'s grid shape preserves PNG pixel-sampling tests; a full card re-layout would risk the export comparison assertions. Accepted: evolve surface styling, keep structure.

## Compatibility / rollback

- Pure presentational change; rollback is reverting the touched component/css files. No data migration, no API/version change. `styleVersion` `quiet-gallery-v1` is unaffected because the card identity/binding semantics are unchanged.

## Verification shape

- `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- `pnpm test:e2e` (ready-card spec is the contracted homepage surface; confirm labels, card article, image/fallback, refresh/limit/empty states, and PNG export still pass).
- Browser-observable check at a mobile width and a desktop width for layout, overflow, and reduced-motion behavior.
