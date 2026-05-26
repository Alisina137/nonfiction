// ═══════════════════════════════════════════════════════════════════════════
// OpenRouter AI Router — optimised for free / low-credit usage
// ═══════════════════════════════════════════════════════════════════════════
//
// PROVIDER CHAINS
//   FULL (default):    gemini → openai → deepseek → llama → gemini_free
//                      → mistral → anthropic → grok*
//   FREE (lowCredit):  gemini_free → deepseek → llama → mistral
//
//   * Grok requires explicit user approval (allowGrok: true).
//
// TOKEN BUDGETS
//   Hard cap: 1 800 tokens per request (never exceeded).
//   Each content type carries its own budget — see TOKEN_LIMITS below.
//   Token estimation runs before each call; prompts are auto-truncated
//   if input + output would exceed the per-model context budget.
//
// PROVIDER OFFLINE TRACKING
//   Any provider that returns "No endpoints found", "temporarily disabled",
//   a timeout, or a rate-limit error is automatically skipped for
//   PROVIDER_DISABLE_MS (10 min).
//
// FREE MODEL RATE GATE
//   Free-tier models share a minimum 7-second gap between calls to avoid
//   hammering their rate limits.
//
// RETRY + BACKOFF
//   Each provider attempt retries up to MAX_RETRIES (3) times with
//   exponential back-off (2 s → 5 s → 10 s) on retriable errors.
//
// ═══════════════════════════════════════════════════════════════════════════

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODEL_BY_PROVIDER = {
  gemini:      "google/gemini-2.5-flash",
  openai:      "openai/gpt-4.1-mini",
  deepseek:    "deepseek/deepseek-chat-v3-0324:free",
  llama:       "meta-llama/llama-3.3-70b-instruct:free",
  gemini_free: "google/gemini-2.0-flash-exp:free",
  mistral:     "mistralai/mistral-small-3.1-24b-instruct:free",
  anthropic:   "anthropic/claude-3.7-sonnet",
  xai:         "x-ai/grok-3-mini-beta"
} as const;

export type ProviderId = keyof typeof MODEL_BY_PROVIDER;

// ─── Token budgets ────────────────────────────────────────────────────────
// All values are capped at MAX_TOKENS_CAP — never exceed it.

const MAX_TOKENS_CAP = 1800;

export const TOKEN_LIMITS: Record<string, number> = {
  title:               200,   // 6 title suggestion cards (rich JSON)
  regenTitle:          120,   // single title replacement
  outline:            1200,   // full chapter/section JSON outline
  lesson:             1400,   // chapter section prose
  improve:             900,   // rewrite / improve existing text
  description:         300,   // book description / hook
  cover:               600,   // cover brief JSON
  analysis:            500,   // concept analysis JSON
  architecturePreview: 500,   // architecture preview JSON
  structure:           400,   // section structure JSON
  default:             800
};

// When lowCredit is active, cap output at this many tokens (free models vary)
const LOW_CREDIT_TOKEN_CAP = 900;

function capTokens(n: number): number {
  return Math.min(n, MAX_TOKENS_CAP);
}

// ─── Token estimation ─────────────────────────────────────────────────────
// Rough heuristic: 1 token ≈ 4 characters.  Used to guard against
// prompts that would exhaust a model's budget before generating any output.

