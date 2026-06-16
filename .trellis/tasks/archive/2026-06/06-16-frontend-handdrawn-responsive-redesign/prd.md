# Frontend hand-drawn responsive redesign iteration

## Goal

Upgrade the production homepage UI so 句画 feels intentionally hand-drawn, artistic, and memorable across PC and mobile, instead of reading as a generic centered paper-card layout.

## User Value

- Users should immediately recognize 句画 as an artful 图文卡片 product, not a plain web mockup.
- The experience should preserve the calm value of one 随机短句 bound to one 非署名绘本风 illustration while adding stronger visual authorship.
- The interface should remain comfortable and usable on desktop and mobile screens.

## Confirmed Facts

- The requested requirements are: hand-drawn style, artistic feeling, responsive layout, and support for both PC and mobile UI.
- The chosen aesthetic direction is: hand-drawn picture-book/editorial album feeling, not flashy, elegant, compact, and restrained.
- A related task, `.trellis/tasks/archive/2026-06/06-16-frontend-ui-handdrawn-redesign`, already shipped a quiet/refined Paper Desk direction.
- Current production code already contains that first pass: warm paper tokens in `app/globals.css`, `HomeExperience` desk backdrop, `HomeCardExperience` action row, and `QuietGalleryCard` paper card styling.
- The current first pass is therefore not enough; this task is an aesthetic iteration, not a first introduction of paper tokens.
- Production homepage flow is `app/page.tsx` -> `HomeExperience` -> `HomeCardExperience` -> `QuietGalleryCard`.
- `HomeCardExperience` owns refresh, download, share, pending states, and polite `aria-live` announcements.
- `QuietGalleryCard` is the DOM node captured for PNG export; redesign must not move required card content outside the captured article or introduce a parallel canvas/card renderer.
- The card renderer must preserve both branches: real same-origin WebP images with `sceneLabel` alt text and the CSS fallback illustration for `illustrationUrl: null` with the same accessible label.
- Existing e2e tests assert key labels/copy including `再来一张`, `下载 PNG`, `分享`, `图文卡片预览`, empty-stock copy, rate-limit copy, download/share behavior, and PNG export dimensions/style alignment.
- The project uses Next.js 16 App Router, React 19, Tailwind CSS v4, shadcn-owned `Button`, next-themes, and strict TypeScript.
- Relevant frontend contracts are `.trellis/spec/frontend/index.md`, `.trellis/spec/frontend/quality-guidelines.md`, and `.trellis/spec/frontend/type-safety.md`.

## Requirements

- Redesign the production homepage and card presentation with stronger hand-drawn artistic direction than the current quiet Paper Desk implementation.
- Preserve project domain language: 图文卡片, 一言 / 随机短句, 图文绑定, 刷新生成, 非署名绘本风.
- Preserve implemented public flows for refresh, PNG download, and Web Share/download fallback.
- Preserve accessibility contracts: semantic page structure, card article accessible name, illustration alt/label, `aria-busy`, focus-visible states, and polite `aria-live` announcements.
- Preserve truthful public copy and avoid implying accounts, saved history, collections, galleries, posting, user-submitted text, curated healing copy, or named living-artist styles.
- Support responsive UI for PC and mobile: desktop may use richer composition; mobile must collapse to a focused, usable single-column layout without horizontal overflow.
- Make empty-stock and rate-limited homepage states visually consistent with the same art direction.
- Keep prototype/debug controls out of production DOM.
- Avoid backend, database, generation, rate-limit, export-dimension, or API contract changes.
- Avoid new third-party dependencies unless planning proves CSS/Tailwind cannot meet the visual goal.

## Acceptance Criteria

- [ ] The homepage is visibly more hand-drawn, artistic, and intentionally composed than the current Paper Desk first pass.
- [ ] Desktop layout uses a stronger composition than a plain centered card while keeping the 图文卡片 as the clear product focus.
- [ ] Mobile layout is intentionally designed, single-column, touch-friendly, and has no horizontal overflow.
- [ ] A ready card with `illustrationUrl` renders the real image with `sceneLabel` as alt text.
- [ ] A ready card with `illustrationUrl: null` renders an accessible fallback illustration using the same `sceneLabel`.
- [ ] Refresh keeps the current 图文卡片 visible while pending, prevents duplicate requests, updates the canonical card only after a valid API response, and preserves failure/limit behavior.
- [ ] Download and share remain gated through `/api/card-action` and capture/share the current `QuietGalleryCard` DOM node.
- [ ] Empty-stock and rate-limited states use the same visual language and preserve tested copy.
- [ ] Public copy stays within the product domain language and claims only implemented capabilities.
- [ ] Reduced-motion users can understand state changes without relying on animation.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build`, and relevant ready-card Playwright checks pass before completion.
- [ ] Browser-observable checks confirm final route behavior and responsive layout at representative mobile and desktop sizes.

## Out of Scope

- Backend generation, xAI prompts, SQLite schema, worker behavior, rate-limit policy, or ready-pool logic.
- Accounts, saved history, collections, galleries, posting, or user-submitted sentences.
- Changing PNG export dimensions or replacing DOM-to-image export with a separate renderer.
- Naming or imitating any living artist style.
- Redesigning `/prototype` except as reference.
- Adding broad new product copy that implies capabilities not implemented.

## Open Questions

None. The user selected a hand-drawn picture-book album feeling that is not flashy, with an elegant and compact presentation.