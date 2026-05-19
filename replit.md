# Nonfiction AI Studio

An AI-guided, multi-step book builder that takes a raw idea and turns it into a structured, publication-ready nonfiction manuscript.

## Run & Operate

- `pnpm --filter @workspace/nonfiction-studio run dev` — run the frontend (port 21617)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- Required secrets: `GEMINI_API_KEY`, `GROQ_API_KEY`, `HF_API_KEY` — all three are optional individually; the router falls back through providers automatically. `RAINFOREST_API_KEY` is optional — disables Amazon search if absent.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (Tailwind v4), wouter for routing
- API: Express 5 (esbuild bundle)
- No database — all state stored in `localStorage` (personal mode, no auth)
- AI: Multi-provider router — Gemini (primary) → Groq (fast fallback) → HuggingFace (final backup)
- PDF export: `pdf-lib`
- Amazon competitive research: Rainforest API

## Where things live

- `artifacts/nonfiction-studio/src/pages/HomePage.jsx` — landing page
- `artifacts/nonfiction-studio/src/pages/DashboardPage.jsx` — 13-step book builder shell
- `artifacts/nonfiction-studio/src/components/` — one file per step (ResearchStep, AnalysisStep, BookTitleStep, …)
- `artifacts/nonfiction-studio/src/lib/` — shared client utilities (niche registry, constants, pdf helpers, etc.)
- `artifacts/api-server/src/routes/ai/aiRouter.ts` — **multi-provider AI router** (Gemini/Groq/HuggingFace with fallback chain)
- `artifacts/api-server/src/routes/ai/index.ts` — all AI endpoints (uses aiRouter)
- `artifacts/api-server/src/routes/ai/prompts.ts` — all prompt builders
- `artifacts/api-server/src/routes/analysis/index.ts` — Rainforest/Amazon endpoints
- `artifacts/api-server/src/routes/export/index.ts` — PDF generation
- `artifacts/api-server/src/routes/book/index.ts` — contextual book title endpoint
- `artifacts/nonfiction-studio/src/index.css` — Tailwind v4 theme with studio-* color palette

## Architecture decisions

- All AI calls go through the Express api-server — no AI calls from the browser
- AI routing: long-form content (outlines, lessons, chapters) uses Gemini first; fast/short generation (titles, improvement) uses Groq first
- The platform routes `/api/*` (port 8080) and `/*` (port 21617) via path-based artifact routing; no Vite proxy needed
- JSX component files use `.jsx` extension; Vite `resolve.extensions` is set to try `.jsx` after `.js` so bare `@/lib/...` imports resolve without explicit extensions
- localStorage is the only persistence layer — no auth, no DB, intentionally personal/local
- Tailwind v4 `@theme` block defines custom `studio-*` colors and shadows; fonts loaded from Google Fonts in `index.html`

## AI Provider Reference

| Provider | Env Var | Use Case | Fallback Order |
|---|---|---|---|
| Google Gemini | `GEMINI_API_KEY` | Long-form (outlines, lessons) | 1st for long-form, 2nd for fast |
| Groq (Llama 3.1 70B) | `GROQ_API_KEY` | Fast/short generation | 1st for fast, 2nd for long-form |
| HuggingFace (Mistral 7B) | `HF_API_KEY` | Final backup for all | 3rd / last resort |

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
- AI provider errors are surfaced directly; if all three providers fail the response includes each provider's specific error
- RAINFOREST_API_KEY is optional — the app shows a friendly message and disables live search if missing
- The Vite dev server does NOT proxy `/api` to port 8080 in local dev — the Replit platform handles path routing in preview mode

## User preferences

- Personal mode only (no auth required)
- Migrated from Next.js/Vercel to Replit pnpm monorepo (react-vite + Express)
