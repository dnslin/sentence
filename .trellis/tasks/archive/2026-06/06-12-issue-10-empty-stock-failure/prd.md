# Issue 10 empty stock and failure states

## Goal

Make the public homepage and refresh flow graceful when a ready 图文卡片 cannot be served because the ready pool is empty, the ready-card API fails, or a future limit response is returned.

## User Value

Visitors should always receive calm Chinese feedback that explains what they can do next, without seeing generation stack traces, provider/model errors, database details, or a page crash. The page must preserve the pregenerated-pool product model and must not trigger unbounded user-driven generation.

## Confirmed Facts

- Source requirement: GitHub issue #10, `[Slice 09] Add empty-stock and operational failure behavior to public page`, part of #1 and blocked by completed #9.
- Product vocabulary comes from `CONTEXT.md`: 图文卡片, 一言 / 随机短句, 图文绑定, 刷新生成, 非署名绘本风.
- ADR `0002-hybrid-pregenerated-card-pool` requires serving from a pregenerated pool while the web app handles empty-stock states.
- ADR `0003-sqlite-and-local-webp-storage` says rate-limit state will live in SQLite, but real anonymous rate limiting is tracked by GitHub issue #11.
- `app/page.tsx` currently throws a technical setup error when `getNextReadyCardForVisitor(...)` returns `null`.
- `app/api/ready-card/route.ts` currently returns `404 { error: "ready_card_not_found", message: "No ready 图文卡片 is available in the local store." }` for empty inventory.
- `app/home-card-experience.tsx` currently treats all non-OK refresh responses as a generic failure announcement and keeps the current card.
- `tests/ready-card.spec.ts` already covers API empty inventory at the status/error-code level, refresh API failure, and the public homepage happy path.
- GitHub issue #11 will implement real rate limiting for refresh/download/share, including Cookie plus IP context, SQLite persistence, and reset behavior. This task should only make public UI/API clients gracefully handle limit responses.
- Product decision on 2026-06-12: use the "平静等待" empty-stock copy below.

## Required Public Copy

- Homepage empty-stock title: `这会儿还没有准备好的图文卡片。`
- Homepage empty-stock description: `新的图文绑定还在慢慢准备中。请稍后再来看看，我们不会让你等待现场生成。`
- Refresh empty-stock announcement: `新的图文卡片还在准备中，当前这一张已保留。请稍后再试。`
- Refresh API failure announcement: `刷新生成暂时没有成功，当前图文卡片已保留。请稍后再试。`
- Refresh limit announcement: `今天的刷新有点频繁了，先让这张图文卡片停留一会儿。`

## Requirements

- The homepage must render the required calm empty-stock state when no ready 图文卡片 is available instead of throwing a technical error.
- The empty-stock state must use product language for the pregenerated ready pool and must not imply a user account, saved history, independent gallery, user-submitted sentence, or immediate on-demand generation.
- The ready-card API must expose a typed, non-technical empty-stock error response for `ready_card_not_found`.
- Refresh API failures must keep the current 图文卡片 visible, re-enable retry, and show the required non-technical retry-oriented Chinese copy.
- Refresh empty-stock responses must keep the current 图文卡片 visible, re-enable retry, and show the required empty-stock announcement.
- Refresh limit responses must keep the current 图文卡片 visible, re-enable the UI when safe, and show the required gentle Chinese limit copy.
- Public code must not expose stack traces, database paths/table names, model/provider errors, raw generation errors, or setup commands to visitors.
- User-triggered refresh handling must remain bounded: no loops, no automatic retry storm, and no direct generation request from the browser.
- Tests must verify empty inventory, API failure, and limit states from the user's perspective through public API or browser-visible behavior.
- TypeScript types must model ready-card success and public error variants without `any` or duplicated client/server payload shapes.

## Acceptance Criteria

- [ ] Empty ready inventory shows the required calm empty-stock title and description on the public homepage.
- [ ] Empty ready inventory returns a safe public API error payload that does not mention local store, database setup, stack traces, model/provider details, or generation internals.
- [ ] Refresh API failures show the required non-technical retry-oriented message and preserve the current 图文卡片.
- [ ] Refresh empty-stock responses show the required empty-stock announcement and preserve the current 图文卡片.
- [ ] Refresh limit responses show the required gentle user-facing explanation and preserve the current 图文卡片.
- [ ] The page does not expose generation stack traces, model errors, database details, or local setup commands for these states.
- [ ] User-triggered refresh still sends at most one in-flight request per click sequence and never starts an unbounded generation loop.
- [ ] Tests cover homepage empty inventory, ready-card API empty response, refresh API failure, refresh empty-stock response, and refresh limit response behavior from the user's perspective.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass.

## Out of Scope

- Implementing real anonymous rate limiting, hourly thresholds, persisted limit counters, or reset behavior; GitHub issue #11 owns that.
- Implementing download/share backend behavior.
- Starting live generation from the public page when the ready pool is empty.
- Creating accounts, saved history, collections, independent galleries, or user-submitted sentence flows.
- Changing ready-pool worker thresholds, daily cap behavior, or xAI generation behavior.

## Open Questions

- None.
