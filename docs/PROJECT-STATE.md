# Project State — Nonfiction AI Studio

## Product objective

Private, personal-use AI nonfiction publishing studio for creating original, high-quality nonfiction manuscripts and KDP-ready exports. This project is not being developed as a public SaaS product; authentication, billing, tenancy, and public-user infrastructure are intentionally out of scope unless explicitly requested later.

## Source of truth

- Current product direction: user's latest instruction for a personal KDP book-creation tool.
- Implementation process: Software Development Workflow V4 supplied on 2026-09-25.
- Current-source baseline for Phase 02: `main` at `a21d89579b1ad3ab1a58896c7e7fce3185b75a21`.
- Active implementation branch: `phase-02-manuscript-evidence-kdp-qa`.

## Technology stack

- pnpm workspaces
- Node.js 24+
- TypeScript 5.9
- React 19 + Vite
- Express 5 API
- Gemini / Groq / OpenRouter / SambaNova AI routing
- Rainforest + Scale SERP + Open Library market research chain
- PDF and DOCX manuscript export

## Current phase

### Phase 02 — Manuscript Evidence Review & KDP QA

Objective: make source usage visible at the section and whole-manuscript level, identify claim-like prose that lacks matching retained evidence, keep revision actions source-grounded, and provide a deterministic pre-export publishing preflight.

### Implemented outcomes

- Added a deterministic manuscript evidence audit engine.
- Tracks drafted sections with/without retained source evidence.
- Tracks actual source usage by uploaded source ID, section, and PDF page.
- Detects claim-like sentences involving statistics, studies/research, attributed findings, quotations, dates, and large numeric claims.
- Compares claim-like sentences only against the evidence retained for that section and flags unmatched claims for editorial review.
- Added a per-section Source Inspector in the Write step showing source title, page label, and evidence text.
- Added whole-manuscript Evidence Audit in the Finish step with coverage, used-source count, supported claim count, review count, source inspector, and claim-review list.
- Added deterministic publishing preflight checks for required metadata, manuscript presence, listing description, trim selection, title/subtitle consistency, reference wording overlap, claim review, and References presence.
- Publishing preflight is explicitly presented as an internal QA tool, not Amazon approval or external fact checking.
- Generated References and Further Reading now use only verified sources actually retained by manuscript sections, rather than every source in the project library.
- Improve/Edit actions now receive the section's retained evidence and are prohibited from adding unsupported studies, statistics, quotations, named real cases, URLs, or page references.
- Improve/Edit actions retain existing source evidence and recompute reference-overlap safety after revisions.
- Added Phase 02 unit tests for evidence coverage, unsupported-claim detection, used-source filtering, and publishing-preflight behavior.

### Verification status

- Phase 01 local verification supplied by the user: reference tests PASS and full TypeScript typecheck PASS.
- Phase 02 GitHub Actions verification: PASS.
- Phase 02 unit tests: PASS.
- Phase 02 full TypeScript typecheck: PASS.
- Phase 02 production build: PASS.
- Verified workflow run: `Verify phase` run #18 against implementation head `827bd691af0b65a7b0bc204abf8e7f7447087efe`.

### Phase 02 known limitations

- Claim detection is intentionally heuristic and conservative; it is not an external fact-checking service.
- A claim marked “supported” means it has lexical support in evidence retained by the project, not that an independent source was externally verified at audit time.
- Source usage is based on retained `sourceEvidence` from generated sections. Manual prose can still require human review even when a section has attached evidence.
- Sources manually added outside the section-evidence flow are not automatically treated as “used” for generated References.
- Retrieval remains lightweight keyword-based retrieval over compact PDF indexes rather than embeddings/vector search.
- Reference-overlap detection remains fingerprint/verified-quote based rather than a full plagiarism database.
- EPUB export is not part of this phase.

## Architecture decisions

1. Keep the project personal and browser-centered instead of adding SaaS infrastructure.
2. Use Gemini native PDF understanding rather than adding a local PDF parser dependency.
3. Store compact research intelligence instead of raw uploaded PDF bytes in localStorage.
4. Use deterministic/verified source metadata for References; never ask an LLM to invent bibliography entries.
5. Use AI for cross-book synthesis and ranking, but validate source IDs against an explicit whitelist.
6. Treat phrase-overlap detection as a focused safety signal, not a full plagiarism database.

## Verification status

- Reference-intelligence helper tests: PASS (evidence retrieval, verified-source filtering, phrase-overlap detection).
- Pull request: #1, draft, cleanly mergeable with `main`.
- Full install/typecheck/build still requires execution in a real Node/pnpm workspace. GitHub Actions did not start from connector-created commits, so no CI pass is claimed.
- For Windows local setup, run `pnpm install --no-frozen-lockfile` once so pnpm refreshes platform-specific optional binaries after the Replit/Linux-only override cleanup.

## Known limitations

- Deep document indexing currently targets PDF reference books. DOC/DOCX files remain supporting resources rather than full native-document reference indexes.
- PDF analysis requires `GEMINI_API_KEY`; other configured AI providers do not receive the raw PDF.
- Reference-overlap scanning checks indexed phrase fingerprints and verified short quotes only; it is not a full external plagiarism service.
- Source page numbers refer to 1-based PDF page indexes, which may differ from printed page numbers inside a book.
- The project still stores its working book/project state in browser localStorage by design for personal use.

## External requirements

- `GEMINI_API_KEY` for PDF reference analysis.
- At least one configured AI provider for ordinary generation.
- Amazon provider keys are optional because Open Library is available as a real-data fallback.

## Next phase candidate

Phase 03 — Evidence Precision & Publishing Automation:
- optional semantic/embedding retrieval over indexed source evidence,
- source-use pruning after major manual rewrites,
- richer citation styles and in-manuscript citation insertion when desired,
- automated metadata/cover/manuscript consistency report,
- optional EPUB export,
- final export bundle checklist and publication archive.

