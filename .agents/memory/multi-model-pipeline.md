---
name: Multi-Model AI Pipeline
description: Architecture of the 6-phase task-aware model routing system in aiRouter.ts
---

## The rule
Each book-creation phase uses the model best suited for that task type — NOT a one-size-fits-all fallback chain.

## How it works

### Data structures (aiRouter.ts)
- `TaskType` = `"idea" | "research" | "outline" | "write" | "edit" | "metadata"`
- `TASK_CHAINS: Record<TaskType, ModelSpec[]>` — ordered provider+model specs per phase
- `ModelSpec` = `{ providerId, model, label, fallbackModels? }`
- `callProvider(provider, prompt, system, maxTokens, modelOverride?, fallbackModelsOverride?)` — accepts model overrides; builds an `effectiveProvider` internally; returns `{ text, modelUsed }`
- `callGemini(prompt, system, maxTokens, model = "gemini-2.5-flash")` — model param enables Gemini Pro, Flash-Lite, etc. from one key
- `runChain` — when `opts.taskType` is set, builds chain from `TASK_CHAINS[taskType]` (deduped by providerId, first occurrence wins); otherwise uses default PROVIDERS order

### Routing (index.ts)
- `CONTENT_TYPE_TO_TASK: Record<string, TaskType>` maps every content type string to a task phase
- `runLong` / `runShort` auto-derive `taskType` from `contentType` and inject it into opts — zero touch needed on individual route calls
- 4 routes that lacked content types were given explicit types: `analyze-book-concept → "analysis"`, `architecture-preview → "architecturePreview"`, `regenerate-title → "regenTitle"`, `extract-resource → taskType: "metadata" as const`

### Phase chains
| Phase | Primary model | Rationale |
|---|---|---|
| idea | Grok 4 (xAI) | Best creative ideation, marketable angles |
| research | DeepSeek R1 (OpenRouter) | Chain-of-thought reasoning for competitive analysis |
| outline | Gemini 2.5 Pro | Deep hierarchical structure + chapter planning |
| write | Gemini 2.5 Pro → Grok 4 → OpenRouter pool | 7-model pool (DeepSeek/Qwen/Maverick as OR fallbacks) |
| edit | Llama 4 Maverick (OpenRouter) | Natural, human-like writing improvement |
| metadata | Gemini Flash-Lite | Fast + cheap for short SEO/description tasks |

### Provider order (6 total)
`gemini(1) → grok(2) → groq(3) → cerebras(4) → openrouter(5) → sambanova(6)`

### New env var
`GROK_API_KEY` — xAI Grok 4 API key, endpoint `https://api.x.ai/v1/chat/completions`, models `grok-4` / `grok-3` fallback. Without this key, Grok is silently skipped; all other providers continue to work.

## Why
A single model chain is a bottleneck — no single free-tier model excels at both creative ideation AND analytical research AND long-form prose AND fast metadata. Routing by task phase routes each call to its optimal model while keeping the same full fallback safety net.

## How to apply
- Add new route: choose the closest TaskType; add the content type string to `CONTENT_TYPE_TO_TASK`; use `runLong`/`runShort` as normal — task routing is automatic.
- Add new model to a phase: edit the `ModelSpec[]` array in `TASK_CHAINS` for that phase; put it at the position where it should be tried.
- Add new provider: add it to the `PROVIDERS` array in `aiRouter.ts`; add it to `PROVIDER_DEFS` in `modelStatus.jsx`, `PROVIDER_LABELS` in `aiFetch.jsx`, `PROVIDER_COLOR`/`ACTIVE_LABELS` in `ProviderStatusBadge.jsx`; add its API key to `validateEnv.ts` + `.env.example`.
