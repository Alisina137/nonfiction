// ═══════════════════════════════════════════════════════════════════════════
// OpenRouter AI Router — optimised for free / low-credit usage
// ═══════════════════════════════════════════════════════════════════════════
//
// PROVIDER PRIORITY  (same for both long-form and short-form)
//   gemini → openai → llama → deepseek → anthropic → grok*
//
//   * Grok requires explicit user approval (allowGrok: true).
//
// TOKEN BUDGETS
//   Hard cap: 2 500 tokens per request (never exceeded).
//   Each content type carries its own budget — see TOKEN_LIMITS below.
//
// PROVIDER OFFLINE TRACKING
//   Any provider that returns "No endpoints found", "temporarily disabled",
//   a timeout, or a rate-limit error is automatically skipped for
//   PROVIDER_DISABLE_MS (10 min).  Grok uses the same mechanism.
//
// LLAMA RATE GATE
//   Free Llama allows ≈8 req/min.  A minimum 8-second gap is enforced
//   between consecutive Llama calls via a simple in-process lock.
//
// RETRY + BACKOFF
//   Each provider attempt retries up to MAX_RETRIES (3) times with
//   exponential back-off (1 s → 2 s → 4 s) on retriable errors.
//
// ═══════════════════════════════════════════════════════════════════════════

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODEL_BY_PROVIDER = {
  gemini:    "google/gemini-2.5-flash",
  openai:    "openai/gpt-4.1-mini",
  llama:     "meta-llama/llama-3.3-70b-instruct:free",
  deepseek:  "deepseek/deepseek-chat-v3-0324:free",
  anthropic: "anthropic/claude-3.7-sonnet",
  xai:       "x-ai/grok-3-mini-beta"
} as const;

export type ProviderId = keyof typeof MODEL_BY_PROVIDER;

// ─── Token budgets ────────────────────────────────────────────────────────
// All values are capped at MAX_TOKENS_CAP — never exceed it.

const MAX_TOKENS_CAP = 2500;

export const TOKEN_LIMITS: Record<string, number> = {
  title:               150,   // 6 title suggestions
  regenTitle:          150,   // single title replacement
  outline:            1000,   // full chapter/section JSON outline
  lesson:             2200,   // chapter section prose (largest content type)
  improve:            1200,   // rewrite / improve existing text
  description:         300,   // book description / hook
  cover:               600,   // cover brief JSON
  analysis:            600,   // concept analysis JSON
  architecturePreview: 600,   // architecture preview JSON
  structure:           500,   // section structure JSON
  default:            1200
};

function capTokens(n: number): number {
  return Math.min(n, MAX_TOKENS_CAP);
}

// ─── Provider offline tracking ────────────────────────────────────────────
// Any provider can be disabled for 10 minutes on hard failures.

const PROVIDER_DISABLE_MS = 10 * 60 * 1000;
const providerDisabledUntil = new Map<ProviderId, number>();

function isProviderDisabled(p: ProviderId): boolean {
  const until = providerDisabledUntil.get(p) ?? 0;
  return Date.now() < until;
}

function disableProvider(p: ProviderId, reason: string) {
  const until = Date.now() + PROVIDER_DISABLE_MS;
  providerDisabledUntil.set(p, until);
  console.warn(`[AI] ${p} marked offline for 10 min — ${reason.slice(0, 120)}`);
}

// ─── Grok approval gate ───────────────────────────────────────────────────

export class GrokApprovalRequiredError extends Error {
  needsApproval = "grok" as const;
  attempted: Array<{ provider: ProviderId; error: string }>;
  constructor(attempted: Array<{ provider: ProviderId; error: string }>) {
    super("Grok approval required: all other providers are unavailable.");
    this.name = "GrokApprovalRequiredError";
    this.attempted = attempted;
  }
}

// ─── Llama rate gate ──────────────────────────────────────────────────────
// Free Llama tier: ~8 req/min → enforce ≥8 s between calls.

const LLAMA_MIN_GAP_MS = 8000;
let llamaLastCallTime = 0;

async function waitForLlamaSlot(): Promise<void> {
  const now = Date.now();
  const elapsed = now - llamaLastCallTime;
  if (elapsed < LLAMA_MIN_GAP_MS && llamaLastCallTime > 0) {
    const wait = LLAMA_MIN_GAP_MS - elapsed;
    console.log(`[AI] Llama rate gate — waiting ${wait}ms before next call`);
    await new Promise((r) => setTimeout(r, wait));
  }
  llamaLastCallTime = Date.now();
}

