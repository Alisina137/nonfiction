# Phase 05 — Release Validation & Publishing Operations

## Objective

Turn the Phase 04 production outputs into a deliberate release workflow: visually inspect the exact paperback, strengthen Kindle/EPUB accessibility checks, compare production versions, choose practical formal citation templates, freeze a reviewed release, and hand off KDP metadata without automating the author's final Amazon decisions or uploads.

## Release workflow

1. Finish the manuscript, cover, listing metadata, and optional front matter.
2. Run **Final Production Check** to render the exact paperback and validate current production geometry.
3. Sync the exact page count to Cover Studio and export the current flattened print cover.
4. Open the final paperback PDF preview from Finish and complete the required visual-review checklist.
5. Review EPUB accessibility/Kindle checks and validate the downloaded EPUB in Kindle Previewer.
6. Choose the citation template required by the book, if any.
7. Create a **Final Publication Archive**.
8. Review the KDP metadata handoff and compare the latest archive with the previous release snapshot when revising an existing release.
9. Freeze the reviewed publication. The project becomes read-only except for wizard navigation until it is explicitly unfrozen.
10. Enter/upload the final files and metadata in KDP manually. The app does not publish to Amazon.

## Implemented outcomes

### Final paperback visual review

- Finish can render the current exact interior PDF and open it in a browser tab for page-by-page inspection.
- The project stores a manual paperback review checklist for opening the final preview, trim/margin inspection, chapter/page-break inspection, headers/page numbers, blank/front-matter pages, cover/spine consistency, and optional physical proof review.
- Required visual-review items must be complete before publication freeze is allowed.
- KDP Print Previewer and a physical proof remain external validation steps.

### EPUB / Kindle accessibility hardening

- Generated EPUB XHTML declares LTR/RTL reading direction from book language.
- Chapter/text XHTML references the shared stylesheet with the correct relative path.
- EPUB package metadata declares textual access mode, sufficient textual access, structural navigation, no known hazards, and an accessibility summary.
- Navigation includes both the EPUB 3 table of contents and a body-matter landmark.
- Internal checks validate navigation coverage and flag meaningful-image alternative-text review when applicable.
- Kindle Previewer remains a required manual review item.

### Formal citation templates

Verified used-source citations now support no in-manuscript markers, APA 7 practical author-year formatting, Chicago author-date practical formatting, and IEEE-style numbered formatting.

Citation markers are still inserted only into the export clone and only for claim-like sentences that already have retained matching evidence. The saved manuscript is not silently rewritten.

### Production archive comparison

Saved production snapshots retain exact page count, trim, citation style, production status, EPUB status, cover design hash, and SHA-256 production fingerprint. Finish shows changes between the latest archive and the previous saved production snapshot.

This is a release-metadata/fingerprint comparison, not a rendered pixel-by-pixel PDF diff.

### Publication freeze / unfreeze

- A project can be frozen only when a final publication archive exists, Final Production Check has run in the current session, there are no blocking production checks, and all required paperback visual-review items are complete.
- The freeze record stores the reviewed archive ID, production fingerprint, exact page count, trim, citation style, and preview checklist.
- Freeze protection is enforced at the central builder state boundary, not only by hiding buttons.
- A frozen project can be browsed read-only across wizard steps.
- Reset/content/layout/cover/release-setting mutations are rejected until the user explicitly unfreezes.
- Unfreezing preserves freeze history and allows a new revision → production check → archive → freeze cycle.

### Project-scoped release settings

The book now persists citation style, export/layout settings, optional front matter, and the paperback preview checklist. These settings become read-only under publication freeze so reopening Finish cannot silently produce a different release configuration.

### KDP metadata handoff

- Finish builds copy-ready KDP handoff data containing title/subtitle/author/language, description, keywords, stored category values, paperback trim and exact page count, production status, EPUB/citation status, and file guidance.
- The handoff can be copied as plain text or downloaded as JSON.
- The Final Publication Archive includes `metadata/kdp-handoff.json` and `listing/kdp-copy-paste.txt`.
- The app deliberately does not sign into KDP, submit metadata, upload files, click publish, or make publication decisions for the author.

### Stronger release fingerprint

Phase 05 archive fingerprints include normalized export/layout settings, optional front matter, citation style through publication metadata, manuscript/outline content, and final-cover export metadata. This makes the archive fingerprint a more faithful identity for the reviewed release than the Phase 04 baseline.

## Verification

Phase 05 adds regression coverage for archive comparison, preview checklist freeze gating, freeze records, KDP metadata handoff, APA/Chicago/IEEE citation formatting, EPUB accessibility profiles, RTL direction, and navigation mismatch handling.

GitHub Actions **Verify phase** run #40 completed successfully on the Phase 05 pull request. The workflow ran dependency installation, repository tests, full TypeScript validation, and the production build.

## Intentional boundaries

- No direct KDP publishing automation.
- No hosted release-signing service or multi-user approval system.
- No claim that internal PDF/EPUB checks replace KDP Print Previewer, Kindle Previewer, EPUBCheck, or physical proof review.
- Citation templates are practical publishing templates, not a complete CSL/citation-style engine.
- Archive comparison is deterministic metadata/fingerprint comparison rather than binary or visual page-image diff.
