# Implement: Issue 10 empty stock and failure states

## TDD behavior scenarios

1. Homepage empty inventory renders the selected calm empty-stock title and description, and does not expose the old technical setup/local-store message.
2. API empty inventory returns `404` with `error: "ready_card_not_found"` and a safe Chinese `message`, with no local store/setup/DB/generation details.
3. Refresh operational API failure keeps the visible 图文卡片 and shows `刷新生成暂时没有成功，当前图文卡片已保留。请稍后再试。`.
4. Refresh empty-stock response keeps the visible 图文卡片 and shows `新的图文卡片还在准备中，当前这一张已保留。请稍后再试。`.
5. Refresh limit response keeps the visible 图文卡片 and shows `今天的刷新有点频繁了，先让这张图文卡片停留一会儿。`.
6. Existing pending/duplicate-click behavior remains bounded: one in-flight request while refreshing.

## Ordered implementation checklist

### Cycle 1: Homepage empty inventory

- RED: Add/update a Playwright test that clears ready cards, visits `/`, and expects the selected empty-stock title/description while rejecting old technical copy.
- GREEN: Update `app/page.tsx` and `app/home-experience.tsx` so a `null` card renders the empty-stock public state instead of throwing.
- Keep the page shell semantic (`main`, `section`, header) and avoid rendering `QuietGalleryCard` without a valid card.

### Cycle 2: API empty response public contract

- RED: Strengthen the existing API empty test to assert safe Chinese `message` content and absence of technical strings.
- GREEN: Move/add shared public error response types and guards in `lib/cards/public-ready-card.ts`; update `app/api/ready-card/route.ts` to use the safe response type and copy.

### Cycle 3: Refresh failure copy

- RED: Update the existing refresh failure browser test to expect the new non-technical retry copy and current-card preservation.
- GREEN: Update `app/home-card-experience.tsx` failure mapping while keeping success behavior unchanged.

### Cycle 4: Refresh empty-stock response

- RED: Add a browser test that routes `/api/ready-card` to `404 { error: "ready_card_not_found", message: "..." }`, clicks `再来一张`, and verifies the selected empty-stock announcement plus current-card preservation.
- GREEN: Add client-side narrowing for the public error response and map `ready_card_not_found` to the required empty-stock announcement.

### Cycle 5: Refresh limit response

- RED: Add a browser test that routes `/api/ready-card` to `429 { error: "ready_card_limited", message: "..." }`, clicks `再来一张`, and verifies the selected limit announcement plus current-card preservation.
- GREEN: Add a local refresh-client compatibility branch for `ready_card_limited`. Do not add it to the current shared production API error union, and do not implement counters or production 429 generation.

### Cycle 6: Regression and refactor

- Run targeted e2e if feasible during development: `pnpm test:e2e -- tests/ready-card.spec.ts`.
- Refactor duplicate test helpers or copy constants only after green.
- Keep type guards small and public-contract-oriented.

## Validation commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test:e2e`

If time or environment blocks full e2e, report the exact failure and run narrower commands first, but do not claim completion until required checks pass.

## Risky files and rollback points

- `app/page.tsx`: server route behavior changes from throw to public empty render.
- `app/home-experience.tsx`: prop shape may change to accept `PublicReadyCard | null`; keep caller types explicit.
- `app/home-card-experience.tsx`: async refresh error handling must preserve duplicate-request guard and success type narrowing.
- `app/api/ready-card/route.ts`: public API payload copy changes; keep status code and `error` code stable for empty inventory.
- `lib/cards/public-ready-card.ts`: shared DTO changes affect both server and client; avoid broad unions that weaken `isReadyCardResponse`.
- `tests/ready-card.spec.ts`: tests run serially against one e2e DB; each test must restore seed state via existing `beforeEach` and controlled helpers.

## Review gates before `task.py start`

- PRD includes selected public copy and testable acceptance criteria.
- Design states that real rate limiting is out of scope and issue #11 owns counters/persistence.
- Implement plan uses vertical TDD slices, not all tests first.
- User approves this plan or explicitly asks to proceed.
