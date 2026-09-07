---
name: Provider-neutral manuscript normalization
description: Lesson generation must enforce a shared editorial flow and normalize provider-specific formatting before content reaches the editor.
---

The lesson endpoint is the publication boundary: prompts define one provider-neutral flow, while server-side normalization removes model-specific Markdown habits and rejects planning-language leakage.

**Why:** Fallback providers vary in formatting obedience and can return structurally valid JSON containing headings, decorative symbols, or internal planning language.

**How to apply:** Keep canonical flow rules in the lesson prompt and keep deterministic formatting cleanup and quality gates on the server; frontend cleanup is only a presentation safeguard.