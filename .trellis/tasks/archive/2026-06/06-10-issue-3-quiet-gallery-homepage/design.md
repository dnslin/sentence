# Design — [Issue #3] Quiet Gallery public homepage

## First-Principles Reasoning

### 1. Challenge Assumptions

- Assumption: Slice 02 must implement real refresh/download/share. This is wrong against the epic map: refresh flow, PNG export, and Web Share are later slices.
- Assumption: visual loading/empty/error states can be claimed by hidden component branches. This is unverified and weak because users and browser checks cannot observe unreachable UI.
- Assumption: a new persistent test framework is required before any frontend work. This is unverified; the current project has no test script, and Slice 01 used browser-observable checks through the route contract.
- Assumption: the public card should include product branding or metadata. This conflicts with issue #3, which explicitly says the card must show only the 随机短句 text and no source, watermark, UUID, or site name inside the card.
- Assumption: responsive behavior can be inferred from Tailwind classes alone. This is insufficient because responsiveness is a user-visible browser property.

### 2. Decompose to Bedrock Truths

- A browser user can only verify what `/` renders, how focus moves, what accessible names controls expose, and how the layout behaves at viewport sizes.
- A 4:5 card is a geometric constraint: width / height = 4 / 5. The simplest enforceable web primitive is CSS `aspect-ratio: 4 / 5`.
- A 75% / 25% vertical split is a proportional layout constraint. CSS grid rows `3fr 1fr` encode exactly that ratio.
- This slice has no real data source. Therefore loading, empty, and error are mock UI states unless a later slice adds network/store behavior.
- Mock states must be reachable through a public or documented test interface to be checked. A local query-state selector is the smallest interface that does not add visible debug controls.
- Reduced motion is a user preference exposed through CSS media query `prefers-reduced-motion`; animation must be optional, not required for content.
- Keyboard reachability requires enabled native controls or links in the tab order; disabled buttons would fail reachability.

### 3. Rebuild From Ground Up

1. Keep `/` as the public interface and replace the current app shell copy with the selected Quiet Gallery experience.
2. Model mock card data locally because no external data source belongs to this slice.
3. Render the card as an `article` with `aspect-[4/5]`, a decorative illustration area, and a text area with only the sentence.
4. Put all controls outside the card so the card itself remains a clean shareable artifact.
5. Use enabled `Button` components for `再来一张`, `下载 PNG`, and `分享` so they are keyboard reachable. In this slice, clicks may update local mock UI or announce calm placeholder feedback, but they must not start real PNG/share workflows.
6. Add a small client component for local mock interaction and query-state selection because `?state=` is browser-visible local state only; wrap it in `Suspense` so the route can remain statically prerendered.
7. Normalize `?state=` values to `ready`, `loading`, `empty`, or `error`; missing, invalid, or repeated values fall back to `ready`.
8. Implement loading, empty, and error views as calm Chinese copy within the same centered page shell.
9. Use CSS/Tailwind reduced-motion variants or global media rules so refresh decoration does not animate when reduced motion is requested.
10. Verify every requirement through route/browser-observable behavior, lint, typecheck, and build.

### 4. Contrast With Convention

A conventional shortcut would keep the current homepage shell, paste the prototype card into it, and leave loading/error/empty branches unreachable or unverified. That would create a visually plausible page but fail the bedrock requirement that public behavior must be observable and testable. The essential difference is designing the smallest reachable route contract before styling.

### 5. Conclusion

Implement `/` as a static public Quiet Gallery page backed by local mock data and a tiny client boundary for mock state/interactions. Keep real product workflows out of scope, but make their controls accessible and browser-verifiable.

## Architecture and Boundaries

### Files to Modify

- `app/page.tsx`
  - Owns the `/` route wrapper and `Suspense` fallback.
  - Does not read server `searchParams` because mock UI state is local/static browser-visible state.
- `app/home-experience.tsx` (new)
  - Client component that reads `useSearchParams().getAll("state")`, normalizes mock state, and renders the public Quiet Gallery experience.
  - Owns local mock card rotation and placeholder action feedback.
- `app/globals.css`
  - Add only global reduced-motion support if Tailwind utility classes are not enough.
- `.trellis/tasks/06-10-issue-3-quiet-gallery-homepage/*`
  - Planning and execution artifacts.

### Files to Preserve

- `app/prototype/page.tsx` and `app/prototype/prototype-experience.tsx` remain available for Slice 01 comparison.
- `README.md` does not need to change unless implementation reveals public route documentation drift.
- No backend, API route, database, worker, or asset pipeline is introduced.

## Public Route Contract

### Default Homepage

- URL: `/`
- Renders one centered Quiet Gallery 图文卡片.
- Uses local mock data.
- Shows `再来一张`, `下载 PNG`, and `分享` outside the card.

### Mock State Query

- URL: `/?state=ready` or missing `state`: normal card page.
- URL: `/?state=loading`: centered calm loading state.
- URL: `/?state=empty`: centered calm empty-stock state.
- URL: `/?state=error`: centered calm error state.
- Unknown or repeated `state` values fall back to `ready`.
- The query selector is not advertised as a product control; it exists so mock states have a reachable route contract before real data slices exist.

## Component and Data Contracts

```ts
type CardMock = {
  id: string
  sentence: string
  sceneLabel: string
  accent: "dawn" | "rain" | "moon"
}

type MockPageState = "ready" | "loading" | "empty" | "error"
```

- `id` is internal only and must not render inside the card.
- `sceneLabel` may be used as accessible text for the decorative illustration area, not as visible card metadata.
- The visible card text area renders only `sentence`.
- Placeholder action feedback renders outside the card.

## Interaction Contract

- `再来一张`: cycles to the next local mock card and may trigger a light visual refresh accent.
- `下载 PNG`: does not create a PNG in this slice; it shows calm copy that the export ability will arrive later.
- `分享`: does not invoke Web Share in this slice; it shows calm copy that sharing will arrive later.
- All three controls are native buttons via the existing `Button` primitive.

## Accessibility Contract

- Page uses semantic `main`, `section`, and `article`.
- Card has an accessible label such as `Quiet Gallery 图文卡片`.
- Controls use visible labels matching their accessible names.
- Placeholder action feedback uses a polite live region.
- Illustration shape is decorative unless an accessible label is necessary to explain the scene without adding visible metadata inside the card.

## Responsive Contract

Representative verification widths:

- Mobile: 390px wide.
- Tablet: 768px wide.
- Desktop: 1280px wide.

At each width the page must keep the card centered, avoid horizontal overflow, and leave controls usable.

## Reduced-Motion Contract

- Default refresh accent may transition/animate lightly.
- Under `prefers-reduced-motion: reduce`, non-essential animation and transform transitions are disabled.
- Content must not depend on animation to be understood.

## Compatibility and Migration Notes

- No data migration.
- No dependency additions planned.
- The `?state=` mock route behavior can be removed or replaced when real card-store/API slices provide natural loading/empty/error states.

## Rollback Considerations

- Revert `app/page.tsx`, remove `app/home-experience.tsx`, and remove any CSS additions to restore the Slice 01 app shell.
- `/prototype` remains independent and should continue to work after rollback.
