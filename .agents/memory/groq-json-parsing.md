---
name: Groq/Llama JSON parsing bug
description: Groq and other non-Gemini providers emit literal newlines inside JSON strings, breaking JSON.parse and causing 500 on all lesson/content routes
---

**The rule:** `extractJSON` must sanitize literal `\n`/`\r`/`\t` characters inside JSON string values before any parse attempt.

**Why:** Groq (llama-3.3-70b-versatile) and similar models often emit multi-paragraph prose directly inside JSON string values with real newlines, which is invalid JSON. `JSON.parse` rejects it, `extractJSON` throws, the Express route catch-block fires `aiErrorResponse`, and the client gets a 500. This made lesson generation completely broken for every provider except Gemini.

**How to apply:** The fix lives in `sanitizeJsonNewlines()` in `aiRouter.ts`, called as step 2 inside `extractJSON` before `repairTruncatedJSON`. Any new route that calls `extractJSON` inherits the fix automatically. If adding a new AI provider, assume it may emit literal newlines too.
