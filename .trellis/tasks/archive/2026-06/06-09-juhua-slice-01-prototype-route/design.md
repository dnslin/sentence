# Design — [Issue #2] Bootstrap 句画 app shell and UI prototype route

## First-Principles Reasoning

### 1. Challenge Assumptions

- Assumption: the prototype must live on `/`. This is unverified; the issue asks for a prototype route, and Slice 02 will own the final homepage.
- Assumption: a persistent test framework must be added. This is unverified; the user clarified that `agent-browser` is a Playwright wrapper and enough for this slice's automated browser checks.
- Assumption: visual variants require generated images or real data. This is false for this slice; issue #2 only needs structural comparison with project vocabulary.
- Assumption: hiding a switcher with CSS is enough for production. This may be wrong because hidden UI can still leak into DOM and accessibility output.
- Assumption: URL params are synchronous objects. This is wrong for Next.js 16 App Router; `searchParams` is a Promise in page Server Components.

### 2. Decompose to Bedrock Truths

- A user can only compare prototype variants through observable browser output: URL, visible text, layout structure, and accessible controls.
- A shareable variant is a deterministic mapping from URL query value to rendered variant.
- Next.js App Router maps `app/prototype/page.tsx` to `/prototype`.
- Next.js 16 supplies `searchParams` to page Server Components as a Promise.
- `NODE_ENV` is available to server-rendered code and can decide whether prototype-only controls are rendered.
- No backend, external API, generated image, database, or user state is needed to satisfy issue #2.
- `agent-browser` can open routes and inspect browser-observable state.

### 3. Rebuild From Ground Up

1. Add a `/prototype` page because the smallest route boundary that satisfies the issue is one App Router page under `app/prototype/page.tsx`.
2. Await `searchParams` and normalize `variant` to one of `quiet-gallery`, `immersive-stage`, or `paper-desk`; fallback to `quiet-gallery` for missing, invalid, or array values.
3. Render all copy from static local data so the route is deterministic and has no external failure mode.
4. Make each variant structurally different in semantic layout, not just color:
   - Quiet Gallery: centered 4:5 card and separate actions.
   - Immersive Stage: wide stage composition with large art area and side/bottom sentence context.
   - Paper Desk: desk-like composition with layered paper card and notes.
5. Render a floating switcher only when `process.env.NODE_ENV !== "production"` so production browser checks do not find it in the DOM.
6. Update app shell copy and README so the product no longer presents as a generic template and the start command is explicit.
7. Verify through `agent-browser` by opening real URLs and checking visible/accessibility output, then run `pnpm lint`, `pnpm typecheck`, and `pnpm build`.

### 4. Contrast With Convention

A conventional shortcut would put a mock directly on `/`, add component-only tests, or hide the switcher with CSS. That would satisfy some surface text but fail the route boundary, future homepage handoff, or production-DOM constraint. The fundamental difference here is that the route URL and browser output are the public interface, so verification must observe those directly.

### 5. Conclusion

Implement `/prototype` as a server-rendered, static-data App Router page with URL-driven variants and server-side production switcher exclusion. Do not add data, generation, or persistent testing infrastructure in this slice.

## Architecture and Boundaries

### Files to Change

- `README.md` — replace generic template instructions with a short 句画 local start section documenting `pnpm dev`.
- `app/layout.tsx` — set Chinese-first shell metadata and `lang="zh-CN"`; keep existing theme provider and font setup simple.
- `app/page.tsx` — replace generic template placeholder with a minimal 句画 landing shell that links to `/prototype` without becoming the final Slice 02 Quiet Gallery page.
- `app/prototype/page.tsx` — new throwaway prototype route containing variant data, normalization, variant rendering, and development-only switcher.

### Route Contract

- `/prototype` renders `quiet-gallery`.
- `/prototype?variant=quiet-gallery` renders Quiet Gallery.
- `/prototype?variant=immersive-stage` renders Immersive Stage.
- `/prototype?variant=paper-desk` renders Paper Desk.
- Any other `variant` value renders Quiet Gallery.
- If `variant` is an array-like value from repeated query params, render Quiet Gallery.

### UI Contract

- Required vocabulary visible on the prototype route: `句画`, `图文卡片`, `随机短句`, `非署名绘本风`.
- Use semantic regions: main content, article/card area, and a separate navigation region for the prototype switcher in non-production.
- Use static decorative CSS shapes/gradients instead of external image assets.
- Keep spacing responsive and readable; no hidden backend state.

### Production Switcher Contract

- Development/non-production: render a floating, visibly separated switcher labelled for prototype variant switching.
- Production: do not render the switcher. Browser/accessibility snapshot should not contain the switcher label.

## Data Flow

1. Browser requests `/prototype` with optional query string.
2. Server Component awaits `searchParams`.
3. `getSelectedVariant` returns a known variant ID or `quiet-gallery`.
4. Static variant data drives visible heading, layout, sentence, illustration treatment, and notes.
5. HTML is rendered with or without switcher based on `NODE_ENV`.

## Compatibility and Migration Notes

- This slice does not add dependencies or database migrations.
- The route is explicitly throwaway; Slice 02 can replace the homepage without removing `/prototype` immediately.
- If future tests require persistent regression coverage, Playwright can be added later using the same browser-observable scenarios.

## Operational and Rollback Considerations

- Rollback is limited to removing `/prototype` and reverting README/layout/homepage copy changes.
- If `agent-browser` browser binaries are missing, run its documented install command once, then rerun the failing browser check and report the fallback.
- Production switcher hiding must be verified against a production build, not only the dev server.
