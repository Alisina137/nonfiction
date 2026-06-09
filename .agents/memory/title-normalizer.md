---
name: Title Normalizer System
description: How the title normalization/validation/retry/fallback pipeline works and what token limits are required.
---

# Title Normalizer System

## The rule
`TOKEN_LIMITS.title` must be at least **1500**. At 500 or even 900, Gemini 2.5 Flash truncates the JSON response mid-object because it first outputs a verbose market analysis preamble, then the JSON. At 1500 the full 3-object response fits reliably.

**Why:** The `kdpSuggestPrompt` (used by `/api/book/contextual-titles` with `mode=kdp-positioning`) has a multi-step market analysis section that Gemini executes verbatim before writing JSON output. Combined with verbose reason fields, the output consistently exceeds 800-900 tokens.

## The normalizer (`titleNormalizer.ts`)
- `TitleItem = { title: string, angle: string, reason: string }`
- `normalizeTitlesFromText(rawText, ctx)` — parses any AI output shape into `TitleItem[]`
  - Handles: plain strings, objects with alias fields (hook→reason, subtitle→reason, text→title, etc.)
  - Minimum title length guard: 8 chars (prevents fragment strings like "The" from being accepted)
  - Pads to exactly 3 with context-aware fallback templates if AI returned fewer
- `validateTitleItems(items)` — returns `{ valid, errors }`; requires array length=3 and non-empty title+angle per item
- `runTitlePipeline(rawText, ctx)` — normalize → validate in one call
- `logTitlePipeline(payload)` — logs provider, model, raw response (300 chars), normalized titles, validation result

## How to apply
- Import `runTitlePipeline`, `logTitlePipeline`, `TitleContext` from `titleNormalizer.js`
- After every AI call: `const pipeline = runTitlePipeline(text, ctx)`; log it; if `!pipeline.valid` retry once
- Always return `pipeline.titles` to the frontend — never raw AI text

## Prompt format
`titlesPrompt` now requests compact single-line JSON (no code fences, no markdown). The model is told to start response with `{` and end with `}`. This prevents code-fence wrapping that can break `extractJSON` when truncated.

## Routes covered
- `POST /api/ai/titles` — normalizer + retry + logging
- `POST /api/book/contextual-titles` (all 3 modes: kdp-positioning, named, default)
- `POST /api/ai/suggest-subtitles` — retry once on empty result; TOKEN_LIMITS.subtitle = 1200

## Research state bugs (fixed)
- `applyTitle()` in ResearchStep.jsx now auto-derives `bookTopic` from the title's `reason` field (≥40 chars) or constructs "title: practical guide for niche" — only when `bookTopic` is currently empty.
- `stanceOnTopic` is only written by `applyTitle()` when it is currently empty (prevents silent overwrite on repeated title clicks).
- AnalysisStep.jsx writes `research.bookTopic` from `intelligence.transformationPromise` after `generateIntelligence()` if topic is still empty; and auto-applies `posResult.topicOptions[0].topic` after `finalizePositioning()` if topic is still empty.