const CHARS_PER_TOKEN = 4;
const MAX_INPUT_CHARS  = 12_000;  // ~3 000 input tokens — leave room for output

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function ensureTokenBudget(
  prompt: string,
  maxOutputTokens: number
): { prompt: string; maxTokens: number } {
  // Truncate prompt if it is too long
  const truncated =
    prompt.length > MAX_INPUT_CHARS
      ? prompt.slice(0, MAX_INPUT_CHARS) + "\n\n[Context truncated to fit token budget]"
      : prompt;

  // If even after truncation input + output looks tight, reduce output budget
  const inputEst      = estimateTokens(truncated);
  const totalBudget   = 4000; // conservative model context
  const safeOutput    = Math.max(300, totalBudget - inputEst);
  const finalOutput   = Math.min(maxOutputTokens, safeOutput);

  return { prompt: truncated, maxTokens: capTokens(finalOutput) };
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

// ─── Free model rate gate ─────────────────────────────────────────────────
// Free-tier models share a 7-second minimum gap to avoid rate-limit errors.

const FREE_MODEL_MIN_GAP_MS = 7000;
const FREE_PROVIDERS = new Set<ProviderId>(["deepseek", "llama", "gemini_free", "mistral"]);
let freeLastCallTime = 0;

async function waitForFreeSlot(provider: ProviderId): Promise<void> {
  if (!FREE_PROVIDERS.has(provider)) return;
  const now = Date.now();
  const elapsed = now - freeLastCallTime;
  if (elapsed < FREE_MODEL_MIN_GAP_MS && freeLastCallTime > 0) {
    const wait = FREE_MODEL_MIN_GAP_MS - elapsed;
    console.log(`[AI] Free model rate gate (${provider}) — waiting ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
  }
  freeLastCallTime = Date.now();
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
const RETRY_DELAYS_MS = [2000, 5000, 10000];

async function callOpenRouter(
  provider: ProviderId,
  prompt: string,
  system: string | undefined,
  temperature = 0.7,
  maxTokens = MAX_TOKENS_CAP
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  // Apply token budget: truncate prompt + reduce output if needed
  const budgeted = ensureTokenBudget(prompt, maxTokens);
  const finalPrompt    = budgeted.prompt;
  const finalMaxTokens = budgeted.maxTokens;

  const model = MODEL_BY_PROVIDER[provider];
  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: finalPrompt });

  const body = {
    model,
    messages,
    temperature,
    max_tokens: finalMaxTokens,
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

    // ── Free model rate gate ──────────────────────────────────────────────
    await waitForFreeSlot(provider);

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
        gemini:      "Gemini 2.5 Flash",
        openai:      "GPT-4.1-mini",
        anthropic:   "Claude Sonnet",
        xai:         "Grok Mini",
        llama:       "Llama 3.3 (free)",
        deepseek:    "DeepSeek (free)",
        gemini_free: "Gemini Flash (free)",
        mistral:     "Mistral (free)"
      };
      const label = labels[provider] ?? provider;
      const shortMsg = msg.replace(`[${provider}] `, "").slice(0, 100);
      console.log(`[AI] ${label} failed — ${shortMsg}`);

      attempts.push({ provider, status: "failed", error: shortMsg });
      if (provider === "xai") disableProvider("xai", msg);
    }
  }

  // All providers exhausted
  const failedCount = attempts.filter((a) => a.status === "failed").length;
  const onFreeChain = opts.lowCredit;
  const hint = onFreeChain
    ? "All free AI providers are currently busy or rate-limited. Disable Low-cost mode to use paid providers, or wait a few minutes and try again."
    : "All AI providers are unavailable. Your OpenRouter credits may be low — enable Low-cost mode to use free models, or add credits at openrouter.ai.";
  throw new Error(`AI_EXHAUSTED:${failedCount}:${hint}`);
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface GenOptions {
  allowGrok?:  boolean;
  maxTokens?:  number;
  lowCredit?:  boolean;  // use free-only chain when true
  onFallback?: (info: { from: ProviderId; to: ProviderId; reason: string }) => void;
  onSuccess?:  (provider: ProviderId) => void;
}

// Free-only chain: deepseek → llama → gemini_free → mistral
const FREE_CHAIN: ProviderId[] = ["deepseek", "llama", "gemini_free", "mistral"];

// Full chain: paid first, free as deep fallbacks, Grok last (gated)
const FULL_CHAIN: ProviderId[] = ["gemini", "openai", "deepseek", "llama", "gemini_free", "mistral", "anthropic", "xai"];

function resolveChainAndTokens(opts: GenOptions): { chain: ProviderId[]; resolvedOpts: GenOptions } {
  if (opts.lowCredit) {
    return {
      chain: FREE_CHAIN,
      resolvedOpts: {
        ...opts,
        maxTokens: Math.min(opts.maxTokens ?? TOKEN_LIMITS.default, LOW_CREDIT_TOKEN_CAP)
      }
    };
  }
  return { chain: FULL_CHAIN, resolvedOpts: opts };
}

/**
 * Long-form generation (lesson prose, descriptions, cover briefs, improvements).
 * Routes to FREE_CHAIN when opts.lowCredit is true.
 */
export async function generateContent(
  prompt: string,
  system?: string,
  opts: GenOptions = {}
): Promise<{ text: string; usedProvider: ProviderId }> {
  const { chain, resolvedOpts } = resolveChainAndTokens(opts);
  return runChain(prompt, system, chain, resolvedOpts);
}

/**
 * Short-form generation (titles, outlines, structure, quick tasks).
 * Same routing as generateContent — Gemini leads and is cheapest.
 */
export async function generateContentFast(
  prompt: string,
  system?: string,
  opts: GenOptions = {}
): Promise<{ text: string; usedProvider: ProviderId }> {
  const { chain, resolvedOpts } = resolveChainAndTokens(opts);
  return runChain(prompt, system, chain, resolvedOpts);
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