// ─── Error classification ─────────────────────────────────────────────────

export function isLimitOrUnavailable(msg: string): boolean {
  return /rate.?limit|quota|daily.?limit|exceeded|insufficient|429|503|overload|unavailable|temporarily|timeout|timed.?out/i.test(
    msg || ""
  );
}

function isHardUnavailable(msg: string): boolean {
  return /no.?endpoint|endpoint.?not.?found|temporarily.?disabled|model.*unavailable|not.*available|doesn.*exist/i.test(
    msg || ""
  );
}

// ─── Core OpenRouter request ──────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

async function callOpenRouter(
  provider: ProviderId,
  prompt: string,
  system: string | undefined,
  temperature = 0.7,
  maxTokens = MAX_TOKENS_CAP
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
    max_tokens: capTokens(maxTokens),
    stream: false
  };

  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 4000;
      console.log(`[AI] Retry ${attempt}/${MAX_RETRIES} for ${model} in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }

    const startMs = Date.now();
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        Accept:          "application/json",
        Authorization:   `Bearer ${apiKey}`,
        "HTTP-Referer":  "https://nonfiction-studio.replit.app",
        "X-Title":       "Nonfiction AI Studio"
      },
      body: JSON.stringify(body)
    });

    const rawText = await res.text();
    let data: any = {};
    try { data = rawText ? JSON.parse(rawText) : {}; }
    catch { data = { _raw: rawText }; }

    const elapsed = Date.now() - startMs;

    if (!res.ok) {
      const detail: string =
        data?.error?.message ||
        (typeof data?.error === "string" ? data.error : "") ||
        data?._raw || `HTTP ${res.status}`;

      lastError = detail;

      console.error("[AI] Request failed", {
        provider, model,
        status: res.status,
        retryCount: attempt,
        generationTimeMs: elapsed,
        errorMessage: detail.slice(0, 300)
      });

      // Hard unavailable — no point retrying this provider
      if (isHardUnavailable(detail)) {
        throw new Error(`[${provider}] ${detail}`);
      }

      if (attempt < MAX_RETRIES && isLimitOrUnavailable(detail + ` ${res.status}`)) {
        continue;
      }
      throw new Error(`[${provider}] ${detail}`);
    }

    const text: string = data?.choices?.[0]?.message?.content || "";

    if (!text) {
      lastError = "Empty response";
      if (attempt < MAX_RETRIES) continue;
      throw new Error(`[${provider}] ${model} returned empty response`);
    }

    console.log(`[AI] ${provider} (${model}) succeeded in ${elapsed}ms`);
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
  const attempts: Array<{ provider: ProviderId; status: string; error: string }> = [];

  for (const provider of chain) {

    // ── Grok checkpoint ──────────────────────────────────────────────────
    if (provider === "xai") {
      if (!opts.allowGrok) {
        throw new GrokApprovalRequiredError(
          attempts.map((a) => ({ provider: a.provider, error: a.error }))
        );
      }
      if (!process.env.OPENROUTER_API_KEY) {
        attempts.push({ provider, status: "skip", error: "OPENROUTER_API_KEY missing" });
        continue;
      }
    }

    // ── Per-provider offline check ────────────────────────────────────────
    if (isProviderDisabled(provider)) {
      const until = providerDisabledUntil.get(provider) ?? 0;
      const minsLeft = Math.ceil((until - Date.now()) / 60000);
      const reason = `offline for ~${minsLeft} more min`;
      console.log(`[AI] Skipping ${provider} — ${reason}`);
      attempts.push({ provider, status: "offline", error: reason });
      continue;
    }

    // ── Llama rate gate ───────────────────────────────────────────────────
    if (provider === "llama" || provider === "deepseek") {
      await waitForLlamaSlot();
    }

    const modelLabel = MODEL_BY_PROVIDER[provider];
    console.log(`[AI] Trying ${modelLabel}…`);

    try {
      const text = await callOpenRouter(provider, prompt, system, 0.7, opts.maxTokens ?? TOKEN_LIMITS.default);
      opts.onSuccess?.(provider);

      const prevFailed = attempts.filter((a) => a.status === "failed");
      if (prevFailed.length > 0) {
        opts.onFallback?.({ from: prevFailed[prevFailed.length - 1].provider, to: provider, reason: "fallback" });
      }

      return { text, usedProvider: provider };

    } catch (e: any) {
      const msg: string = e?.message || String(e);

      // Disable provider if it's hard-unavailable or repeated rate-limiting
      if (isHardUnavailable(msg) || isLimitOrUnavailable(msg)) {
        disableProvider(provider, msg);
      }

      // Friendly label for log
      const labels: Record<string, string> = {
        gemini: "Gemini Flash", openai: "GPT-4.1-mini", anthropic: "Claude Sonnet",
        xai: "Grok Mini", llama: "Llama 3.3", deepseek: "DeepSeek"
      };
      const label = labels[provider] ?? provider;
      const shortMsg = msg.replace(`[${provider}] `, "").slice(0, 100);
      console.log(`[AI] ${label} failed — ${shortMsg}`);

      attempts.push({ provider, status: "failed", error: shortMsg });
      if (provider === "xai") disableProvider("xai", msg);
    }
  }

  // All providers exhausted — build a detailed error message
  const lines = attempts.map((a) => {
    const label = a.status === "offline" ? "⏸ offline" : "✗ failed";
    return `  ${a.provider} (${label}): ${a.error}`;
  });
  throw new Error(
    `All AI providers exhausted:\n${lines.join("\n")}\n\nCheck your OpenRouter credits or wait for providers to come back online.`
  );
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface GenOptions {
  allowGrok?: boolean;
  maxTokens?: number;
  onFallback?: (info: { from: ProviderId; to: ProviderId; reason: string }) => void;
  onSuccess?: (provider: ProviderId) => void;
}

const FULL_CHAIN: ProviderId[] = ["gemini", "openai", "llama", "deepseek", "anthropic", "xai"];

/**
 * Long-form generation (lesson prose, descriptions, cover briefs, improvements).
 * Chain: gemini → openai → llama → deepseek → anthropic → grok*
 */
export async function generateContent(
  prompt: string,
  system?: string,
  opts: GenOptions = {}
): Promise<{ text: string; usedProvider: ProviderId }> {
  return runChain(prompt, system, FULL_CHAIN, opts);
}

/**
 * Short-form generation (titles, outlines, structure, quick tasks).
 * Same chain — Gemini leads and is ideal for short, cheap tasks.
 */
export async function generateContentFast(
  prompt: string,
  system?: string,
  opts: GenOptions = {}
): Promise<{ text: string; usedProvider: ProviderId }> {
  return runChain(prompt, system, FULL_CHAIN, opts);
}

// ─── JSON extraction + repair ─────────────────────────────────────────────

function repairTruncatedJSON(raw: string): any {
  const s = raw.trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return null;

  const stack: string[] = [];
  let inString = false;
  let escape = false;
  let lastChildEndPos = -1;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === "\\" && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (c === "{" || c === "[") {
      stack.push(c === "{" ? "}" : "]");
    } else if (c === "}" || c === "]") {
      stack.pop();
      if (stack.length === 1) lastChildEndPos = i;
    }
  }

  if (stack.length === 0) {
    try { return JSON.parse(s); } catch { return null; }
  }

  const closers = stack.slice().reverse().join("");

  if (lastChildEndPos > 0) {
    try { return JSON.parse(s.slice(0, lastChildEndPos + 1) + closers); } catch { /* fall through */ }
  }

  try { return JSON.parse(s + closers); } catch { return null; }
}

export function extractJSON(text: string): any {
  const t = String(text || "");

  const fenceMatch = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    try { return JSON.parse(inner); } catch { /* fall through */ }
    const r = repairTruncatedJSON(inner);
    if (r !== null) return r;
  }

  const openFence = t.match(/```(?:json)?\s+([\s\S]+)$/);
  if (openFence) {
    const inner = openFence[1].trim();
    try { return JSON.parse(inner); } catch { /* fall through */ }
    const r = repairTruncatedJSON(inner);
    if (r !== null) return r;
  }

  const objStart = t.indexOf("{");
  const arrStart = t.indexOf("[");
  const start =
    objStart === -1 ? arrStart :
    arrStart === -1 ? objStart :
    Math.min(objStart, arrStart);

  if (start !== -1) {
    const raw = t.slice(start);
    try { return JSON.parse(raw); } catch { /* fall through */ }
    const r = repairTruncatedJSON(raw);
    if (r !== null) return r;
  }

  throw new Error(`Could not parse JSON from AI response: ${t.slice(0, 200)}`);
}
