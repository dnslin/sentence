# Design

## Boundary

This task does not introduce a new architecture. It verifies the existing Slice 01 Next.js app shell and `/prototype` route, and only changes code if verification exposes a requirement gap.

## Existing Contracts

- `README.md` is the documented local-start and prototype-route entry point.
- `app/page.tsx` is the temporary app shell entry point.
- `app/prototype/page.tsx` is the static route wrapper and Suspense boundary.
- `app/prototype/prototype-experience.tsx` is the client-only prototype selector and renderer.
- `components/ui/button.tsx` supplies the reusable shadcn-style Button primitive.
- `CONTEXT.md` defines product vocabulary used in user-visible copy.

## Route Contract

- `/prototype` renders Quiet Gallery by default.
- `/prototype?variant=<id>` selects one of `quiet-gallery`, `immersive-stage`, or `paper-desk`.
- Missing, unknown, or repeated `variant` values are invalid and fall back to `quiet-gallery`.
- Variant selection is browser-visible static UI state, so the route should stay statically prerenderable.

## Production Contract

The prototype switcher is a development affordance. It may render in non-production, but production must not render the control in the DOM or accessibility tree.

## Compatibility

No data migration, API contract, or persistent state is involved.
