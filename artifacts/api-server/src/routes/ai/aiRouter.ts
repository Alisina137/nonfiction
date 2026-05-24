// ═══════════════════════════════════════════════════════════════════════════
// OpenRouter AI Router
// ═══════════════════════════════════════════════════════════════════════════
//
// All generation goes through a single OpenRouter endpoint using an
// OpenAI-compatible request format.  Individual models are treated as
// "providers" so the rest of the codebase (routes, frontend) requires
// zero changes.
//
// FALLBACK ORDER
// ─────────────────────────────────────────────────────────────────────────
//   Long-form  (lessons, descriptions, cover briefs, …):
//     GPT-4.1-mini → Claude 3.7 Sonnet → Gemini 2.5 Flash → Grok Mini*
//
//   Short-form (titles, outlines, architecture preview, …):
//     Gemini 2.5 Flash → GPT-4.1-mini → Claude 3.7 Sonnet → Grok Mini*
//
//   * Grok requires explicit user approval (allowGrok: true).
//     If the chain reaches Grok without approval it throws
//     GrokApprovalRequiredError so the client can show the consent modal.
//
// GROK CHECKPOINT
// ─────────────────────────────────────────────────────────────────────────
//   Before attempting Grok we verify: API key exists, model is not
//   temporarily disabled, and that the previous attempt was not a
//   non-retriable error.  On failure Grok is disabled for
//   GROK_DISABLE_MS (5 min) and the chain continues.
//
// RETRY + BACKOFF
// ─────────────────────────────────────────────────────────────────────────
//   Each model attempt retries up to MAX_RETRIES (2) times with
//   exponential back-off (300 ms × 2^attempt) on retriable errors:
//   rate limits, 429, 503, overload, quota, timeout.
//
// ═══════════════════════════════════════════════════════════════════════════

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Stable friendly IDs used throughout the rest of the codebase and the
// frontend provider-status badge.  Each maps to an OpenRouter model slug.
const MODEL_BY_PROVIDER = {
  openai:    "openai/gpt-4.1-mini",
  anthropic: "anthropic/claude-3.7-sonnet",
  gemini:    "google/gemini-2.5-flash",
  xai:       "x-ai/grok-3-mini-beta"
} as const;

export type ProviderId = keyof typeof MODEL_BY_PROVIDER;

export interface GenOptions {
  /** User explicitly approved using Grok as a final fallback. */
  allowGrok?: boolean;
  /** Notified each time the chain advances past a provider. */
  onFallback?: (info: { from: ProviderId; to: ProviderId; reason: string }) => void;
  /** Notified with the provider that actually produced the result. */
  onSuccess?: (provider: ProviderId) => void;
}

// ─── Grok approval gate ───────────────────────────────────────────────────

export class GrokApprovalRequiredError extends Error {
  needsApproval = "grok" as const;
  attempted: Array<{ provider: ProviderId; error: string }>;
  constructor(attempted: Array<{ provider: ProviderId; error: string }>) {
    super("Grok approval required: primary providers are unavailable.");
    this.name = "GrokApprovalRequiredError";
    this.attempted = attempted;
  }
}

// ─── Temporary Grok disable flag ─────────────────────────────────────────
// If Grok fails with a non-retriable error we disable it for 5 minutes so
// the chain doesn't waste time on it for subsequent requests.

const GROK_DISABLE_MS = 5 * 60 * 1000;
let grokDisabledUntil = 0;

function isGrokDisabled(): boolean {
  return Date.now() < grokDisabledUntil;
}

function disableGrokTemporarily(reason: string) {
  grokDisabledUntil = Date.now() + GROK_DISABLE_MS;
  console.warn(`[AI] Grok checkpoint failed — disabled for 5 min. Reason: ${reason}`);
}

// ─── Error classification ─────────────────────────────────────────────────

/** Returns true for errors that are worth retrying (transient / rate limits). */
export function isLimitOrUnavailable(msg: string): boolean {
  return /rate.?limit|quota|daily.?limit|exceeded|insufficient|429|503|overload|unavailable|temporarily|timeout|timed.?out/i.test(
    msg || ""
  );
}

// ─── Core OpenRouter request ──────────────────────────────────────────────

const MAX_RETRIES = 2;

/**
 * POST one completion request to OpenRouter for a specific model.
 * Retries up to MAX_RETRIES times (exponential backoff) on retriable errors.
 */
