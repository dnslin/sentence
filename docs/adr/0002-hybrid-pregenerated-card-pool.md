---
status: accepted
---

# Use a hybrid pregenerated card pool

句画 will serve users from a pregenerated pool of ready 图文卡片 instead of making every user wait for image generation. A background worker keeps the pool near 200 ready cards and replenishes when it drops below 50, while the web app can handle empty-stock states; this favors instant refreshes and predictable model spend over fully on-demand freshness.
