# Nonfiction AI Studio

An AI-guided, multi-step book builder that takes a raw idea and turns it into a structured, publication-ready nonfiction manuscript.

## Run & Operate

- `pnpm --filter @workspace/nonfiction-studio run dev` — run the frontend (port 21617)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- Required secrets: `OPENROUTER_API_KEY` — single key for all AI generation via OpenRouter. `RAINFOREST_API_KEY` is optional — disables Amazon search if absent.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (Tailwind v4), wouter for routing
- API: Express 5 (esbuild bundle)
- No database — all state stored in `localStorage` (personal mode, no auth)
- AI: OpenRouter multi-model router — GPT-4.1-mini → Claude 3.7 Sonnet → Gemini 2.5 Flash → Grok Mini (user-gated)
- PDF export: `pdf-lib`
- Amazon competitive research: Rainforest API

## Where things live

- `artifacts/nonfiction-studio/src/pages/HomePage.jsx` — landing page
- `artifacts/nonfiction-studio/src/pages/DashboardPage.jsx` — 13-step book builder shell
- `artifacts/nonfiction-studio/src/components/` — one file per step (ResearchStep, AnalysisStep, BookTitleStep, …)
- `artifacts/nonfiction-studio/src/lib/` — shared client utilities (niche registry, constants, pdf helpers, etc.)
- `artifacts/api-server/src/routes/ai/aiRouter.ts` — **OpenRouter AI router** (GPT-4.1-mini → Claude → Gemini Flash → Grok with retry/backoff/checkpoint)
- `artifacts/api-server/src/routes/ai/index.ts` — all AI endpoints (uses aiRouter)
- `artifacts/api-server/src/routes/ai/prompts.ts` — all prompt builders
- `artifacts/api-server/src/routes/analysis/index.ts` — Rainforest/Amazon endpoints
- `artifacts/api-server/src/routes/export/index.ts` — PDF generation
- `artifacts/api-server/src/routes/book/index.ts` — contextual book title endpoint
- `artifacts/nonfiction-studio/src/index.css` — Tailwind v4 theme with studio-* color palette

## Architecture decisions

- All AI calls go through the Express api-server — no AI calls from the browser
- AI routing: all calls go through OpenRouter (single API key). Long-form uses GPT-4.1-mini first; short-form uses Gemini 2.5 Flash first. Each model retries up to 2× with exponential backoff before falling back. Grok is gated behind a persistent user toggle (stored in localStorage)
- The platform routes `/api/*` (port 8080) and `/*` (port 21617) via path-based artifact routing; no Vite proxy needed
- JSX component files use `.jsx` extension; Vite `resolve.extensions` is set to try `.jsx` after `.js` so bare `@/lib/...` imports resolve without explicit extensions
- localStorage is the only persistence layer — no auth, no DB, intentionally personal/local
- Tailwind v4 `@theme` block defines custom `studio-*` colors and shadows; fonts loaded from Google Fonts in `index.html`

## AI Provider Reference

All providers go through **OpenRouter** (`OPENROUTER_API_KEY`) — one key, four models.

| Model | OpenRouter ID | Long-form order | Short-form order |
|---|---|---|---|
| GPT-4.1-mini | `openai/gpt-4.1-mini` | 1st | 2nd |
| Claude 3.7 Sonnet | `anthropic/claude-3.7-sonnet` | 2nd | 3rd |
| Gemini 2.5 Flash | `google/gemini-2.5-flash` | 3rd | 1st |
| Grok Mini | `x-ai/grok-3-mini-beta` | 4th (user-gated) | 4th (user-gated) |

- Long-form (lessons, descriptions, cover, architecture preview): GPT-4.1-mini → Claude → Gemini → Grok
- Short-form (titles, outlines, suggestions): Gemini → GPT-4.1-mini → Claude → Grok
- Each model: up to 2 retries with exponential backoff (300ms × 2^attempt)
- Grok checkpoint: verifies key + not temporarily disabled; auto-disables for 5 min on failure
- Grok gate: user enables via "Grok fallback" toggle in header (persisted in localStorage)

## Product

13-step guided book builder:
1. Research — niche/sub-niche selection, publishing goal, author name
2. Analysis — Amazon competitive search (Rainforest API), competitor book lookup
3. Book Title — AI-generated title suggestions based on niche + competitors
4. Resources — upload reference files and notes
5. Author Persona — tone, audience, writing style configuration
6. Proposed Book — AI-synthesized book concept from all research
7. Details — word count, chapter architecture, structural parameters
8. Author Bio — author background and credibility
9. Outline — AI niche-aware chapter/section/subsection outline
10. Write — AI lesson/section writer with improve/rewrite tools
11. Description — AI book description and back-cover copy
12. Book Cover — AI cover design brief with color and layout guidance
13. Finish — full manuscript PDF export

## Gotchas

- All component files are `.jsx` (not `.js`) — Vite requires explicit JSX extension
- Running `pnpm --filter @workspace/nonfiction-studio run build` directly requires `PORT` and `BASE_PATH` env vars to be set (e.g. `PORT=21617 BASE_PATH=/ pnpm ...`); Replit workflows set these automatically
- AI provider errors are surfaced directly; if all providers fail the response includes each model's specific error
- Old per-provider env vars (`GEMINI_API_KEY`, `GROQ_API_KEY`, `HF_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`) are no longer used — only `OPENROUTER_API_KEY` is required
- RAINFOREST_API_KEY is optional — the app shows a friendly message and disables live search if missing
- The Vite dev server does NOT proxy `/api` to port 8080 in local dev — the Replit platform handles path routing in preview mode

## User preferences

- Personal mode only (no auth required)
- Migrated from Next.js/Vercel to Replit pnpm monorepo (react-vite + Express)
