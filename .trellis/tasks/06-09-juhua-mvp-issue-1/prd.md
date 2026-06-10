# [Issue #1] 句画 MVP: responsive sentence-card generation site

## Goal

Build 句画 as a Chinese-first responsive site where visitors receive a ready 图文卡片 composed of one Hitokoto 随机短句 and one non-signed picture-book-style illustration, centered on a Quiet Gallery single-card public experience with refresh, download PNG, and share actions.

## User Value

Visitors can quickly receive, refresh, save, and share a complete 图文卡片 without waiting for live image generation or creating an account.

## Confirmed Facts

- Source requirement: GitHub issue #1, open, labelled `epic`, `epic:juhua-mvp`, `ready-for-agent`, `priority:p1`, `type:feature`.
- Product vocabulary is defined in `CONTEXT.md`: 图文卡片, 一言, 图文绑定, 刷新生成, 随机短句, 非署名绘本风.
- Current repository is a Next.js 16 / React 19 / TypeScript / Tailwind / shadcn app shell with a placeholder homepage.
- Accepted ADRs require:
  - Single overseas VPS self-hosting with Docker Compose (`docs/adr/0001-self-host-nextjs-with-docker-compose.md`).
  - Hybrid pregenerated ready-card pool, target near 200, replenish below 50 (`docs/adr/0002-hybrid-pregenerated-card-pool.md`).
  - SQLite WAL via Drizzle for metadata/status/rate limits and local WebP files for illustrations (`docs/adr/0003-sqlite-and-local-webp-storage.md`).
- Issue #1 is an epic with independently verifiable slices #2 through #17.
- Issue #2 (`[Slice 01] Bootstrap 句画 app shell and UI prototype route`) is unblocked and can start immediately.

## Requirements

- Serve ready 图文卡片 quickly from a pregenerated pool.
- Keep the public visual experience focused on one clean 4:5 card.
- Generate illustrations through xAI using an OpenAI-compatible SDK configuration.
- Persist sentence/card bindings in SQLite and local WebP image files on a single VPS.
- Provide testing, operations, and deployment support sufficient for a complete MVP.
- Implement the epic through dependency-ordered child slices rather than as one monolithic change.
- Use TDD vertical slices for each implementation task: one behavior test, minimal implementation, repeat.

## Child Slice Map

- #2 Slice 01 — Bootstrap app shell and UI prototype route; unblocked; first implementation target.
- #3 Slice 02 — Selected Quiet Gallery public page with mock 图文卡片; blocked by #2.
- #4 Slice 03 — SQLite/Drizzle card store and API with one ready mock card; blocked by #3.
- #5 Slice 04 — Refresh flow with recent-card avoidance and anonymous identity; blocked by #4.
- #6 Slice 05 — Hitokoto fetch and sentence normalization; blocked by #4.
- #7 Slice 06 — xAI prompt rewrite and image generation smoke path; HITL; blocked by #6.
- #8 Slice 07 — Local WebP storage and public image URLs; blocked by #7.
- #9 Slice 08 — Pregenerated pool worker with thresholds and daily cap; blocked by #8.
- #10 Slice 09 — Empty-stock and operational failure behavior; P2; blocked by #9.
- #11 Slice 10 — Rate limiting for refresh/download/share; blocked by #5.
- #12 Slice 11 — DOM-to-PNG download flow; blocked by #8.
- #13 Slice 12 — Web Share file sharing fallback; P2; blocked by #12.
- #14 Slice 13 — Protected status page; P2; blocked by #9.
- #15 Slice 14 — Docker Compose deployment for web and worker; blocked by #9 and #14.
- #16 Slice 15 — Prewarm and backup operations; P2; blocked by #15.
- #17 Slice 16 — Real external smoke verification and launch readiness; HITL; blocked by #16.

## Acceptance Criteria

- [ ] Each child slice has a Trellis task or an explicit mapping before implementation starts.
- [ ] Child slices are implemented in dependency order unless the relevant GitHub issue says otherwise.
- [ ] The final MVP lets visitors load, refresh, download, and share complete 图文卡片.
- [ ] The ready pool is maintained by a worker near the agreed inventory thresholds.
- [ ] Generated illustrations are stored locally as WebP and served through public image URLs.
- [ ] Admin status, backups, Docker Compose deployment, and real external smoke verification are available.
- [ ] No implementation starts before the active child task has reviewed planning artifacts and status `in_progress`.

## Out of Scope For Parent Task Direct Implementation

- The parent epic should not directly edit product code except for final integration/spec wrap-up if needed.
- Detailed implementation belongs to child tasks, starting with #2.
- User accounts, saved card history, user-submitted sentences, independent gallery assets, and named living-artist styles are out of scope per `CONTEXT.md`.

## Resolved Scope Decisions

- Current development session will implement only the first unblocked child slice (#2) before continuing deeper into the epic.
- Remaining slices #3–#17 stay mapped in the parent task and will be planned/implemented later in dependency order.

## Open Questions

- None for parent epic planning before starting child #2.
