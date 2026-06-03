---
name: Book Cover System Architecture
description: How the 5-concept book cover system works — source of truth, renderers, SVG builders, API route, and color conventions.
---

## Architecture

`buildCoverData(conceptArg, cover, title)` is the single source of truth. Both React preview renderers and SVG export builders consume this object — never read from `bookCover` state directly inside a renderer.

## 5 Concept Types (fixed IDs)
- `authority` — Business Bestseller: dark bg, heavy Impact font, full-width accent band at 62%
- `premium` — Premium Authority: light bg (uses `secondary` field), Georgia serif, thin rules centered
- `minimal` — Modern Minimalist: solid color bg, large concentric circles upper-right, Arial Black title
- `metaphor` — Visual Metaphor: gradient bg (bg→secondary), concentric diamond shapes (diamondPts helper)
- `dynamic` — Creative AI Concept: dark bg, skewed diagonal accent band top, Impact title below

## Color Convention
- `bg` = primary background (all concepts)
- `accent` = accent/structural color (band, rules, shapes)
- `text` = text color
- `secondary` = CRITICAL: for `premium` this is the LIGHT BACKGROUND color (cream). For other concepts it's a darker complement.

## SVG Export
- Dimensions: SW=1600, SH=2560 (5:8 ratio)
- `buildConceptSVG(cd)` dispatches to the right builder
- PNG export: SVG → Image → Canvas → Blob (no extra deps)
- `wrapText(text, fontSize, maxWidth)` for text layout

## API
- Route: `POST /api/ai/cover-concepts` → calls `coverConceptsPrompt`
- Token limit key: `conceptGen` (2000 tokens)
- AI returns array of 5 concept objects; always merged with CONCEPT_DEFAULTS by type to fill gaps

## DashboardPage State
- `emptyBookCover` includes: `concepts: null`, `selectedConceptIndex: 0`, all back cover fields
- `validateBookCover` checks `subtitle`, `authorLine`, `primaryColor` — `selectConcept()` always syncs primaryColor/accentColor/textColor

**Why:** Preview/export parity was the core constraint — having a single buildCoverData() object prevents drift between what the user sees and what exports.
