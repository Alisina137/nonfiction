---
name: Nonfiction Studio front-matter fields
description: Why howToUseThisBook/whatYouWillLearn/whoThisBookIsFor were converted from locked manuscript-blocks to simple always-editable fields.
---

FinishStep.jsx originally had 3 free-text front-matter fields (dedication, acknowledgments, preface) plus 3 more (How to Use This Book, What You Will Learn, Who This Book Is For) implemented as manuscript-dependent "blocks" — sourced from `bookOutline.howToUseThisBook` etc via `enumerateWriteBlocks`, and locked/hidden until every chapter+section was fully drafted.

This caused the 3 blocks to appear "missing" to users on new/in-progress projects, and — critically — export payloads never even sent this data (`exportPayload` only had dedication/acknowledgments/preface), so the API server's `buildBookPdf`/`buildBookDocx` had no way to render them at all.

**Decision:** Converted all 6 front-matter fields to the same simple pattern — plain `useState` strings, always visible/editable textareas, generated via `/api/ai/lesson` without requiring manuscript completion. Removed the locked "manuscript-based sections" block UI entirely.

**Why:** Matches user mental model (6 uniform inputs) and guarantees the values actually reach the export routes. The old locked-block design mixed "front matter" concerns with "manuscript state" for no real benefit.

**How to apply:** If reintroducing manuscript-aware front matter, remember: (1) `exportPayload` in FinishStep.jsx must include every field key you want exported, and (2) `artifacts/api-server/src/routes/export/index.ts` (`buildBookPdf`/`buildBookDocx`) must explicitly destructure + render each field — nothing is automatic.
