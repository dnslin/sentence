---
status: accepted
---

# Store bindings in SQLite and illustrations as local WebP files

句画 will use SQLite WAL via Drizzle for sentence/card metadata, rate-limit state, and generation status, while storing generated illustrations as local WebP files on the VPS. This matches the single-machine deployment, keeps database backups simple, avoids storing large blobs in SQLite, and preserves generated assets without depending on temporary model URLs.
