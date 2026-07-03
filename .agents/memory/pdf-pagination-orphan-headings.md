---
name: PDF pagination orphan-heading fix
description: Why prose blocks must page-break line-by-line, not as a whole unit, in hand-rolled PDF layout code
---

When manually laying out text on a PDF page (pdf-lib style, no automatic reflow), checking "does this whole paragraph/block fit on the remaining page?" before drawing it causes orphaned headings.

**Why:** If a heading is drawn near the bottom of a page with just enough room left for itself but not its entire following paragraph, an all-or-nothing room check moves the *entire* paragraph to the next page — leaving the heading stranded alone at the bottom of the previous page with no body text under it. This violates "no orphaned headings" typesetting rules and is easy to miss in short test cases; it only shows up with paragraphs long enough to approach a page boundary.

**How to apply:** In any custom pagination loop, check available room per-line (or per small chunk) inside the render loop itself, not once up front for the whole block. Let paragraphs flow across a page break naturally like real body text does. Combine with `keepNext`/minimum-room heuristics before drawing a heading so at least one line of body text is guaranteed on the same page as the heading. Always verify with a manufactured long paragraph placed right after a heading near a page boundary — short test content will not surface this bug.
