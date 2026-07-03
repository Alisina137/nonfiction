---
name: Front matter generation gating
description: Introduction and front-matter sections (How to Use This Book, What You Will Learn, Who This Book Is For) must be locked in the UI and blocked at generation-time until the full manuscript (all chapters + sections) exists.
---

Front matter sections need the finished manuscript as context (they summarize/describe chapters), so generation must be sequenced: Title → Outline → Chapters/Sections fully drafted → verify completeness → only then generate Introduction/How-to-Use/What-You'll-Learn/Who-It's-For. Conclusion is not part of this gate (spec only names the four front-matter sections).

**Why:** Generating these sections before the chapters exist means the AI has nothing real to summarize, producing generic or inaccurate front matter. The user explicitly required this lock via a spec doc.

**How to apply:**
- In `WriteStep.jsx`, "chapter body blocks" = blocks with `kind === "section" || kind === "subsection"` (excludes intro/front-matter/conclusion via `FRONT_MATTER_KINDS`). `manuscriptComplete` = every chapter body block has content.
- Both the UI (disabled button + lock message on `BlockContent`) AND the generation function itself (`generateBlock` via `isFrontMatterLockedFor`) enforce the lock — never rely on the UI alone, since batch generation (`generateRemaining`) or stale state could otherwise bypass it.
- `generateRemaining` ("Generate rest of book") must reorder execution: all chapter body blocks first, then front matter, then conclusion — NOT the original `enumerateWriteBlocks` order (which lists front matter first because that's the reading/display order in the manuscript, not the generation order).
