---
name: Artifact type immutability
description: Platform behavior when changing a registered artifact between web, video, and other kinds.
---

Registered artifact metadata protects the `kind` field. The protected TOML verifier rejects attempts to change an existing artifact from one kind to another, even when the rest of the configuration is valid.

**Why:** A video build temporarily changed an existing web app artifact into video mode, and restoring `kind = "web"` was rejected by the platform.

**How to apply:** Treat artifact kind as immutable after registration. If a different kind is genuinely needed, create or migrate to a separate artifact rather than editing the existing artifact's kind.