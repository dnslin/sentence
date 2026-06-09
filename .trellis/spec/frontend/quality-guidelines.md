# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Frontend work should preserve public browser behavior, avoid leaking prototype-only controls into production, and verify route-visible behavior through public interfaces when the route is the contract.

---

## Prototype-Only UI Controls

### Contract: production exclusion

**Scope / Trigger**: Any control, banner, switcher, debug affordance, or prototype-only navigation that is useful during development but should not exist in production.

**Signature**:

```typescript
const showPrototypeControl = process.env.NODE_ENV !== "production"

return <>{showPrototypeControl ? <PrototypeControl /> : null}</>
```

**Contracts**:

- Development/non-production may render the control if it is visibly separate from product content.
- Production must not render the control in the DOM or accessibility tree.
- CSS-only hiding is not enough for production exclusion.
- If development visibility or interaction is part of the feature contract, verify that behavior through a browser-observable check.

**Validation & Error Matrix**:

| Condition | Required behavior |
| --- | --- |
| `NODE_ENV !== "production"` | Control may be visible and discoverable when development visibility is part of the feature contract. |
| `NODE_ENV === "production"` | Control is not rendered. |
| Browser/accessibility snapshot contains the production-excluded label in production | Failing check; remove server-rendered output. |

**Good/Base/Bad Cases**:

- Good: a floating prototype switcher appears in dev and has shareable links when variant switching is a documented prototype contract.
- Base: the production page renders the main content without the switcher.
- Bad: the switcher is hidden with `display: none` but still exists in the production DOM.

**Tests Required**:

- Production build/server or equivalent rendered-output check confirms the control label is absent from page text/accessibility output.
- Development/non-production browser checks are required when the task changes the control's development visibility, interaction, or route-visible behavior.
- Small refactors that do not alter the control contract may rely on lint/type/build plus the production exclusion check.

**Wrong vs Correct**:

#### Wrong

```tsx
<nav className="hidden">原型切换器</nav>
```

#### Correct

```tsx
{process.env.NODE_ENV !== "production" ? <nav aria-label="原型切换器">...</nav> : null}
```

---

## Development Dev-Resource Origins

### Contract: browser automation origins must be explicit

**Scope / Trigger**: Local browser automation or manual development opens a Next.js dev route from a host that differs from the dev server's canonical host, such as `127.0.0.1` when HMR/dev resources are served from `localhost`.

**Signature**:

```typescript
// next.config.ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
}

export default nextConfig
```

**Contracts**:

- Add only the specific local development origins that are needed for browser checks or manual development.
- Do not use wildcard origins.
- Do not treat `allowedDevOrigins` as production CORS; it must not be paired with broad production response headers for this use case.
- Restart the dev server after changing `allowedDevOrigins`.

**Validation & Error Matrix**:

| Condition | Required behavior |
| --- | --- |
| Browser checks open `http://127.0.0.1:<port>` and Next warns about blocked dev resources | Add `"127.0.0.1"` to `allowedDevOrigins`. |
| Browser checks use the canonical dev host, such as `localhost` | No extra origin is required. |
| A LAN/custom host is needed | Add that exact host only after confirming it is required for local development. |
| Production build/server | No wildcard CORS headers or broadened production response headers are introduced by this fix. |

**Good/Base/Bad Cases**:

- Good: `allowedDevOrigins: ["127.0.0.1"]` when `agent-browser` checks open `127.0.0.1` and HMR/dev resources need that origin.
- Base: no `allowedDevOrigins` entry when all browser checks use `localhost` and no warning appears.
- Bad: adding `"*"`, adding broad production CORS headers, or using this setting to mask an unrelated production cross-origin problem.

**Tests Required**:

- `pnpm typecheck` must accept the `NextConfig` shape.
- `pnpm build` must still pass and must not depend on the development-only origin allowance.
- A browser-observable dev check should use either the canonical host or the explicitly allowed local host.

**Wrong vs Correct**:

#### Wrong

```typescript
const nextConfig = {
  headers: async () => [
    {
      source: "/:path*",
      headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
    },
  ],
}
```

#### Correct

```typescript
const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
}
```

---

## Required Patterns

- For route features, verify the route through browser-observable behavior when feasible.
- Keep prototype copy from implying future slices are already implemented.
- Use semantic elements (`main`, `section`, `article`, `nav`, `aside`) for page structure.

---

## Forbidden Patterns

- No debug logging left in production-facing frontend code.
- No prototype-only controls rendered in production DOM.
- No copy that claims unavailable actions such as refresh/download/share before those slices implement them.

---

## Code Review Checklist

- [ ] Linter passes.
- [ ] Type checker passes.
- [ ] Production build passes.
- [ ] Browser-visible acceptance criteria are checked through a browser tool or equivalent public interface when the route/control behavior is the public contract.
- [ ] Prototype/development affordances are absent from production output.
