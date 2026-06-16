// Shared admin status token for e2e: imported by both playwright.config.ts
// (injected into the web server env) and tests/admin-status.spec.ts (presented
// by the browser/request). Single source of truth so the two cannot drift.
export const e2eAdminStatusToken = "e2e-admin-status-token"
