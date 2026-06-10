# Frontend Development Guidelines

> Frontend development contracts for this project.

---

## Overview

This directory contains frontend implementation contracts. Read the relevant files before editing frontend routes, components, or browser-visible behavior.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | To fill |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | To fill |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | To fill |
| [State Management](./state-management.md) | Local state, global state, server state | To fill |
| [Quality Guidelines](./quality-guidelines.md) | Browser-visible checks and production-only/prototype-only UI contracts | Active |
| [Type Safety](./type-safety.md) | Next.js route boundary typing and query normalization | Active |

---

## Pre-Development Checklist

- [ ] For App Router pages that read query strings, read [Type Safety](./type-safety.md).
- [ ] For prototype, debug, or browser-visible route behavior, read [Quality Guidelines](./quality-guidelines.md).
- [ ] If creating reusable UI components, read [Component Guidelines](./component-guidelines.md).

---

## Quality Check

- [ ] Confirm route query values are normalized at the route boundary.
- [ ] Confirm prototype-only or debug controls are not rendered in production output.
- [ ] Run lint, typecheck, build, and browser-observable checks required by the task.

---

**Language**: All documentation should be written in **English**.
