# Nonfiction AI Studio

An AI-powered nonfiction book writing and publishing platform for Amazon KDP.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 3000)
- `pnpm --filter @workspace/nonfiction-studio run dev` — run the frontend (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Required Secrets

Set all of these in Replit Secrets (or `.env` for local dev). See `.env.example` for the full list.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (auto-provisioned on Replit) |
| `GEMINI_API_KEY` | At least 1 AI key | Gemini 2.5 Flash — primary AI provider |
| `GROQ_API_KEY` | At least 1 AI key | Groq Llama 3.3 70B — AI fallback #2 |
| `XAI_API_KEY` | At least 1 AI key | xAI / Grok — AI fallback #3 |
| `OPENROUTER_API_KEY` | At least 1 AI key | OpenRouter free tier — AI last resort |
| `RAINFOREST_API_KEY` | At least 1 Amazon key | Rainforest API — primary Amazon data |
| `SCALE_SERP_API_KEY` | At least 1 Amazon key | Scale SERP — Amazon data fallback |

The API server validates all variables on startup and will print a clear error if anything required is missing.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 3000)
- Frontend: React 19 + Vite (port 5000)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- AI: Gemini → Groq → xAI → OpenRouter (auto-fallback chain)

## Where things live

- `artifacts/api-server/src/routes/ai/` — all AI generation routes and prompts
- `artifacts/api-server/src/routes/ai/prompts.ts` — every AI prompt (source of truth)
- `artifacts/api-server/src/routes/ai/aiRouter.ts` — multi-provider AI chain logic
- `artifacts/api-server/src/lib/rainforest.ts` — Rainforest Amazon API client
- `artifacts/api-server/src/lib/scaleSerpProvider.ts` — Scale SERP Amazon client
- `artifacts/nonfiction-studio/src/components/` — all React UI components
- `lib/db/src/schema/` — Drizzle DB schema (source of truth)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `.env.example` — canonical list of all required environment variables

## Architecture decisions

- **Multi-provider AI chain**: Gemini → Groq → xAI → OpenRouter. Each provider is independently disabled for 10min/60min/24h on rate-limit/hard/quota errors. This maximises uptime on free-tier keys.
- **Dual Amazon provider**: Rainforest (primary) → Scale SERP (fallback). If Rainforest key is absent or returns an error, Scale SERP is tried automatically.
- **All prompts in source control**: Every AI prompt lives in `prompts.ts` — none are stored in the database or generated dynamically outside Git.
- **Env-validated at startup**: `validateEnv()` runs before `app.listen()` and will exit with a clear error message if `DATABASE_URL` is missing.

## Gotchas

- The API server runs on **port 3000**, not 5000. The frontend proxy (`/api/*`) forwards to `http://localhost:3000`.
- At least one AI key AND at least one Amazon key are needed for full functionality. The app boots without them but those features will fail.
- `pnpm --filter @workspace/db run push` must be run after any schema change in `lib/db/src/schema/`.
- After cloning to a new Replit account: add Secrets, then the app will work identically to the original.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._
