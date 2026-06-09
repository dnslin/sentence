---
status: accepted
---

# Self-host Next.js with Docker Compose

句画 will run on a single overseas VPS instead of Vercel. We chose a Docker Compose deployment with separate `web` and `worker` services from the same Next.js/Node image, because the product needs long-running background generation, local SQLite/WebP storage, and host Nginx TLS while avoiding Vercel-specific storage and serverless constraints.
