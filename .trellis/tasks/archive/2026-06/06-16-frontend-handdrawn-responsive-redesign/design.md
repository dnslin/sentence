# Design — Elegant hand-drawn picture-book album homepage

## Scope

Visual/UX iteration of the production homepage card experience. This is a second pass over the existing Paper Desk implementation because the current UI still feels insufficiently aesthetic. No backend, schema, route-contract, rate-limit, generation, export-dimension, or API behavior changes.

## First-principles reasoning

### Assumptions to challenge

- A hand-drawn UI does not require many doodles, stickers, or decorative objects; those can reduce elegance and compete with the 图文卡片.
- More whitespace does not automatically make the interface premium; uncontrolled whitespace can feel loose and unfinished.
- A card centered on a warm background is not enough to communicate art direction; composition, line quality, typography, and visual hierarchy carry the aesthetic.
- Mobile responsiveness is not just stacking desktop elements; the mobile composition must remain intentional and compact.

### Bedrock truths

- The product artifact is one vertical 图文卡片: one 随机短句 plus one 非署名绘本风 illustration.
- The export contract captures `QuietGalleryCard`; any visible card styling that should appear in PNG must live inside that article node.
- Page decorations outside the article can improve the browsing experience but must not be required for the exported artifact.
- Users can only perceive “hand-drawn” from visible cues: imperfect strokes, paper texture, illustration-like spatial rhythm, type hierarchy, and restrained color.
- Elegance depends on subtraction: a limited palette, fewer competing accents, precise spacing, and readable text.
- Responsiveness depends on bounded widths, no horizontal overflow, touch-sized controls, and collapsing decorative side content before it competes with the card.

### Rebuilt direction

Build a compact editorial picture-book album surface:

1. Keep the 图文卡片 as the central artifact and the export node.
2. Strengthen the article itself with visible but restrained hand-drawn craft: double-line sketch border, inset paper mat, album-page caption area, refined fallback illustration.
3. Use the page around it as an elegant album spread / drawing desk: asymmetric but quiet paper layers, small editorial note blocks, no sticker clutter.
4. Use at most two accent families: warm ink/sepia and a muted sage/blue-green watercolor accent. Avoid purple gradients and loud saturated colors.
5. Make desktop composition tighter and more designed through grid alignment, side notes, and compact action surface; make mobile a single-column album page with minimal decoration.

## Affected surfaces

- `app/globals.css` — add/adjust design tokens and reusable CSS utilities for compact album paper, sketch lines, and restrained texture.
- `app/home-experience.tsx` — page shell, hero/header composition, page-only album backdrop, empty-stock and limited states.
- `app/home-card-experience.tsx` — action surface and live announcement styling only; fetch/action/export logic stays unchanged.
- `app/quiet-gallery-card.tsx` — exported card article styling, fallback illustration refinement, and sentence panel presentation while preserving structure and accessibility.

## Component boundaries and contracts

- `app/page.tsx` remains unchanged: it selects a rate-limited ready card and passes `card` / `isLimited` to `HomeExperience`.
- `HomeCardExperience` remains the client state boundary for refresh, download, share, pending state, and announcements. Do not change guard logic, endpoint calls, button labels, or announcement strings.
- `QuietGalleryCard` remains a `forwardRef<HTMLElement>` article with `aria-label="图文卡片预览"`, `aria-busy`, `data-card="quiet-gallery"`, and the real-image vs fallback branch.
- The PNG export still captures only `QuietGalleryCard`; page album decorations and action UI remain outside the exported artifact.

## Art direction

Target: 手绘画册感，不花里胡哨，典雅，紧致.

### Visual rules

- Palette: warm paper base, ivory card, aged ink, muted graphite, one soft watercolor accent. No saturated multi-accent collage.
- Texture: CSS-only paper grain and subtle watercolor washes; no raster texture dependency.
- Lines: thin irregular sketch borders, double-frame/inset mat cues, short pencil-rule details. Avoid large cartoon doodles.
- Typography: keep readable Chinese system/Noto stack unless a self-hosted font is already available; improve hierarchy through tracking, size, leading, and editorial labels rather than adding a risky font dependency.
- Layout: compact album spread. Desktop can use a side editorial panel or small notation blocks; mobile collapses them below/above without crowding the card.
- Motion: subtle paper settle/opacity only with `motion-safe`; reduced motion must remain static and understandable.

## Responsive behavior

- Desktop (`lg+`): two-column or asymmetric album-spread layout: card prominent, header/notes/actions aligned as a compact editorial side rail or bottom rail. Decorative paper layers may appear behind the main spread.
- Tablet (`sm`/`md`): centered card with compact header and action block; reduce side decoration.
- Mobile (`< sm`): single column, card width bounded by viewport, buttons stacked and touch-friendly, no absolute decoration that can cause overflow.
- Continue using `min-h-svh`, `overflow-x-hidden`, bounded max widths, and `w-full` controls.

## Empty and limited states

- Restyle as compact album notes on paper, matching the same sketch border and restrained tone.
- Preserve tested heading/body strings exactly.
- Do not render a fake card article in these states.

## Accessibility and quality

- Preserve semantic structure: `main`, `section`, `header`, `article`, action region, and live region.
- Keep visible focus states inherited from `Button`; any custom utility must not suppress outlines without replacement.
- Keep contrast readable on paper backgrounds.
- Images keep alt text through `sceneLabel`; fallback keeps `role="img"` and `aria-label={card.sceneLabel}`.
- Any new decorative elements use `aria-hidden="true"`.
- Any animation uses explicit transition utilities and `motion-reduce`/`motion-safe`.

## Trade-offs

- Do not add a display font dependency. Chinese font loading and PNG export fidelity introduce more risk than value for this iteration; the aesthetic can be achieved with composition, line, texture, and spacing.
- Do not make the design maximal. The user explicitly asked for elegant and compact, so visual density should come from precise layering, not many ornaments.
- Do not re-layout the exported card radically. Preserve its 4:5 artifact shape and row structure to protect PNG export and e2e pixel comparison, but improve the surface styling and fallback art.

## Compatibility / rollback

Pure presentational change. Rollback is reverting the touched frontend files. No migration, API versioning, data change, or route change.

## Verification shape

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- Relevant ready-card Playwright checks, preferably `pnpm test:e2e -- --grep "renders the API-backed|refresh|downloaded PNG|share|empty-stock|limit"` or full `pnpm test:e2e` if time permits.
- Browser-observable check at mobile and desktop widths for no horizontal overflow, visible card, usable actions, and reduced-motion behavior.
