# [Issue #3] Implement selected Quiet Gallery public page with mock 图文卡片

## Goal

Promote the selected Quiet Gallery direction from the throwaway `/prototype` route into the public homepage using local mock 图文卡片 data.

## User Value

Visitors opening `/` can immediately understand the intended 句画 public experience: one warm, quiet, centered 4:5 图文卡片 with a random sentence, a picture-book-style illustration area, and the primary actions that later slices will connect to real refresh, download, and share behavior.

## Confirmed Facts

- Source requirement: GitHub issue #3, open, labelled `epic:juhua-mvp`, `ready-for-agent`, `afk`, `priority:p1`, `type:feature`, `area:ui`.
- Parent: issue #1 / Trellis task `.trellis/tasks/06-09-juhua-mvp-issue-1`.
- Blocked by: issue #2, which is already delivered in the current codebase via the app shell and `/prototype` route.
- Current branch for this work: `issue-3-quiet-gallery-homepage`.
- Current app stack: Next.js 16.2.6, React 19.2.4, TypeScript, Tailwind CSS 4, shadcn-style `Button` primitive.
- Current homepage `app/page.tsx` is a Slice 01 app shell that links to `/prototype` and explicitly says the final homepage is not implemented.
- Current `/prototype` includes a Quiet Gallery mock direction with a centered 4:5 card and separate action row.
- Product vocabulary in `CONTEXT.md` defines `图文卡片`, `随机短句`, `非署名绘本风`, `刷新生成`, and excludes accounts, saved history, user-submitted sentences, independent galleries, and named living-artist styles.
- Accepted ADRs say future real cards will come from a pregenerated pool and store bindings in SQLite/local WebP, but this slice uses mock data only.
- Later epic slices own real refresh flow (#5), DOM-to-PNG download (#12), and Web Share fallback (#13); this slice must not implement those production workflows.
- No root test script exists yet. Previous UI slices used browser-observable checks through `agent-browser` rather than adding a persistent Playwright test suite.

## Requirements

- Replace the public homepage shell with the selected Quiet Gallery public page at `/`.
- Display one centered vertical 4:5 图文卡片 using local mock data.
- Card composition must allocate about 75% of its height to the illustration area and about 25% to a warm-paper text area.
- The card interior must show only the 随机短句 text in the text area; it must not show source, watermark, UUID, site name, prototype labels, or metadata inside the card.
- Present the three primary controls outside the card: `再来一张`, `下载 PNG`, and `分享`.
- Core controls must be keyboard reachable and have accessible names.
- The page must be responsive across mobile, tablet, and desktop widths while keeping the card visually centered.
- Provide calm Chinese visual states for loading, empty, and error conditions using local mock state hooks or route-query driven debug states.
- Respect `prefers-reduced-motion` for any refresh animation: motion may be subtle by default, but reduced-motion users must not receive non-essential animation.
- Keep the page Chinese-first and aligned with project vocabulary.
- Do not fetch Hitokoto, call xAI, persist data, implement a database/API, generate real images, implement real DOM-to-PNG download, or implement native sharing in this slice.
- Follow TDD vertical slices: one public behavior check first, verify it fails, implement the minimum production code, verify it passes, then repeat.

## Acceptance Criteria

- [ ] `/` displays a centered 4:5 图文卡片 using mock data.
- [ ] The card uses an approximately 75% illustration area and 25% warm-paper text area.
- [ ] The card shows only the 随机短句 text and no source, watermark, UUID, site name, prototype label, or metadata inside the card.
- [ ] The page exposes `再来一张`, `下载 PNG`, and `分享` controls outside the card.
- [ ] The three controls are keyboard reachable and have accessible names.
- [ ] The page remains usable and visually centered at representative mobile, tablet, and desktop widths.
- [ ] Loading, empty, and error visual states exist with calm Chinese copy.
- [ ] Reduced-motion preferences are respected for the light refresh animation.
- [ ] `/prototype` remains available as a throwaway comparison route unless a later task removes it.
- [ ] Real Hitokoto, image generation, persistence, real PNG download, and native share behavior are not introduced in this slice.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build`, and browser-observable checks for the public behaviors pass before completion.

## Out of Scope

- Live Hitokoto fetching and sentence normalization.
- xAI prompt rewriting, image generation, local WebP storage, SQLite/Drizzle persistence, ready-pool worker logic, rate limiting, Docker deployment, admin status, backups, or external smoke tests.
- Real download PNG implementation and Web Share file sharing fallback.
- User accounts, saved history, permanent collection, user-submitted sentences, independent gallery assets, or named living-artist styles.
- Removing or redesigning `/prototype` beyond preserving compatibility with the current route.

## Open Questions

- None before drafting design and implementation plan.
