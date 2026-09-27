# Project State — Nonfiction AI Studio

## Product objective

Private, personal-use AI nonfiction publishing studio for creating original, source-grounded nonfiction manuscripts and KDP-ready publishing outputs. Authentication, billing, tenancy, and public SaaS infrastructure remain intentionally out of scope.

## Source of truth

- Product direction: user's latest instructions for a personal KDP book-creation tool.
- Implementation process: Software Development Workflow V4 supplied on 2026-09-25.
- Phase 03 baseline: `main` at `04a9766dfa00aab8b807dce4599bf13c3c379ba5`.
- Active implementation branch: `phase-03-evidence-precision-publishing-automation`.

## Technology stack

- pnpm workspaces
- Node.js 24+
- TypeScript 5.9
- React 19 + Vite
- Express 5 API
- OpenRouter / Groq / SambaNova AI routing
- Rainforest + Scale SERP + Open Library market research chain
- PDF and DOCX manuscript export
- Browser/localStorage project persistence by design

## Completed phases

### Phase 01 — Reference Intelligence & Publishing Safety

- OpenRouter PDF reference indexing with Universal PDF Support / Mistral OCR.
- Compact source intelligence indexes instead of storing raw PDFs.
- Cross-book synthesis.
- Per-subsection evidence retrieval.
- Verified-source-only back matter.
- Source-grounding generation rules.
- Phrase/quote overlap safety scan.
- Removed AI-invented competitor-book fallback.

### Phase 02 — Manuscript Evidence Review & KDP QA

- Whole-manuscript evidence audit.
- Per-section Source Inspector.
- Claim-like sentence review against retained evidence.
- Used-source-only References/Further Reading.
- Evidence-aware Improve/Edit actions.
- Deterministic KDP preflight.
- Tests for evidence tracking, claims, references, and preflight.
- GitHub Actions verification passed for tests, typecheck, and production build.

## Current phase

### Phase 03 — Evidence Precision & Publishing Automation

Objective: improve evidence relevance, prevent stale source links after rewriting, make verified citations available at export time, reconcile publishing metadata, and package the finished project into a reproducible publication archive.

### Implemented outcomes

#### Hybrid semantic evidence retrieval

- Every indexed evidence item now receives a stable evidence ID.
- Local retrieval was strengthened with token coverage, title weighting, phrase/bigram overlap, source priority, and evidence-type weighting.
- Generation first creates a deterministic candidate whitelist.
- New `/api/ai/rerank-evidence` endpoint semantically reranks only those whitelisted evidence IDs.
- The reranker cannot invent source IDs, quotations, page numbers, or evidence text.
- If semantic reranking is unavailable, generation automatically falls back to local hybrid order.
- Final writing still receives a bounded set of evidence items with per-source diversity limits.

#### Stale-source pruning

- Added evidence freshness scoring against the current final prose.
- Evidence that no longer matches a rewritten section is classified as stale.
- Stale evidence is excluded from Phase 03 source usage, citations, and final References.
- AI Improve/Edit operations actively prune stale evidence from the saved section after revision.
- Manual rewrites are evaluated dynamically by the precision audit even when the underlying historical evidence remains available for recovery.
- Source Inspector shows only currently relevant evidence and warns when old evidence has become stale.

#### Verified citation-aware export

- Added deterministic citation registry based only on verified sources actually used by non-stale manuscript evidence.
- Optional export styles:
  - no in-manuscript markers,
  - numbered markers such as `[1]`,
  - author-year markers such as `(Author, 2024)`.
- Citation markers are inserted only into the export clone of the manuscript; saved author text is not modified.
- Only claim-like sentences that already have retained matching evidence receive automatic markers.
- Export References are rebuilt from the same verified citation registry when citation markers are enabled.

#### Publication consistency report

- Compares manuscript title/subtitle/author against cover publishing metadata.
- Checks listing keywords and publishing categories.
- Reports selected citation mode.
- Reminds the author to confirm that cover dimensions match the selected manuscript trim.
- Produces explicit pass/review items instead of a hidden aggregate score.

#### Publication bundle

