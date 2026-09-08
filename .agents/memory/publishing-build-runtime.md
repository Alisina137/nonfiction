---
name: Publishing build and runtime requirements
description: This workspace's publish path needs workspace build dependencies and Express 5-compatible SPA fallback syntax.
---

Publishing must explicitly install workspace development dependencies before building because the frontend compiler is a dev dependency. Production Express 5 catch-all routes must use named wildcard syntax such as `/{*splat}`, not `*`.

**Why:** The publishing environment can omit dev dependencies during its package-install phase, and Express 5 rejects unnamed legacy wildcards during application startup.

**How to apply:** Keep the publish build command on `pnpm install --frozen-lockfile --prod=false` before workspace builds, and test the production run command with both `/` and `/health` before republishing.