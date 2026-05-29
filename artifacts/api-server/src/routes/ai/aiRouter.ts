// ═══════════════════════════════════════════════════════════════════════════
// OpenRouter AI Router — credit-aware multi-model orchestration
// ═══════════════════════════════════════════════════════════════════════════
//
// PROVIDER CHAINS
//   FULL (default):  gemini → openai → deepseek → llama → gemini_free
//                    → mistral → anthropic → grok*
//   FREE (lowCredit): deepseek → llama → gemini_free → mistral
//
//   * Grok requires explicit user approval (allowGrok: true).
//
// DISABLE TRACKING
//   credit exhaustion (402/insufficient credits): 4 hours
//   hard unavailable (404/no endpoints):          60 minutes
//   rate limited (429/quota):                     10 minutes
//
// RETRY + BACKOFF
//   Each provider retries up to MAX_RETRIES (3) times with exponential
//   back-off (2s → 5s → 10s) on retriable errors.
//
// CLIENT OVERRIDE
//   Callers can pass disabledProviders: string[] to skip specific providers
//   (used by the frontend to honour manual user overrides + client-tracked
//   credit exhaustion).
//
// STATUS EXPORT
//   getModelStatus() returns a snapshot of all providers for the status API.
//
// ═══════════════════════════════════════════════════════════════════════════

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const MODEL_BY_PROVIDER = {
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

export const PROVIDER_META: Record<ProviderId, { label: string; tier: "paid" | "free"; order: number }> = {
  gemini:      { label: "Gemini 2.5 Flash",   tier: "paid", order: 1 },
  openai:      { label: "GPT-4.1 Mini",       tier: "paid", order: 2 },
  anthropic:   { label: "Claude 3.7 Sonnet",  tier: "paid", order: 7 },
  xai:         { label: "Grok Mini",          tier: "paid", order: 8 },
  deepseek:    { label: "DeepSeek (free)",    tier: "free", order: 3 },
  llama:       { label: "Llama 3.3 (free)",   tier: "free", order: 4 },
  gemini_free: { label: "Gemini Flash (free)","tier": "free", order: 5 },
  mistral:     { label: "Mistral (free)",     tier: "free", order: 6 }
};

// ─── Token budgets ────────────────────────────────────────────────────────

const MAX_TOKENS_CAP = 1800;

export const TOKEN_LIMITS: Record<string, number> = {
  title:               200,
  subtitle:            300,
  regenTitle:          120,
  outline:            1200,
  lesson:             1400,
  improve:             900,
  description:         300,
  cover:               600,
  analysis:            500,
  architecturePreview: 500,
  structure:           400,
  default:             800
};

const LOW_CREDIT_TOKEN_CAP = 900;

function capTokens(n: number): number {
  return Math.min(n, MAX_TOKENS_CAP);
}

// ─── Token estimation ─────────────────────────────────────────────────────

const CHARS_PER_TOKEN = 4;
const MAX_INPUT_CHARS  = 12_000;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function ensureTokenBudget(
  prompt: string,
  maxOutputTokens: number
): { prompt: string; maxTokens: number } {
  const truncated =
    prompt.length > MAX_INPUT_CHARS
      ? prompt.slice(0, MAX_INPUT_CHARS) + "\n\n[Context truncated to fit token budget]"
      : prompt;
  const inputEst    = estimateTokens(truncated);
  const totalBudget = 4000;
  const safeOutput  = Math.max(300, totalBudget - inputEst);
  const finalOutput = Math.min(maxOutputTokens, safeOutput);
  return { prompt: truncated, maxTokens: capTokens(finalOutput) };
}

// ─── Provider disable tracking ────────────────────────────────────────────

export type DisableReason = "credit" | "hard" | "rate_limit";

const DISABLE_DURATION_MS: Record<DisableReason, number> = {
  credit:     4 * 60 * 60 * 1000,   // 4 hours — daily credit reset
  hard:       60 * 60 * 1000,       // 60 min — model offline / not found
  rate_limit: 10 * 60 * 1000        // 10 min — temporary rate limiting
};

const providerDisabledUntil  = new Map<ProviderId, number>();
const providerDisableReasonMap = new Map<ProviderId, DisableReason>();

function isProviderDisabled(p: ProviderId): boolean {
  return Date.now() < (providerDisabledUntil.get(p) ?? 0);
}

function disableProvider(p: ProviderId, reason: string, type: DisableReason = "rate_limit") {
  const duration = DISABLE_DURATION_MS[type];
  const until = Date.now() + duration;
  providerDisabledUntil.set(p, until);
  providerDisableReasonMap.set(p, type);
  const tag = type === "credit" ? "4h (credit)" : type === "hard" ? "60min (offline)" : "10min (rate)";
  console.warn(`[AI] ${p} marked offline for ${tag} — ${reason.slice(0, 120)}`);
}

// ─── Error classification ─────────────────────────────────────────────────

function isCreditsExhausted(msg: string): boolean {
  return /insufficient.?credit|can.?only.?afford|requires.?more.?credit|out.?of.?credit|daily.?limit|credit.?exhausted|402/i.test(msg || "");
}

export function isLimitOrUnavailable(msg: string): boolean {
  return /rate.?limit|quota|daily.?limit|exceeded|insufficient|429|503|overload|unavailable|temporarily|timeout|timed.?out/i.test(msg || "");
}

function isHardUnavailable(msg: string): boolean {
  return /no.?endpoint|endpoint.?not.?found|temporarily.?disabled|model.*unavailable|not.*available|doesn.*exist|404/i.test(msg || "");
}

// ─── Model status export ──────────────────────────────────────────────────

export interface ProviderStatus {
  model:         string;
  label:         string;
  tier:          "paid" | "free";
  order:         number;
  disabled:      boolean;
  disabledUntil: number | null;
  reason:        DisableReason | null;
}

/** Returns a live snapshot of all provider states for the status API. */
export function getModelStatus(): Record<ProviderId, ProviderStatus> {
  const now = Date.now();
  const result = {} as Record<ProviderId, ProviderStatus>;
  for (const [provider, model] of Object.entries(MODEL_BY_PROVIDER) as [ProviderId, string][]) {
    const until    = providerDisabledUntil.get(provider)    ?? 0;
    const reason   = providerDisableReasonMap.get(provider) ?? null;
    const disabled = now < until;
    const meta     = PROVIDER_META[provider];
    result[provider] = {
      model,
      label:         meta.label,
      tier:          meta.tier,
      order:         meta.order,
      disabled,
      disabledUntil: disabled ? until : null,
      reason:        disabled ? reason : null
    };
  }
  return result;
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

const FREE_MODEL_MIN_GAP_MS = 7000;
export const FREE_PROVIDERS = new Set<ProviderId>(["deepseek", "llama", "gemini_free", "mistral"]);
let freeLastCallTime = 0;

async function waitForFreeSlot(provider: ProviderId): Promise<void> {
  if (!FREE_PROVIDERS.has(provider)) return;
  const elapsed = Date.now() - freeLastCallTime;
  if (elapsed < FREE_MODEL_MIN_GAP_MS && freeLastCallTime > 0) {
    const wait = FREE_MODEL_MIN_GAP_MS - elapsed;
    console.log(`[AI] Free model rate gate (${provider}) — waiting ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
  }
  freeLastCallTime = Date.now();
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

  const budgeted       = ensureTokenBudget(prompt, maxTokens);
  const finalPrompt    = budgeted.prompt;
  const finalMaxTokens = budgeted.maxTokens;

  const model    = MODEL_BY_PROVIDER[provider];
  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: finalPrompt });

  const body = { model, messages, temperature, max_tokens: finalMaxTokens, stream: false };

  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 4000;
      console.log(`[AI] Retry ${attempt}/${MAX_RETRIES} for ${model} in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }

    const startMs = Date.now();
    const res = await fetch(OPENROUTER_URL, {
      method:  "POST",
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
    console.log("OPENROUTER STATUS:", res.status);
    console.log("OPENROUTER RESPONSE:", rawText);
    
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
        status:            res.status,
        retryCount:        attempt,
        generationTimeMs:  elapsed,
        errorMessage:      detail.slice(0, 300)
      });

      if (isHardUnavailable(detail)) throw new Error(`[${provider}] ${detail}`);
      if (attempt < MAX_RETRIES && isLimitOrUnavailable(detail + ` ${res.status}`)) continue;
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

export interface GenOptions {
  allowGrok?:        boolean;
  maxTokens?:        number;
  lowCredit?:        boolean;
  disabledProviders?: string[];  // client-specified providers to skip
  onFallback?:       (info: { from: ProviderId; to: ProviderId; reason: string }) => void;
  onSuccess?:        (provider: ProviderId) => void;
}

export interface GenResult {
  text:               string;
  usedProvider:       ProviderId;
  exhaustedProviders: ProviderId[];  // providers that hit credit limits during this call
}

async function runChain(
  prompt: string,
  system: string | undefined,
  chain: ProviderId[],
  opts: GenOptions
): Promise<GenResult> {
  const attempts: Array<{ provider: ProviderId; status: string; error: string }> = [];
  const exhaustedProviders: ProviderId[] = [];
  const clientDisabled = new Set(opts.disabledProviders ?? []);

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

    // ── Client-side disabled check ────────────────────────────────────────
    if (clientDisabled.has(provider)) {
      attempts.push({ provider, status: "client_disabled", error: "disabled by client" });
      continue;
    }

    // ── Server-side offline check ─────────────────────────────────────────
    if (isProviderDisabled(provider)) {
      const until    = providerDisabledUntil.get(provider) ?? 0;
      const minsLeft = Math.ceil((until - Date.now()) / 60000);
      const reason   = `offline for ~${minsLeft} more min`;
      console.log(`[AI] Skipping ${provider} — ${reason}`);
      attempts.push({ provider, status: "offline", error: reason });
      continue;
    }

    // ── Free model rate gate ──────────────────────────────────────────────
    await waitForFreeSlot(provider);
// comment
    console.log("================================");
    console.log("TRYING PROVIDER:", provider);
    console.log("MODEL:", MODEL_BY_PROVIDER[provider]);
    console.log("================================");
    // 
    try {
      const text = await callOpenRouter(provider, prompt, system, 0.7, opts.maxTokens ?? TOKEN_LIMITS.default);
      opts.onSuccess?.(provider);

      const prevFailed = attempts.filter((a) => a.status === "failed");
      if (prevFailed.length > 0) {
        opts.onFallback?.({ from: prevFailed[prevFailed.length - 1].provider, to: provider, reason: "fallback" });
      }

      return { text, usedProvider: provider, exhaustedProviders };

      } catch (e: any) {
      const msg = e?.message || String(e);

      console.error("PROVIDER FAILED");
      console.error("Provider:", provider);
      console.error("Error:", msg);
      // Classify and disable with appropriate duration
      if (isCreditsExhausted(msg)) {
        disableProvider(provider, msg, "credit");
        exhaustedProviders.push(provider);
        console.log(`[AI] ${PROVIDER_META[provider].label} — daily credits exhausted`);
      } else if (isHardUnavailable(msg)) {
        disableProvider(provider, msg, "hard");
        console.log(`[AI] ${PROVIDER_META[provider].label} — offline/unavailable`);
      } else if (isLimitOrUnavailable(msg)) {
        disableProvider(provider, msg, "rate_limit");
        console.log(`[AI] ${PROVIDER_META[provider].label} — rate limited`);
      }

      const shortMsg = msg.replace(`[${provider}] `, "").slice(0, 100);
      attempts.push({ provider, status: "failed", error: shortMsg });
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

const FREE_CHAIN: ProviderId[]  = ["deepseek", "llama", "gemini_free", "mistral"];
const FULL_CHAIN: ProviderId[]  = ["gemini", "openai", "deepseek", "llama", "gemini_free", "mistral", "anthropic", "xai"];

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

export async function generateContent(
  prompt: string,
  system?: string,
  opts: GenOptions = {}
): Promise<GenResult> {
  const { chain, resolvedOpts } = resolveChainAndTokens(opts);
  return runChain(prompt, system, chain, resolvedOpts);
}

export async function generateContentFast(
  prompt: string,
  system?: string,
  opts: GenOptions = {}
): Promise<GenResult> {
  const { chain, resolvedOpts } = resolveChainAndTokens(opts);
  return runChain(prompt, system, chain, resolvedOpts);
}

// ─── JSON extraction + repair ─────────────────────────────────────────────

function repairTruncatedJSON(raw: string): any {
  const s = raw.trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return null;

  const stack: string[] = [];
  let inString = false;
  let escape   = false;
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
