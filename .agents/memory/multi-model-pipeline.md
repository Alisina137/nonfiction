---
name: Multi-Model AI Pipeline
description: 6-phase task-aware model routing; confirmed working models as of June 2026; reasoning model quirks.
---

## The rule
Each book-creation phase uses the model best suited for that task type — NOT a one-size-fits-all fallback chain.

## Confirmed Working Models (live-tested June 2026)

### Cerebras (api.cerebras.ai)
- **Primary**: `gpt-oss-120b` ✅
- **Fallback**: `zai-glm-4.7` ✅
- **Dead**: `llama3.3-70b`, `llama3.1-8b` → 404 "Model does not exist"
- **Critical**: Both are reasoning models. They return BOTH `content` AND `reasoning` fields. `callOpenAICompat` must use `msg?.content || msg?.reasoning` — NOT just `msg?.content`. With sufficient tokens, `content` is populated; with tight budgets only `reasoning` may appear.

### OpenRouter free models (openrouter.ai)
- `nvidia/nemotron-3-super-120b-a12b:free` ✅ (may include chain-of-thought in content field)
- `openai/gpt-oss-120b:free` ✅
- `google/gemma-4-31b-it:free` ✅
- `meta-llama/llama-3.3-70b-instruct:free` ⚠️ transient 429 (works with retry)
- **Dead**: `google/gemma-3-27b-it:free`, `mistralai/mistral-7b-instruct:free`, `deepseek/deepseek-r1:free`, `qwen/qwen3-30b-a3b:free`, `meta-llama/llama-4-scout:free`

## Architecture

### Data structures (aiRouter.ts)
- `TaskType` = `"idea" | "research" | "outline" | "write" | "edit" | "metadata"`
- `TASK_CHAINS: Record<TaskType, ModelSpec[]>` — ordered provider+model specs per phase
- `ModelSpec` = `{ providerId, model, label, fallbackModels? }`
- `callProvider(provider, prompt, system, maxTokens, modelOverride?, fallbackModelsOverride?)` — builds `effectiveProvider` internally; returns `{ text, modelUsed }`
- `callGemini(prompt, system, maxTokens, model)` — model param enables Pro/Flash/Flash-Lite from one key
- `runChain` — when `opts.taskType` is set, builds chain from `TASK_CHAINS[taskType]`; otherwise uses default PROVIDERS order

### Routing (index.ts)
- `CONTENT_TYPE_TO_TASK: Record<string, TaskType>` maps every content type string to a task phase
- `runLong` / `runShort` auto-derive `taskType` from `contentType` and inject into opts

### Phase chains (current)
| Phase | Primary | Fallback order |
|---|---|---|
| idea | Gemini Flash | Groq → OR Gemma4 → Cerebras → SambaNova |
| research | OR Nemotron Super | Gemini Pro → Groq → Cerebras → SambaNova |
| outline | Gemini Pro | OR Nemotron Super → Groq → Cerebras → SambaNova |
| write | Gemini Pro | OR Nemotron Super → SambaNova → Cerebras → Groq |
| edit | Gemini Pro | OR Nemotron Super → Groq → Cerebras → SambaNova |
| metadata | Gemini Flash-Lite | Groq → OR Gemma4 → Cerebras → SambaNova |

### Token limits (TOKEN_LIMITS in aiRouter.ts)
- `outline: 3000` — niche-outline needs 2500+ tokens for 10 chapters with scores
- `sectionGen: 1800` — 5-section responses with objectives need the room
- Others have NOT been audited for truncation — check if new routes produce short/truncated output

## Why
A single model chain is a bottleneck. Routing by task phase routes each call to its optimal model while keeping the same full fallback safety net.

## How to apply
- Add new route: choose the closest TaskType; add the content type string to `CONTENT_TYPE_TO_TASK`; use `runLong`/`runShort` — task routing is automatic.
- Add new model to a phase: edit `ModelSpec[]` in `TASK_CHAINS` for that phase.
- Before adding an OpenRouter free model, verify it via `GET /models` or a direct test — free-tier availability changes frequently.
- When debugging a "empty response" error from Cerebras: check if the model only returned `reasoning` (no `content`) — increase `max_tokens` or rely on the `msg?.reasoning` fallback.
