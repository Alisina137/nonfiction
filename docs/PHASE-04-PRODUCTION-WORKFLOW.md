# Phase 04 — Final Production Workflow

Phase 04 turns an approved manuscript and cover design into final production files. The sequence matters because paperback spine geometry depends on the **actual rendered interior page count**, not the earlier word-count estimate.

## Recommended sequence

```text
1. Finish manuscript + front matter
        ↓
2. Choose final manuscript layout
        ↓
3. Run Final Production Check
        ↓
4. Review exact page count + blocking/review checks
        ↓
5. Sync exact page count to Cover Studio
        ↓
6. Review Full Cover with final spine width
        ↓
7. Export Final Print Cover PDF
        ↓
8. Return to Finish and re-run Final Production Check
        ↓
9. Download interior PDF + EPUB + editable DOCX
        ↓
10. Download Final Publication Archive
        ↓
11. Validate EPUB in Kindle Previewer
        ↓
12. Validate paperback interior + cover in KDP Print Previewer
        ↓
13. Inspect proof copy when possible
        ↓
14. Upload/publish in KDP
```

## Final Production Check

The check renders the real paperback interior and therefore resolves the exact page count. It validates:

- final page count,
- selected trim size,
- KDP inside/outside/top/bottom margins,
- cover/interior trim consistency,
- Cover Studio page-count synchronization,
- final spine width,
- spine-text eligibility,
- final selected cover concept,
- back-cover copy,
- barcode policy,
- final cover export freshness,
- paragraph/heading pagination protections,
- EPUB structure.

A **block** should be corrected before final files are treated as production-ready. A **review** indicates an author/manual-preview decision rather than an automatically provable failure.

## Paperback interior

The PDF renderer uses current KDP minimum inside-margin thresholds for automatic KDP margins and will automatically render again if the exact page count crosses a gutter threshold that the preliminary estimate missed.

The renderer also protects section/subsection headings from being stranded at page bottoms and avoids starting a multi-line paragraph/list block when only one line remains.

These checks reduce layout defects but do not replace KDP Print Previewer.

## Print cover

Print-cover export is intentionally available only after the exact page count from Final Production Check has been synchronized into Cover Studio.

The exporter:

1. switches to Full Cover,
2. renders the current cover artwork,
3. removes design guides from the export,
4. rasterizes at the exact 300-DPI wrap dimensions,
5. sends the raster to the API,
6. validates the effective DPI/pixel size,
7. creates one flattened exact-size PDF page containing back + spine + front.

Only export metadata is persisted. The large PDF/image is downloaded directly and is not stored in browser project state.

If the author changes the cover design afterward, the stored final-cover export metadata is invalidated.

## EPUB

The generated EPUB 3 contains the manuscript reading order, navigation, package metadata, CSS, title page, front matter, chapters, back matter, and author page when available.

Internal validation catches missing core structure, but Kindle Previewer remains the required manual verification step before KDP upload.

## Final Publication Archive

The archive is a reproducible production snapshot. It includes:

- interior PDF,
- DOCX,
- EPUB,
- publishing metadata,
- evidence and publication QA reports,
- final production report,
- EPUB validation report,
- KDP upload checklist,
- listing copy,
- print-cover export metadata,
- archive manifest.

The archive manifest includes an ID and SHA-256 production fingerprint. Each downloaded archive is recorded in project state so prior production snapshots can be distinguished from the newest one.

## Important limitation

The final flattened print-cover PDF is downloaded separately from Cover Studio. It is not embedded into the archive because the current personal-use architecture intentionally avoids persisting large binary cover files in browser project state. The archive contains the exact cover-export metadata used for traceability.
