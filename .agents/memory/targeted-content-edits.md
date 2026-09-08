---
name: Targeted content edits
description: Preservation contract for author-requested edits in the Write step.
---

Write-step edits are targeted revisions, not fresh subsection generation. The existing prose, paragraph/list structure, facts, examples, and voice should remain unless the author's instruction explicitly changes them.

**Why:** Providers sometimes answered an edit brief by generating a new subsection, which discarded content the author wanted to keep.

**How to apply:** Keep the minimal-change language in the edit prompt, assess candidate overlap and structure server-side, retry once with a conservative repair prompt, and preserve the original draft when the candidate still looks like a rewrite.