async function callOpenRouter(
  provider: ProviderId,
  prompt: string,
  system: string | undefined,
  temperature = 0.7,
  maxTokens = 4096
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  const model = MODEL_BY_PROVIDER[provider];
  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false
  };

  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Exponential back-off on retries (skip delay on first attempt).
    if (attempt > 0) {
      const delay = 300 * Math.pow(2, attempt - 1);
      console.log(`[AI] Retry ${attempt}/${MAX_RETRIES} for ${model} in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }

    const startMs = Date.now();

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        // OpenRouter best-practice headers.
        "HTTP-Referer": "https://nonfiction-studio.replit.app",
        "X-Title": "Nonfiction AI Studio"
      },
      body: JSON.stringify(body)
    });

    // Read as text first — some error bodies are not valid JSON.
    const rawText = await res.text();
    let data: any = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { _raw: rawText };
    }

    const elapsed = Date.now() - startMs;

    if (!res.ok) {
      const detail: string =
        data?.error?.message ||
        (typeof data?.error === "string" ? data.error : "") ||
        data?._raw ||
        `HTTP ${res.status}`;

      lastError = detail;

      // Detailed diagnostic log.
      console.error("[AI] Request failed", {
        provider,
        model,
        endpoint: OPENROUTER_URL,
        status: res.status,
        statusText: res.statusText,
        retryCount: attempt,
        generationTimeMs: elapsed,
        errorMessage: detail.slice(0, 500)
      });

      // Retry only on transient / rate-limit errors.
      if (attempt < MAX_RETRIES && isLimitOrUnavailable(detail + ` ${res.status}`)) {
        continue;
      }
      throw new Error(`[${provider}] ${model} → ${detail}`);
    }

    const text: string = data?.choices?.[0]?.message?.content || "";

    if (!text) {
      lastError = "Empty response from model";
      console.error("[AI] Empty response", { provider, model, retryCount: attempt, data });
      if (attempt < MAX_RETRIES) continue;
      throw new Error(`[${provider}] ${model} returned empty response`);
    }

    console.log(`[AI] Generation successful — ${provider} (${model}) in ${elapsed}ms`);
    return text;
  }

  throw new Error(`[${provider}] ${model} failed after ${MAX_RETRIES} retries: ${lastError}`);
}

// ─── Chain runner ─────────────────────────────────────────────────────────

async function runChain(
  prompt: string,
  system: string | undefined,
  chain: ProviderId[],
  opts: GenOptions
): Promise<{ text: string; usedProvider: ProviderId }> {
  const attempts: Array<{ provider: ProviderId; error: string }> = [];
  let prevProvider: ProviderId | null = null;

  for (const provider of chain) {
    // ── Grok checkpoint ───────────────────────────────────────────────────
    if (provider === "xai") {
      // 1. User must have given explicit approval.
      if (!opts.allowGrok) {
        throw new GrokApprovalRequiredError(attempts);
      }
      // 2. OPENROUTER_API_KEY must be present (already checked inside
      //    callOpenRouter, but we want the checkpoint log here).
      if (!process.env.OPENROUTER_API_KEY) {
        console.warn("[AI] Grok checkpoint failed — OPENROUTER_API_KEY missing, skipping.");
        attempts.push({ provider, error: "OPENROUTER_API_KEY missing" });
        continue;
      }
      // 3. Grok must not be temporarily disabled.
      if (isGrokDisabled()) {
        const mins = Math.ceil((grokDisabledUntil - Date.now()) / 60000);
        console.warn(`[AI] Grok checkpoint failed — disabled for ~${mins} more min, skipping.`);
        attempts.push({ provider, error: "Grok temporarily disabled" });
        continue;
      }
    }

    const modelLabel = MODEL_BY_PROVIDER[provider];
    console.log(`[AI] Trying ${modelLabel}…`);

    try {
      const text = await callOpenRouter(provider, prompt, system);
      opts.onSuccess?.(provider);

      if (prevProvider) {
        opts.onFallback?.({
          from: prevProvider,
          to: provider,
          reason: `Fell back from ${prevProvider} after all retries exhausted`
        });
      }

      return { text, usedProvider: provider };
    } catch (e: any) {
      const msg: string = e?.message || String(e);
      attempts.push({ provider, error: msg });

      // Apply Grok-specific checkpoint: disable temporarily on failure.
      if (provider === "xai") {
        disableGrokTemporarily(msg);
      } else {
        const friendlyLabel =
          provider === "openai"    ? "GPT-4.1-mini"   :
          provider === "anthropic" ? "Claude Sonnet"  :
          provider === "gemini"    ? "Gemini Flash"   : provider;
        if (prevProvider) {
          console.log(`[AI] ${friendlyLabel} failed, switching to next provider… (${msg.slice(0, 120)})`);
        } else {
          console.log(`[AI] ${friendlyLabel} failed — ${msg.slice(0, 120)}`);
        }
      }

      prevProvider = provider;
      // Always continue — never crash the chain on a single provider failure.
    }
  }

  const summary = attempts.map((a) => `  ${a.provider}: ${a.error}`).join("\n");
  throw new Error(`All AI providers exhausted:\n${summary}`);
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Long-form generation: GPT-4.1-mini → Claude → Gemini → Grok*.
 * Used for lessons, book descriptions, cover briefs, improvements, etc.
 */
export async function generateContent(
  prompt: string,
  system?: string,
  opts: GenOptions = {}
): Promise<{ text: string; usedProvider: ProviderId }> {
  return runChain(prompt, system, ["openai", "anthropic", "gemini", "xai"], opts);
}

/**
 * Short-form generation: Gemini → GPT-4.1-mini → Claude → Grok*.
 * Used for titles, outlines, architecture previews, quick suggestions.
 */
export async function generateContentFast(
  prompt: string,
  system?: string,
  opts: GenOptions = {}
): Promise<{ text: string; usedProvider: ProviderId }> {
  return runChain(prompt, system, ["gemini", "openai", "anthropic", "xai"], opts);
}

/**
 * Extract the first JSON object or array from an AI response string.
 * Handles markdown code fences, bare objects, and bare arrays.
 */
export function extractJSON(text: string): any {
  const t = String(text || "");

  // Strip markdown code fence first.
  const fenceMatch = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* fall through */ }
  }

  // Bare JSON object.
  const objMatch = t.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch { /* fall through */ }
  }

  // Bare JSON array.
  const arrMatch = t.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch { /* fall through */ }
  }

  throw new Error(`Could not parse JSON from AI response: ${t.slice(0, 200)}`);
}
