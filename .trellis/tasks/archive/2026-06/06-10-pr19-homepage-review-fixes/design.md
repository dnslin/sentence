# Design — Fix PR #19 homepage review issues

## First-principles reasoning

### Challenge assumptions

- Assumption: a public `?state=` query is harmless because it only drives mock UI. This is unverified and wrong for public routes: URLs are shareable inputs, so they become part of the public interface.
- Assumption: a Suspense fallback can reuse the ready homepage. This is based on implementation convenience, not user-visible truth: fallback UI can be first paint and must not expose temporary interactions.
- Assumption: storing a message string is enough for `aria-live`. This ignores React state equality and DOM mutation: repeated identical strings may not produce a new announcement.
- Assumption: keeping mock `id` fields prepares future work. This is unverified: a fake identifier can be mistaken for the future 图文绑定 contract.
- Assumption: fixing review findings means adding more helpers. The deletion test matters more: a helper only helps if deleting it would spread complexity across callers.
- Assumption: strict PR hygiene can be solved by rewriting history inside the implementation task. This is potentially wrong because branch surgery is hard to reverse and outward-facing once pushed.

### Bedrock truths

- Query strings are external input. A public route cannot distinguish “debug URL” from “user link” unless the seam gates it explicitly.
- Server-rendered or fallback markup may be observed before hydration by users, crawlers, screenshots, or disabled/slow JavaScript contexts.
- Assistive announcement depends on DOM-observable changes in a live region; setting identical React state may not change the DOM.
- The current product does not yet have real download/share/pool/storage behavior; copy and interfaces must not imply otherwise.
- ADR-0002 requires a future pregenerated 图文卡片 pool; ADR-0003 requires future SQLite metadata and local WebP storage. The homepage should not learn database or file details now.
- Git history rewrite and force-push are separate destructive/outward-facing operations and need explicit approval.

### Rebuild from ground up

1. The public `/` route should render the truthful ready mock homepage by default.
2. Mock non-ready states are not product data yet, so they must not be controlled by public URLs in production.
3. The visual 图文卡片 shell can be stable markup; client state is only needed for mock cycling and placeholder action feedback.
4. Action feedback should be modeled as announcement events, not only message text.
5. Future pool/storage work should be able to replace the mock card source behind a seam without changing route policy or presentation everywhere.
6. Trellis archive/spec fixes are documentation/artifact corrections and should be handled without branch surgery unless separately approved.

### Contrast with convention

A conventional quick fix would add conditionals around the current client file and keep all behavior in `app/home-experience.tsx`. That reduces immediate diff size but keeps the Module shallow: route policy, card data, action feedback, and future pool concerns remain mixed. The deeper route is to concentrate policy and feedback behind clearer seams while still avoiding YAGNI future implementations.

### Conclusion

Fix the runtime bugs first, then deepen only where it reduces current leakage: remove public mock-state control, make fallback truthful/static or unnecessary, turn feedback into repeated announcement events, and simplify mock card state. Keep future pool/storage as a seam shape, not an implementation.

## Module design

### Public homepage Module

**Current friction**: `HomeExperience` is a client Module whose interface effectively includes public query parameters, mock card rows, animation counters, non-ready state copy, and action messages.

**Target shape**:

- A server-compatible public shell Module renders the stable page structure and 图文卡片 presentation.
- A small client action Adapter owns only mock cycling and placeholder action feedback.
- A card source seam remains local and simple: mock data now, future pool Adapter later.
- Non-ready mock states are either removed from `/` or gated behind an explicit non-production seam.

**Deletion test**:

- Deleting the action Adapter should only remove local click behavior, not the page shell.
- Deleting the mock card source should reveal the one future replacement seam, not require edits across the route, shell, and actions.
- Deleting public `?state=` support should remove false state complexity instead of moving it elsewhere.

### Route-state policy

**Decision**: default implementation should remove public `?state=` behavior from production `/`. If a debug state viewer is kept, it should be separate from end-user route behavior and non-production-only.

**Reason**: Current non-ready states are not real backend/data states. Public URLs that force them create false product states.

### Suspense/fallback policy

