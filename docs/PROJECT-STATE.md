# Project State — Nonfiction AI Studio

## Product objective

Private, personal-use AI nonfiction publishing studio for creating original, high-quality nonfiction manuscripts and KDP-ready exports. This project is not being developed as a public SaaS product; authentication, billing, tenancy, and public-user infrastructure are intentionally out of scope unless explicitly requested later.

## Source of truth

- Current product direction: user's latest instruction for a personal KDP book-creation tool.
- Implementation process: Software Development Workflow V4 supplied on 2026-09-25.
- Current-source baseline: `main` at `3a54ae638fce3217384b4d09f3cadd4fa0a15811`.
- Active implementation branch: `phase-01-reference-intelligence`.

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

### Phase 01 — Reference Intelligence & Publishing Safety

Objective: make uploaded reference books genuinely useful for original nonfiction creation while reducing fabricated citations, unsupported factual claims, and accidental reuse of source wording.

### Implemented outcomes

- Native Gemini PDF document analysis for uploaded PDF reference books.
- PDF reference limit increased to 50 MB; raw PDF bytes are discarded from project state after indexing.
- Compact per-book research index containing source metadata, chapter map, concepts, lessons, claims, frameworks, examples, short verified quotes, and phrase fingerprints.
- Cross-book synthesis engine for themes, lesson candidates, agreements, disagreements, and research gaps.
- Cross-book synthesis is fed into outline generation.
- Per-subsection source retrieval selects relevant indexed evidence for writing.
- Generated lesson records retain the evidence items used for that subsection.
- Source-grounding prompt rules prohibit fabricated studies, statistics, quotations, named real-world cases, citations, URLs, and reference metadata.
- Expert quotes are allowed only when retrieved evidence contains a verified quote.
- References are generated deterministically from verified project sources only.
- Further Reading can only select from verified project sources.
- AI-invented competitor metadata fallback removed; fallback is now Open Library.
- Reference-overlap safety scan checks the manuscript against indexed short quotations and distinctive phrase fingerprints before export.
- Automated unit tests added for evidence retrieval, source-list verification, and phrase-overlap detection.
- GitHub verification workflow added for tests, typecheck, and production build.

## Architecture decisions

1. Keep the project personal and browser-centered instead of adding SaaS infrastructure.
2. Use Gemini native PDF understanding rather than adding a local PDF parser dependency.
3. Store compact research intelligence instead of raw uploaded PDF bytes in localStorage.
4. Use deterministic/verified source metadata for References; never ask an LLM to invent bibliography entries.
5. Use AI for cross-book synthesis and ranking, but validate source IDs against an explicit whitelist.
6. Treat phrase-overlap detection as a focused safety signal, not a full plagiarism database.

## Verification status

Pending automated branch verification. The phase is not considered fully verified until the GitHub workflow completes successfully.

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

Phase 02 — Manuscript Evidence Review & KDP QA:
- evidence/claim review at chapter and whole-manuscript level,
- stronger unsupported-claim detection,
- per-section source inspector UI,
- KDP preflight checks for metadata/manuscript consistency,
- optional EPUB export if desired.
