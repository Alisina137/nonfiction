---
name: Multi-Model AI Pipeline
description: 6-phase task-aware model routing; transformation engine architecture; confirmed working models as of June 2026.
---

## Confirmed Working Models (live-tested June 2026)

### Cerebras (api.cerebras.ai)
- **Primary**: `gpt-oss-120b` ✅
- **Fallback**: `zai-glm-4.7` ✅
- **Dead**: `llama3.3-70b`, `llama3.1-8b` → 404 "Model does not exist"
- **Critical**: Both are reasoning models. They return BOTH `content` AND `reasoning` fields. `callOpenAICompat` must use `msg?.content || msg?.reasoning` — NOT just `msg?.content`.

### OpenRouter free models (openrouter.ai)
- `nvidia/nemotron-3-super-120b-a12b:free` ✅
- `openai/gpt-oss-120b:free` ✅
- `google/gemma-4-31b-it:free` ✅
- `meta-llama/llama-3.3-70b-instruct:free` ⚠️ transient 429
- **Dead**: `google/gemma-3-27b-it:free`, `mistralai/mistral-7b-instruct:free`, `deepseek/deepseek-r1:free`, `qwen/qwen3-30b-a3b:free`, `meta-llama/llama-4-scout:free`

## Outline Generation — Transformation Engine Architecture

### The pipeline (since June 2026 redesign)
`/api/ai/niche-outline` now runs a **2-phase pipeline** when the user has completed the Proposed Book step:

**Phase 1 — Transformation Plan** (`runShort`, token budget `transformationPlan: 1200`):
- Input: `bookFlowPreview.parts` (from `proposedBook.content.bookFlowPreview.parts`) + full book profile
- Output: `{ parts: [{ partIndex, partSubtitle, partObjective, readerStartsAs, readerEndsAs, milestone, transitionToNext, chapterCount, chapterSlots: [{beforeState, action, afterState}] }] }`
- Internal only — NOT sent to the frontend
- Triggered only when `bookFlowParts.length >= 2`
- If it fails, gracefully falls back to Phase 2 without a plan

**Phase 2 — Chapter Generation** (`runLong`, token budget `outline: 3000`):
- Input: everything + the transformation plan (when available)
- Prompt now includes: TRANSFORMATION BLUEPRINT section (Part-anchored sequential states), PROGRESSION VOCABULARY (early/middle/late title language), PLACEMENT VALIDATION (self-review before output)
- Output: standard `{ chapters: [...] }` + `arcRole` per chapter (e.g., "Part 2 — Build Foundation")

**Rescue** (unchanged): compact focused prompt if Phase 2 truncates

### Frontend change
`OutlineStep.jsx` now passes `proposedBook: fullProject?.proposedBook` in the `/api/ai/niche-outline` body.
- Fallback: `proposedBook: null` when user hasn't completed Proposed Book step → Phase 1 skipped → Phase 2 runs with existing context only

### Book Flow structure
`proposedBook.content.bookFlowPreview.parts` = `[{ title: "Part 1", subtitle: "Understand" }, ...]` (3–6 parts, generated at Proposed Book step)

## Task Chain Architecture

### Data structures (aiRouter.ts)
- `TaskType` = `"idea" | "research" | "outline" | "write" | "edit" | "metadata"`
- `TASK_CHAINS: Record<TaskType, ModelSpec[]>` — ordered provider+model specs per phase
- `ModelSpec` = `{ providerId, model, label, fallbackModels? }`

### Phase chains (current)
| Phase | Primary | Fallback order |
|---|---|---|
| idea | Gemini Flash | Groq → OR Gemma4 → Cerebras → SambaNova |
| research | OR Nemotron Super | Gemini Pro → Groq → Cerebras → SambaNova |
| outline | Gemini Pro | OR Nemotron Super → Groq → Cerebras → SambaNova |
| write | Gemini Pro | OR Nemotron Super → SambaNova → Cerebras → Groq |
| edit | Gemini Pro | OR Nemotron Super → Groq → Cerebras → SambaNova |
| metadata | Gemini Flash-Lite | Groq → OR Gemma4 → Cerebras → SambaNova |

### Token limits (key ones)
- `outline: 3000` — needs room for 15 chapters + architecture notes
- `transformationPlan: 1200` — JSON plan for all parts + chapter slots
- `sectionGen: 1800` — section objects with objectives

## Why
Parts (from Book Flow) = Acts; Chapters = Scenes. Adaptive chapter distribution per Part (not even). Each chapter inherits the previous chapter's ending reader state. Late chapters must never regress to introductory vocabulary.