**Decision**: Avoid client search-param Suspense for homepage state selection. If Suspense remains for unrelated reasons, fallback must be static and non-interactive.

**Reason**: Fallback markup can be observed as first paint. Temporary buttons violate the interface because the interactions are discarded on hydration.

### Announcement Module

**Current friction**: The interface is `setMessage(text)`, which does not guarantee a DOM mutation for repeated identical actions.

**Target shape**:

- Store announcement events with an incrementing sequence or equivalent unique marker.
- Render a stable visible text string plus a DOM-observable change for each event.
- Keep the live region polite.

**Test surface**: repeated same-action clicks should be observable through the rendered live-region node.

### Mock card state

**Decision**:

- Remove unused `id` from mock cards unless used by a current test or rendering contract.
- Derive motion parity from `cardIndex` or a single transition state, not a separate `refreshKey` that can drift.
- Keep current mock sentences and visual accents unless copy changes are required for truthfulness.

### Prototype route availability

**Decision**: keep `/prototype` direct-url-only for this PR. Do not add a production-facing link from `/`.

**Reason**: stakeholder discovery is less important than avoiding a prototype/development affordance in the public product route. Direct URL availability satisfies the current requirement without changing homepage product meaning.

### Trellis archive manifest correction

**Decision**: manually fix the archived manifest paths currently present in this branch. Treat archive-tooling changes as a follow-up, not part of this task.

**Target shape**:

- Archived task manifests under `.trellis/tasks/archive/2026-06/...` should point to `.trellis/tasks/archive/2026-06/.../prd.md`, `design.md`, and `implement.md`.
- Leave `_example` rows alone unless the file format convention changes.

### Reduced-motion guidance correction

**Target shape**:

- Keep the contract that reduced motion neutralizes non-essential transition duration and relevant transform properties.
- Replace exact default examples such as `0.5s` and `-1deg` with generic non-neutral/default-motion language.
- Preserve the Tailwind emitted-property warning: checks must inspect `rotate`, `scale`, `translate`, or `transform` as appropriate.

## Compatibility and constraints

- Must preserve public homepage route `/`.
- Must preserve `/prototype` direct route.
- Must preserve shadcn `Button` usage and semantic HTML patterns.
- Must not introduce real network, database, filesystem storage, download, or share side effects.
- Must not change accepted ADR decisions.
- Must not perform git history rewrite or force-push in this task.

## Requirement-driven test scenarios

### Public route state

- `/` renders the ready mock homepage.
- `/?state=error` renders the ready mock homepage or ignores the parameter.
- `/?state=loading` renders the ready mock homepage or ignores the parameter.
- `/?state=empty` renders the ready mock homepage or ignores the parameter.
- `/?state=error&state=loading` renders the ready mock homepage or ignores the parameters.
- `/?state=unknown` renders the ready mock homepage or ignores the parameter.

### Fallback / first paint

- There is no user-observable interactive fallback for homepage state selection.
- If a fallback exists, it contains no enabled action buttons.

### Action feedback

- Click `下载 PNG` once: live region shows truthful placeholder feedback.
- Click `下载 PNG` twice: live region changes again in a browser-observable way.
- Click `分享` once: live region shows truthful placeholder feedback.
- Click `分享` twice: live region changes again in a browser-observable way.
- Click `再来一张`: card sentence changes and feedback updates.

### Reduced motion

- Default motion may show non-neutral motion when refreshing, without relying only on `transform` if Tailwind emits individual properties.
- Reduced-motion mode yields neutral non-essential motion and zero/non-animated transition for the card movement.

### Prototype route

- `/prototype` renders directly.
- `/` does not expose a production-facing `/prototype` link.
- Direct-url-only availability is recorded as intentional.

### Trellis artifacts and specs

- Archived manifest entries resolve to existing archive files.
- Reduced-motion quality guidance describes generic behavior, not exact homepage animation values.

## Risks

- Splitting the homepage too far could create shallow pass-through Modules. Avoid any split that fails the deletion test.
- Direct-url-only `/prototype` may be less discoverable for stakeholders, but avoids confusing public homepage users with prototype affordances.
- Manual archive path edits fix current artifacts but not the underlying archive script; note follow-up if tooling still rewrites incorrectly.