- Added one-click ZIP export without introducing an additional ZIP dependency.
- Bundle includes:
  - citation-aware print PDF,
  - citation-aware DOCX,
  - publishing metadata JSON,
  - manuscript evidence audit JSON,
  - KDP preflight JSON,
  - publication consistency JSON,
  - citation registry JSON,
  - listing description text,
  - listing keywords text,
  - bundle README.
- ZIP generation uses a deterministic dependency-free stored-file ZIP writer on the API server.

### Verification status

- Phase 01 focused helper tests: PASS.
- Phase 02 GitHub Actions: PASS for tests, TypeScript, and production build.
- Phase 03 GitHub Actions verification: PASS.
- Phase 03 unit tests: PASS.
- Phase 03 full TypeScript typecheck: PASS.
- Phase 03 production build: PASS.
- Verified workflow: `Verify phase` run #20 against implementation head `aaf097cdb5cb9d3118ec460cf0f9950d31b0137a`.

## Architecture decisions

1. Keep the product private and browser-centered; do not add SaaS infrastructure without explicit need.
2. Keep raw uploaded PDFs out of persistent browser project state after indexing.
3. Semantic retrieval must rerank an explicit extracted-evidence whitelist rather than generate evidence.
4. Evidence freshness affects publishing/citation usage but historical evidence can remain recoverable.
5. Citation insertion happens on an export clone; the author's saved prose is not silently rewritten.
6. References must be derived from verified sources and actual non-stale manuscript use.
7. Publishing QA remains an internal assistance layer, not an Amazon approval guarantee or external fact-check.
8. Publication archives should be reproducible without requiring a new hosted service or database.

## Known limitations

- PDF indexing depends on OpenRouter document parsing; scanned/image-heavy PDFs use the configured PDF parser path.
- DOC/DOCX reference files do not yet receive the same deep native-document index as PDFs.
- Semantic reranking uses an existing text-generation provider rather than a dedicated embedding/vector database.
- Freshness and claim support are conservative lexical/semantic assistance signals, not external verification.
- Citation formatting is practical project formatting, not a complete implementation of every academic citation style.
- Reference overlap remains a project-local phrase/verified-quote check, not a full plagiarism database.
- EPUB is not yet generated.
- Cover files themselves are not embedded into the publication ZIP; the bundle currently stores cover/publishing metadata and manuscript outputs.

## External requirements

- `OPENROUTER_API_KEY` for PDF reference analysis.
- At least one configured AI provider for ordinary AI generation and semantic reranking.
- Semantic reranking gracefully falls back to deterministic local retrieval if no provider is available.
- Rainforest/Scale SERP are optional because Open Library remains the real-data fallback.
- PostgreSQL remains optional for the current personal/localStorage workflow.

## Pre-Phase-04 Cover Studio Overhaul

The Create Book cover step is now active; the old “Build soon” placeholder has been replaced by the existing full Cover Studio.

Public CoAuthor cover-workflow research was used only as product/UX reference. No proprietary code or artwork was copied. The implementation also incorporates current Amazon KDP paperback production rules.

Implemented:

- Front / Back / Full Cover surface workflow.
- Existing market analysis, cover strategy, mood boards, palettes, design elements, typography intelligence, layout intelligence, concept generation, and AI concept review are now reachable from Create Book.
- Previously locked Visual Direction, Typography, and Layout workflow entries are enabled.
- KDP print setup appears before production review:
  - trim size,
  - page count,
  - black/white white paper,
  - black/white cream paper,
  - standard color,
  - premium color,
  - LTR / RTL layout,
  - guide visibility,
  - spine-text preference,
  - barcode handling.
- Page count is initially estimated from the manuscript/target but remains editable because the final formatted page count determines the real spine.
- Paperback geometry uses current KDP formulas:
  - 0.125 inch bleed,
  - white-paper spine = pages × 0.002252 inch,
  - cream-paper spine = pages × 0.0025 inch,
  - standard-color spine = pages × 0.002252 inch,
  - premium-color spine = pages × 0.002347 inch.
