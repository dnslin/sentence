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

**Validation & Error Matrix**:

| Condition | Required behavior |
| --- | --- |
| `NODE_ENV !== "production"` | Control may be visible and discoverable. |
| `NODE_ENV === "production"` | Control is not rendered. |
| Browser/accessibility snapshot contains the production-excluded label in production | Failing check; remove server-rendered output. |

**Good/Base/Bad Cases**:

- Good: a floating prototype switcher appears in dev and has shareable links.
- Base: the production page renders the main content without the switcher.
- Bad: the switcher is hidden with `display: none` but still exists in the production DOM.

**Tests Required**:

- Browser check in development/non-production confirms the control is visible when expected.
- Production build/server browser check confirms the control label is absent from page text/accessibility output.

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
- [ ] Browser-visible acceptance criteria are checked through a browser tool or equivalent public interface.
- [ ] Prototype/development affordances are absent from production output.
