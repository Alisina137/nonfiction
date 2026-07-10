---
name: Groq/Llama JSON parsing bug
description: Groq and other non-Gemini providers emit literal newlines inside JSON strings, breaking JSON.parse and causing 500 on all lesson/content routes
---

**The rule:** `extractJSON` must sanitize literal `\n`/`\r`/`\t` characters inside JSON string values before any parse attempt.

**Why:** Groq (llama-3.3-70b-versatile) and similar models often emit multi-paragraph prose directly inside JSON string values with real newlines, which is invalid JSON. `JSON.parse` rejects it, `extractJSON` throws, the Express route catch-block fires `aiErrorResponse`, and the client gets a 500. This made lesson generation completely broken for every provider except Gemini.

**How to apply:** The fix lives in `sanitizeJsonNewlines()` in `aiRouter.ts`, called as step 2 inside `extractJSON` before `repairTruncatedJSON`. Any new route that calls `extractJSON` inherits the fix automatically. If adding a new AI provider, assume it may emit literal newlines too.

**Residual flakiness:** Even with sanitize+repair, a small fraction of responses still fail to parse (e.g. a provider stops generation mid-string with no closing quote/brace, or ignores the "return only JSON" instruction entirely and writes full markdown prose/essay instead). This caused intermittent 500s on `back-matter/appendix-entry`, `back-matter/key-lessons`, `back-matter/glossary`, and `back-matter/the-end` — the "Generate" button in Write Step > Back Matter would silently fail with a generic error and no entry created. A single retry was not always enough (2 consecutive failures observed on `the-end`).

**How to apply:** Any route whose success depends on `extractJSON` succeeding should use `runLongJSON()` (in `artifacts/api-server/src/routes/ai/index.ts`) instead of raw `runLong` + `extractJSON`. Additionally, prompts prone to this (especially ones asking for short structured fields after a lot of creative framing) should explicitly forbid prose/markdown-essay output in all-caps "CRITICAL OUTPUT FORMAT" rules, not just say "return JSON" once — models drift into essay mode more often on emotionally-toned prompts (e.g. closing/thank-you messages, acknowledgments) than on neutral data-extraction ones.

**Stronger fix (superseded the simple 3-retry approach):** `runLongJSON` now takes maxAttempts=4 and an optional `repairFromText(raw)` callback. On each failed attempt it re-sends the *original prompt plus the model's bad raw response quoted back to it* with an explicit "this was not valid JSON" correction — this measurably increases JSON compliance on the retry vs. just re-sending the same prompt unchanged. For single-field endpoints (e.g. one paragraph of text), skip strict JSON entirely: try `extractJSON`, and if it fails, fall back to using the raw prose directly (stripped of intro phrases/quotes/markdown wrappers) — the content itself was usually fine, only the JSON envelope was missing. For array-shaped endpoints (Key Lessons, Glossary) that can't just use raw prose, pass a regex-based `repairFromText` that reconstructs structured items from markdown patterns (headings/bold titles + body, or "**Term** – definition" lines) as a last-resort recovery before giving up.

**Gotcha:** the api-server workflow runs `pnpm run build && pnpm run start` — editing `index.ts` does NOT hot-reload. You must restart the `artifacts/api-server: API Server` workflow (or wait for its own restart) before a fix to any AI route takes effect; otherwise you'll keep seeing the old stack trace/behavior in logs even though the source file is already correct.
