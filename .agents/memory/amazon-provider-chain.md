---
name: Amazon Book Search Provider Chain
description: Priority chain for amazon-search endpoint; Rainforest is suspended; Scale SERP is the active primary source.
---

## Provider priority (analysis/index.ts)
1. **Rainforest** — `RAINFOREST_API_KEY` set but account suspended (free trial 402). Will activate when account upgraded.
2. **Scale SERP** — `SCALE_SERP_API_KEY` active, ~80 credits remaining. Currently the working live source.
3. **AI research** — Gemini/Groq fallback, returns 15 AI-generated books, `maxTokens: 4000`.
4. **Open Library** — last resort, no API key required.

## Scale SERP query strategy
- Query: `${query} books site:amazon.com/dp`  
- `site:amazon.com/dp` subdirectory restriction forces Google to return ONLY individual product pages — every result has an ASIN.
- Cover images: built from ASIN via `https://m.media-amazon.com/images/P/${asin}.01._SX300_.jpg`
- Returns 9–10 books per search with full covers.

**Why site:amazon.com/dp:** `site:amazon.com` returns a mix of category/search pages (no ASINs, no covers); `/dp` subdirectory gives only product pages.

## Notice message logic
- If Rainforest key set but failed: says "account may be suspended" (not "Add key")
- If Scale SERP used successfully: no notice shown
- If neither key set: says "Add RAINFOREST_API_KEY or SCALE_SERP_API_KEY"

## Key files
- `artifacts/api-server/src/lib/rainforest.ts` — Rainforest service
- `artifacts/api-server/src/lib/scaleSerpProvider.ts` — Scale SERP service
- `artifacts/api-server/src/routes/analysis/index.ts` — orchestration with fallback chain
- `artifacts/nonfiction-studio/src/components/AnalysisStep.jsx` — frontend, `buildAmazonQuery()` builds short niche-based queries
