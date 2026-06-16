# Redesign frontend UI with hand-drawn art direction

## Goal

Redesign the production homepage card experience so 句画 feels more hand-drawn, artistic, and visually intentional while preserving the existing product contract: one 随机短句 and one 非署名绘本风 illustration form one shareable vertical 图文卡片 that can be refreshed, downloaded as PNG, or shared.

## User Value

- Users should immediately feel the product is a quiet, artistic 图文卡片 experience rather than a generic centered web mockup.
- The interface should work comfortably on both PC and mobile screens.
- The production UI should stay truthful about implemented capabilities: refresh, download, and share are real actions, not decorative claims.

## Confirmed Facts

- The production homepage renders through `app/page.tsx` -> `HomeExperience` -> `HomeCardExperience` -> `QuietGalleryCard`.
- The current production page uses a centered warm-paper layout with one card and three action buttons.
- The card renderer must support both real same-origin WebP illustrations and the existing CSS fallback illustration when `illustrationUrl` is `null`.
- `HomeCardExperience` owns refresh, download, share, pending states, and `aria-live` announcements.
- `QuietGalleryCard` is the DOM node captured for PNG export; redesign must not move export-only content outside the captured article or create a parallel canvas/card implementation.
- Existing public copy and tests rely on the labels `再来一张`, `下载 PNG`, `分享`, `图文卡片预览`, and several calm failure/limit announcements.
- Existing prototype directions are `quiet-gallery`, `immersive-stage`, and `paper-desk`. The user selected `paper-desk` as the production art direction, while production must preserve `quiet-gallery`'s clear card/action product semantics.
- The project uses Next.js 16 App Router, React 19, Tailwind CSS v4, shadcn-owned `Button`, next-themes, and strict TypeScript.
- Frontend work must follow `.trellis/spec/frontend/quality-guidelines.md`, including browser-observable checks when route behavior is the public contract.

## Requirements

- Redesign the production homepage and card presentation in the selected Paper Desk direction: a quiet/refined hand-drawn studio/tabletop surface with paper layers, pencil/watercolor texture, and a clear central 图文卡片. Avoid heavy scrapbook decoration, noisy stickers, or cluttered doodles.
- Preserve the core product language: 图文卡片, 随机短句 / 一言, 图文绑定, 刷新生成, 非署名绘本风.
- Preserve the current real flows for refresh, PNG download, and Web Share/download fallback.
- Preserve accessibility contracts: semantic page structure, card article accessible name, illustration alt/label, `aria-busy`, and polite `aria-live` announcements.
- Preserve rate-limit, empty-stock, and action failure states with calm non-technical copy.
- Support responsive UI for PC and mobile. Multi-column/asymmetric desktop layouts must collapse intentionally on mobile.
- Keep public copy truthful and avoid implying accounts, galleries, saved history, posting, user-submitted text, curated healing copy, or named living-artist styles.
- Keep prototype/debug controls out of production DOM.
- Avoid introducing new third-party UI/animation dependencies unless a later design decision proves they are necessary and package availability is checked first.

## Acceptance Criteria

- [ ] The homepage has a visibly more hand-drawn/artistic direction than the current centered generic warm card layout.
- [ ] The redesigned UI renders correctly at mobile and desktop widths, with no horizontal overflow and with action buttons usable without layout breakage.
- [ ] A ready card with `illustrationUrl` renders the real image with `sceneLabel` as alt text.
- [ ] A ready card with `illustrationUrl: null` renders an accessible fallback illustration using the same `sceneLabel`.
- [ ] Refresh keeps the current 图文卡片 visible while pending, prevents duplicate requests, updates the canonical card only after a valid API response, and preserves failure/limit behavior.
- [ ] Download and share remain gated through `/api/card-action` and capture/share the current `QuietGalleryCard` DOM node, not a rebuilt duplicate.
- [ ] Empty-stock and rate-limited homepage states are redesigned consistently with the same art direction.
- [ ] Public copy uses the project domain language and does not claim unsupported capabilities.
- [ ] Reduced-motion users can understand state changes without relying on animation.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build`, and relevant Playwright ready-card checks pass before completion.
- [ ] A browser-observable check confirms the final route behavior and responsive layout at representative mobile and desktop sizes.

## Out of Scope

- Changing backend generation, xAI prompts, database schema, rate-limit policy, or ready-pool behavior.
- Adding accounts, saved history, collections, galleries, posting, or user-submitted sentences.
- Changing the PNG export dimensions or replacing DOM-to-image export with a separate rendering implementation.
- Naming or imitating any living artist style.
- Reworking the `/prototype` route unless needed only as reference or cleanup for the production redesign.

## Open Questions

1. Should the Paper Desk direction be quiet/refined or playful/sketchbook-heavy?