- Full-wrap dimensions and 300-DPI pixel dimensions update live.
- Spine text is treated as production-eligible only at 80+ pages.
- Full-wrap preview shows front, back, spine, bleed guides, safe-area guides, spine safe area, and barcode-safe region.
- RTL full-wrap preview swaps the front/back sides; unsupported-language warnings are shown for KDP paperback RTL.
- Back-cover copy can be generated by AI from verified project information with rules against invented credentials, reviews, awards, statistics, or bestseller claims.
- Back-cover layouts: Editorial, Authority, Benefits, Minimal.
- Cover concepts record the trim they were generated for; changing trim afterward triggers a regeneration warning.
- KDP cover preflight checks title, author, page count, selected concept, spine-text eligibility, back-cover copy, barcode reservation, and trim consistency.
- Added cover-geometry regression tests.
- Final flattened print-cover PDF/JPEG export remains Phase 04 scope so export can be built against the final formatted page count and final cover assets.

Verification:

- GitHub Actions workflow run #23 passed tests, full TypeScript typecheck, and production build on the cover-overhaul implementation head.

## Regional AI Provider Migration

- Direct Google Gemini / Google AI Studio support was removed because Afghanistan is not on Google's current Gemini API available-regions list.
- The app no longer reads or requires `GEMINI_API_KEY`.
- Provider order is now OpenRouter → Groq → SambaNova.
- OpenRouter is the primary general provider and the document/PDF provider.
- PDF Reference Intelligence now uses OpenRouter Universal PDF Support with the `file-parser` plugin and Mistral OCR engine, preserving support for scanned/image-heavy PDFs.
- Cross-book reference synthesis uses a long-context OpenRouter path with fallback to the normal non-Google provider chain.
- Google/Gemini model fallbacks were removed from task chains to avoid indirect reliance on Google-hosted model availability.
- Frontend provider status/preferences automatically discard stale Gemini selections saved in localStorage.
- Vite development now uses a dedicated frontend port variable/default instead of the API `PORT`, and `strictPort` is disabled so a stale process on 5173 no longer terminates the whole parallel dev command.

## Cover Studio Sidebar Workflow Hardening

The Cover Studio sidebar is now a goal-driven design workflow rather than a navigation-only rail.

- Every sidebar item has an explicit goal, purpose, success target, and output.
- The active tool shows a mission bar explaining what decision the author is making and what completion means.
- Sidebar status dots show target/in-progress/complete state.
- Text now exposes the existing AI Typography Intelligence as a dedicated workflow and can apply supported font-category, alignment, and hierarchy recommendations into editable cover typography.
- Layout now exposes the existing AI Layout Intelligence as a dedicated workflow and can apply alignment/focal-area guidance, enable KDP guides, and return the author to Canvas for visual verification.
- Setup now has a dedicated production-readiness workspace showing required metadata, live KDP geometry, and all preflight checks while Design/Print inspector tabs remain editable on the right.
- Market, Strategy, Mood, Colors, Elements, Generate, Review, and Canvas keep their existing functional engines but now expose a clear design mission and completion target.
- Text/Layout are not considered complete merely because AI advice exists; the author must apply the guidance.
- Full workflow semantics are documented in `docs/COVER-SIDEBAR-WORKFLOW.md`.

## Phase 04 — Final Book Production & KDP Export

Objective: convert the finished manuscript and cover design into reproducible final production artifacts with exact pagination, current paperback geometry, EPUB output, print-cover output, upload checklists, and versioned publication archives.

### Implemented production pipeline

#### Exact final pagination

- PDF rendering now returns the real final page count instead of relying on a words-per-page estimate.
- Finish can run **Final Production Check**, which renders the actual interior and reports exact page count, trim, margins, final spine width, and production checks.
- The exact final page count can be synced back into Cover Studio.
- Cover Studio records the source as `final-production`; manual edits change the source back to `manual`.
- Print-cover export is blocked until the exact final page count has been synchronized.

#### Current paperback margin validation

- Replaced the old approximate gutter table with the current KDP minimum inside-margin thresholds:
  - 24–150 pages: 0.375 in,
  - 151–300 pages: 0.500 in,
  - 301–500 pages: 0.625 in,
  - 501–700 pages: 0.750 in,
  - 701–828 pages: 0.875 in.
