---
name: Blueprint Intelligence Engine
description: Architecture of the Blueprint step upgrade (Prompt 3 spec) — 5 layers, chapter missions, validation, scores, and Book DNA Synchronization.
---

## Rule
The Blueprint step (BookDetailsStep.jsx) generates 5 layers + transformationMap + chapterMissions + blueprintValidation + blueprintScores. All are stored in `bookDetails` and flow downstream via `buildBookContext()` / `buildBookDNAFromContext()`.

## Storage
All new Blueprint fields stored directly on `bookDetails` (not in a sub-object):
- `bookDetails.blueprintLayers` — { bookIdentity, readerModel, marketModel, bookStrategy, qualityTargets }
- `bookDetails.transformationMap` — array of { stage, description }
- `bookDetails.chapterMissions` — array of { chapterNumber, chapterTopic, purpose, expectedReaderAction, knowledgeGoal, practicalGoal }
- `bookDetails.blueprintValidation` — { checks: [{id, question, pass, note}], overallPass, refinementNeeded }
- `bookDetails.blueprintScores` — { readerUnderstanding, ... , blueprintConfidence }

## Book DNA Synchronization
`buildBookDNAFromContext()` in prompts.ts reads `ctx.blueprintXxx` fields (populated by bookContext.js) and injects a "Blueprint Intelligence" block into every DNA call. 18 blueprint fields flow from bookDetails → bookContext → every AI generation.

## Chapter Architecture
`chapterArchitecturePrompt` (prompts.ts ~line 5300) now injects chapter missions + Blueprint Identity layers directly into the chapter outline instructions.

**Why:** The spec requires Blueprint to be a "living strategic brain" that governs all downstream generation without changing any UI, APIs, or workflow.
