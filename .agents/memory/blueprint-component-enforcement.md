---
name: Blueprint component enforcement must cover every content-touching route
description: Selecting blueprint components in Outline only sticks if every route that generates or edits subsection prose enforces the allow/forbid list — not just the initial generation route.
---

Nonfiction Studio lets users pick specific "blueprint components" (Case Study, Statistics, Action Plan, etc.) per subsection in the Outline step. That selection must be respected by ANY route that produces or modifies that subsection's prose — not just the first-draft generation route.

**Why:** Two separate leaks were found and fixed in this area, both because a secondary code path had its own prompt/logic that didn't know about `blueprintComponents`:
1. Chapter-level `teachingMethods` (from a cached per-chapter strategy, shared across all subsections in that chapter) would suggest a teaching method (e.g. "case study", "exercise") that conflicted with a specific subsection's selected components, and the model would follow the suggestion, injecting an unselected component.
2. The `/api/ai/improve` route (used for "Add depth"/"Add example" refinement actions in the Write step) had a completely separate prompt (`improvementPrompt`) with no `blueprintComponents` awareness at all — its "expand" instruction literally told the model it could "add a case study," bypassing the enforcement built into the main generation route entirely.

**How to apply:** Whenever a new AI action is added that can write or rewrite subsection-level prose (regeneration, refinement, tone shift, translation, etc.), it must: (1) accept `blueprintComponents` from the frontend block data, (2) compute a forbidden-components list the same way `lessonPrompt` does, and (3) inject an explicit ALLOWED/FORBIDDEN block into its prompt that overrides any other instruction (action-specific wording, chapter strategy, etc.) that could suggest an unselected component. `ALL_BLUEPRINT_COMPONENTS` is defined at module scope in `prompts.ts` specifically so any prompt function can reuse it for this check.