- KDP automatic margins still use 0.750 in top/bottom and 0.500 in outside margins, which remain above the current no-bleed minimums.
- The PDF renderer now automatically re-renders when exact final pagination crosses a gutter threshold that the original estimate did not anticipate.
- Custom margins are validated against the exact final page count and can produce blocking production checks.

#### Layout QA

- Existing section/subsection heading orphan protection remains enabled.
- Multi-line paragraph/list blocks now avoid starting when only one line of room remains on the current page.
- The final production report records how many blocks were moved by this protection.
- Final visual validation is still required in KDP Print Previewer; internal checks do not claim to replace Amazon's preview.

#### EPUB 3 export

- Added dependency-free EPUB 3 generation using the project's existing ZIP engine.
- EPUB contains:
  - required `mimetype`,
  - META-INF container,
  - EPUB 3 package metadata,
  - navigation document,
  - reading-order spine,
  - CSS,
  - title page,
  - optional front matter,
  - introduction,
  - chapters/sections/subsections,
  - conclusion,
  - back matter,
  - About the Author.
- Metadata includes title, author, language, deterministic identifier, and modification timestamp.
- Added internal structural validation.
- Finish exposes **Download EPUB (.epub)**.
- Kindle Previewer validation remains an explicit manual checklist item before publication.

#### Final flattened paperback cover PDF

- Cover Studio Print inspector exposes **Export Final Print Cover PDF**.
- Export requires a page count synchronized from Final Production Check.
- The current Full Cover artwork is rasterized in-browser at the exact 300-DPI full-wrap pixel dimensions.
- Safe-area, bleed-guide, spine-guide, and barcode-guide overlays are excluded from the exported artwork.
- The API validates the expected pixel dimensions and effective DPI.
- The API creates one flattened exact-size PDF page containing back + spine + front.
- Successful exports store metadata only:
  - final page count,
  - trim,
  - effective DPI,
  - full-wrap dimensions,
  - pixel dimensions,
  - cover design hash,
  - export timestamp.
- The large cover PDF/image is not persisted in localStorage.
- Any material cover-design change invalidates the stored final-export metadata so stale cover files do not remain marked current.

#### Final production report and KDP upload checklist

- Final Production Check validates:
  - exact paperback page count,
  - interior trim,
  - exact-page-count inside margin,
  - outside/top/bottom margins,
  - Cover Studio page-count synchronization,
  - cover/interior trim consistency,
  - selected concept,
  - back-cover copy,
  - spine-text eligibility,
  - barcode policy,
  - current final-cover export metadata,
  - heading/paragraph pagination protection,
  - EPUB structure.
- Generates separate paperback and Kindle eBook upload checklists.
- Paperback checklist explicitly requires KDP Print Previewer and proof review.
- Kindle checklist explicitly requires Kindle Previewer and a separately uploaded eBook front-cover image.

#### Versioned final publication archive

- Final Publication Archive now includes:
  - paperback interior PDF,
  - editable DOCX,
  - EPUB 3,
  - publishing metadata,
  - evidence/preflight/consistency/citation reports,
  - final production report,
  - EPUB validation report,
  - KDP upload checklist,
  - listing description and keywords,
  - print-cover export metadata,
  - archive manifest.
- Archive manifest includes SHA-256 production fingerprint, exact page count, trim, production status, EPUB status, and archive ID.
- Archive filenames are versioned by archive ID instead of silently replacing a generic final ZIP.
- Successful archive downloads are recorded in project state as a rolling production history (up to 10 snapshots).
- The flattened cover PDF itself remains a separate download because the app deliberately avoids persisting that large binary in browser project state; its metadata is included in the archive fingerprint.

### Phase 04 verification status

- Implementation branch: `phase-04-final-book-production-kdp-export`.
- Verification pending GitHub Actions.
- Do not claim Phase 04 tests/typecheck/build passed until the final branch workflow is green.

## Next phase candidate

### Phase 04 — Final Book Production & KDP Export

Potential scope:
- EPUB generation and validation,
- print-cover file integration with trim/spine/bleed consistency checks,
- final publication archive history/versioning,
- richer citation style templates if needed,
- export-time orphan/widow/layout QA,
- final KDP upload checklist and project freeze/archive workflow.
