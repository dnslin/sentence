# Implementation Plan — [Issue #3] Quiet Gallery public homepage

## Goal

Implement the public `/` Quiet Gallery homepage with local mock 图文卡片 data, accessible primary controls, reachable mock visual states, responsive layout, and reduced-motion-safe refresh treatment.

## TDD Rule

Use vertical slices only. For each behavior below:

1. Run the browser-observable check first and confirm it fails against the current Slice 01 homepage.
2. Implement the smallest code needed for that behavior.
3. Re-run the same check and confirm it passes.
4. Continue to the next behavior.

Do not batch all checks first and do not implement future behavior before its failing check.

## Files

- Modify: `app/page.tsx`
  - Replace Slice 01 app-shell homepage with a static route wrapper and Suspense fallback for the public Quiet Gallery experience.
- Create: `app/home-experience.tsx`
  - Client component for mock card data, `?state=` normalization, local card cycling, placeholder action feedback, and rendered visual states.
- Modify if needed: `app/globals.css`
  - Add reduced-motion utility support only if component-level classes cannot satisfy the acceptance criteria.
- Preserve: `app/prototype/page.tsx`, `app/prototype/prototype-experience.tsx`
  - Keep `/prototype` available.

## Behavior Slices

### Slice 1 — Default card on `/`

- [ ] RED: Start/open the current app and check `/` for a centered `Quiet Gallery 图文卡片`, one 4:5 card, and visible sentence-only text area. Expected before implementation: fail because current homepage is the Slice 01 app shell.
- [ ] GREEN: Create `app/home-experience.tsx` with local mock cards and update `app/page.tsx` to render the public experience.
- [ ] Verify: `/` shows the card and no longer claims the final homepage is unimplemented.

### Slice 2 — Card interior excludes metadata

- [ ] RED: Check the card region text for absence of source, UUID/id, watermark, site name, and prototype labels. Expected before implementation: fail until the card region exists with the required clean interior.
- [ ] GREEN: Keep visible metadata outside the card or omit it entirely; render only the sentence in the card text panel.
- [ ] Verify: card text contains the sentence and does not contain `句画`, `Quiet Gallery`, `uuid`, `source`, `来源`, `水印`, or internal mock IDs.

### Slice 3 — Primary controls are accessible

- [ ] RED: Check that `再来一张`, `下载 PNG`, and `分享` are present as enabled keyboard-reachable controls with accessible names. Expected before implementation: fail because current homepage has only the `/prototype` link.
- [ ] GREEN: Render the three existing `Button` primitive controls outside the card.
- [ ] Verify: tab navigation can reach all three controls; each name is visible and accessible.

### Slice 4 — Mock interactions stay in scope

- [ ] RED: Check that clicking `再来一张` changes the visible mock sentence and that `下载 PNG` / `分享` do not start real workflows but provide calm placeholder feedback outside the card. Expected before implementation: fail because controls do not exist.
- [ ] GREEN: Add local state for card cycling and a polite live region for placeholder feedback.
- [ ] Verify: the sentence changes after refresh, placeholder feedback appears outside the card, and no file/share API workflow is introduced.

### Slice 5 — Loading, empty, and error states

- [ ] RED: Open `/?state=loading`, `/?state=empty`, and `/?state=error` and check for calm Chinese state copy. Expected before implementation: fail because no state route contract exists.
- [ ] GREEN: Normalize `useSearchParams().getAll("state")` to `ready | loading | empty | error`; render state panels for the three non-ready states.
- [ ] Verify: each state URL renders its matching copy; `/?state=unknown` and repeated `?state=loading&state=error` fall back to the ready card.

### Slice 6 — Responsive layout

- [ ] RED: At 390px, 768px, and 1280px widths, check that the card remains centered, controls remain usable, and there is no horizontal overflow. Expected before implementation: fail or be irrelevant before the new page exists.
- [ ] GREEN: Adjust Tailwind layout classes for mobile-first card sizing, tablet spacing, and desktop centering.
- [ ] Verify: browser checks pass at all representative widths.

### Slice 7 — Reduced motion

- [ ] RED: Emulate or inspect reduced-motion behavior and confirm non-essential refresh animation is disabled under `prefers-reduced-motion: reduce`. Expected before implementation: fail until refresh styling exists.
- [ ] GREEN: Use Tailwind `motion-safe:` / `motion-reduce:` classes or CSS media query to gate animation.
- [ ] Verify: default users get only light motion; reduced-motion users do not get transform/refresh animation.

### Slice 8 — Regression and build checks

- [ ] Verify `/prototype` still opens and renders Quiet Gallery by default.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm build`.
- [ ] Run final browser-observable checks for `/`, `/?state=loading`, `/?state=empty`, `/?state=error`, mobile/tablet/desktop widths, keyboard reachability, and production-visible behavior after build when feasible.

## Validation Commands

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Browser checks should be run through the project-available browser tool/skill against the public route, not by inspecting private component internals.

## Review Gates Before `task.py start`

- [ ] `prd.md` records source requirements and out-of-scope later slices.
- [ ] `design.md` records the route contract, query-state contract, and accessibility/reduced-motion contracts.
- [ ] This `implement.md` lists one behavior per TDD cycle.
- [ ] User approves entering implementation.

## Rollback Points

- After Slice 1: revert `app/page.tsx` and delete `app/home-experience.tsx` to restore the Slice 01 shell.
- After later slices: keep `/prototype` untouched; rollback remains limited to homepage files and any small global CSS additions.
