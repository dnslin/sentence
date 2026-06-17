# Implementation Plan: Add GSAP Page Motion

## Ordered Checklist

1. Install motion dependencies
   - Add `gsap` and `@gsap/react` via pnpm.
   - Confirm `package.json` and lockfile update cleanly.

2. Prepare stable motion targets
   - Add minimal `data-motion-*` attributes to homepage/card DOM where needed.
   - Keep `HomeExperience` server-compatible.
   - Keep `QuietGalleryCard` as a presentational `forwardRef` component.

3. Add scoped GSAP timeline in `HomeCardExperience`
   - Import `gsap`, `useGSAP`, and `useRef`/state as needed.
   - Register `useGSAP` once in the client module.
   - Add a wrapper ref used as the `scope`.
   - Create an initial-entry timeline with low-amplitude transforms and `autoAlpha`.
   - Use `gsap.matchMedia()` or `useGSAP` context cleanup so default and reduced-motion paths revert correctly.

4. Add refresh reveal without changing data semantics
   - Trigger reveal only after `currentCard.id` changes from a valid API response.
   - Animate the complete card artifact, not separate sentence/image state updates that could imply mismatched binding.
   - Do not add redundant success announcement.

5. Preserve export behavior
   - Ensure card `ref` still points to the `QuietGalleryCard` article.
   - Ensure download/share pending states still prevent refresh while export/share reads the DOM.
   - Avoid permanent inline transforms/opacity that could alter exported PNG after animation completes; clear or settle to final states.

6. Add/adjust browser-visible tests
   - Add a reduced-motion check that emulates `prefers-reduced-motion: reduce` and inspects the actual computed transform/transition properties used.
   - Keep tests requirement-driven: homepage visibility, refresh replacement, pending duplicate prevention, export/share continuity, reduced-motion behavior.

7. Run verification
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm build`
   - Focused e2e grep for affected homepage/refresh/export/reduced-motion tests.
   - Escalate to full `pnpm test:e2e` if focused coverage misses modified behavior.

## Risky Files / Rollback Points

- `app/home-card-experience.tsx`
  - Highest risk: owns business actions and export ref. Keep logic changes minimal.
  - Rollback: remove GSAP hook and wrapper animation attributes; keep action logic untouched.

- `app/quiet-gallery-card.tsx`
  - Medium risk: export article DOM. Avoid changing layout or visual styling beyond stable data attributes.
  - Rollback: remove data attributes only.

- `tests/ready-card.spec.ts`
  - Medium risk: large integrated e2e suite. Add targeted checks without weakening existing assertions.
  - Rollback: remove new reduced-motion/motion assertions if implementation is rolled back.

- `package.json` / lockfile
  - Low risk: dependency addition. Rollback by removing `gsap` and `@gsap/react` if no code references remain.

## Validation Commands

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e -- --grep "renders the API-backed ready card|refresh replaces|shows loading transition|downloads the current card|shares the current card|reduced"
```

If the focused e2e grep does not run every modified behavior path, run:

```bash
pnpm test:e2e
```

## Review Gates Before `task.py start`

- PRD, design, and implementation plan exist.
- User has reviewed or explicitly approved proceeding from planning to implementation.
- Relevant frontend specs have been read.
- Active task remains `.trellis/tasks/06-17-gsap-page-motion`.
