// ═══════════════════════════════════════════════════════════════════════════
// Multi-Provider AI Router — 5 independent providers, independent free quotas
// ═══════════════════════════════════════════════════════════════════════════
//
// PROVIDER CHAIN (both normal and low-cost mode — same order, same providers):
//   1. Gemini     — Google AI Studio (GEMINI_API_KEY)
//   2. Groq       — Groq Cloud (GROQ_API_KEY)
//   3. xAI        — xAI Cloud / Grok (XAI_API_KEY)
//   4. OpenRouter — last-resort fallback (OPENROUTER_API_KEY)
//
// QUOTA TRACKING:
//   On 429 / quota / rate-limit / daily-limit errors:
//     → provider disabled for 24 hours (independent per-provider cooldown)
//   On hard unavailable (404 / no endpoint):
//     → provider disabled for 60 minutes
//   On transient rate limit (short-lived):
//     → provider disabled for 10 minutes
//
// CLIENT OVERRIDE:
//   disabledProviders: string[] — skip these in the chain (user manual toggle)
//
// ═══════════════════════════════════════════════════════════════════════════

// ─── Provider configuration ───────────────────────────────────────────────

export type ProviderId = "gemini" | "groq" | "xai" | "openrouter";

// ─── xAI model list (configurable from one place) ─────────────────────────
export const XAI_MODELS = [
  "grok-3-mini",
  "grok-3",
  "grok-2-1212",
  "grok-beta"
] as const;
export type XaiModel = typeof XAI_MODELS[number];
export const XAI_DEFAULT_MODEL: XaiModel = "grok-3-mini";

export interface ProviderConfig {
  id:      ProviderId;
  label:   string;
  model:   string;
  apiUrl:  string;
  apiKey:  () => string | undefined;
  order:   number;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id:     "gemini",
    label:  "Gemini 2.5 Flash",
    model:  "gemini-2.5-flash",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    apiKey: () => process.env.GEMINI_API_KEY,
    order:  1
  },
  {
    id:     "groq",
    label:  "Groq (Llama)",
    model:  "llama-3.3-70b-versatile",
    apiUrl: "https://api.groq.com/openai/v1/chat/completions",
    apiKey: () => process.env.GROQ_API_KEY,
    order:  2
  },
  {
    id:     "xai",
    label:  "xAI (Grok)",
    model:  XAI_DEFAULT_MODEL,
    apiUrl: "https://api.x.ai/v1/chat/completions",
    apiKey: () => process.env.XAI_API_KEY,
    order:  3
  },
  {
    id:     "openrouter",
    label:  "OpenRouter (fallback)",
    model:  "meta-llama/llama-3.3-70b-instruct:free",
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: () => process.env.OPENROUTER_API_KEY,
    order:  4
  }
];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);

const PROVIDER_BY_ID = Object.fromEntries(PROVIDERS.map((p) => [p.id, p])) as Record<ProviderId, ProviderConfig>;

// ─── Startup key warnings ──────────────────────────────────────────────────
(function warnMissingKeys() {
  for (const p of PROVIDERS) {
    if (!p.apiKey()) {
      console.warn(`[AI] WARNING: ${p.id.toUpperCase()}_API_KEY is not set — ${p.label} will be skipped in the provider chain.`);
      if (p.id === "xai") {
        console.warn("[AI] To enable xAI (Grok), add XAI_API_KEY to your Replit Secrets. Get your key at https://console.x.ai/");
      }
    }
  }
})();

// Model lookup for external status consumers
export const MODEL_BY_PROVIDER = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p.model])
) as Record<ProviderId, string>;

// ─── Token budgets ─────────────────────────────────────────────────────────

export const TOKEN_LIMITS: Record<string, number> = {
  title:               500,
  subtitle:            700,
  regenTitle:          250,
  outline:            1200,
  lesson:             6000,
  improve:             900,
  description:         500,
  cover:               600,
  analysis:            500,
  architecturePreview: 500,
  structure:           400,
  details:            2500,
  authorPersona:      2000,
  strategicPlan:      3500,
  bookSection:        1500,
  sectionGen:         1000,
  conceptGen:         2000,
  fieldSuggestion:    1200,
  subsectionGen:       900,
  chapterStrategy:    1200,
  default:             800
};

const MAX_TOKENS_CAP       = 8000;
const LOW_COST_TOKEN_CAP   = 1800;
const MAX_INPUT_CHARS      = 12_000;
const CHARS_PER_TOKEN      = 4;

function capTokens(n: number): number {
  return Math.min(n, MAX_TOKENS_CAP);
}

function ensureTokenBudget(
  prompt: string,
  maxOutputTokens: number
): { prompt: string; maxTokens: number } {
  const truncated =
    prompt.length > MAX_INPUT_CHARS
      ? prompt.slice(0, MAX_INPUT_CHARS) + "\n\n[Context truncated to fit token budget]"
      : prompt;
  const inputEst    = Math.ceil(truncated.length / CHARS_PER_TOKEN);
  const totalBudget = 8000;  // generous budget — all providers support this
  const safeOutput  = Math.max(512, totalBudget - inputEst);
  const finalOutput = Math.min(maxOutputTokens, safeOutput);
  return { prompt: truncated, maxTokens: capTokens(finalOutput) };
}

// ─── Provider disable tracking (server-side) ──────────────────────────────

export type DisableReason = "credit" | "hard" | "rate_limit";

const DISABLE_DURATION_MS: Record<DisableReason, number> = {
  credit:     24 * 60 * 60 * 1000,  // 24 hours — daily quota reset
  hard:       60 * 60 * 1000,       // 60 minutes — model offline
  rate_limit: 10 * 60 * 1000        // 10 minutes — transient rate limit
};

const providerDisabledUntil    = new Map<ProviderId, number>();
const providerDisableReasonMap = new Map<ProviderId, DisableReason>();

function isProviderDisabled(id: ProviderId): boolean {
  return Date.now() < (providerDisabledUntil.get(id) ?? 0);
}

function disableProvider(id: ProviderId, reason: string, type: DisableReason) {
  const duration = DISABLE_DURATION_MS[type];
  const until    = Date.now() + duration;
  providerDisabledUntil.set(id, until);
  providerDisableReasonMap.set(id, type);
  const tag = type === "credit"
    ? "24h (daily quota)"
    : type === "hard"
      ? "60min (offline)"
      : "10min (rate limit)";
  console.log(`PROVIDER FAILED`);
  console.log(`Provider: ${id}`);
  console.log(`Reason: ${reason.slice(0, 200)}`);
  console.log(`Disabled for: ${tag}`);
}

/** Clears all server-side disable state. */
export function resetProviders(): void {
  providerDisabledUntil.clear();
  providerDisableReasonMap.clear();
  console.log("[AI] All provider disable states cleared by reset-providers call.");
}

// ─── Error classification ──────────────────────────────────────────────────

function isQuotaExhausted(msg: string, status?: number): boolean {
  if (status === 429) return true;
  return /quota.?exceed|daily.?limit|rate.?limit.?reached|insufficient.?credit|out.?of.?credit|credit.?exhaust|free.?tier.?exhaust|daily.?quota|resource.?exhaust|RESOURCE_EXHAUSTED/i.test(msg || "");
}

function isInvalidKey(msg: string, status?: number): boolean {
  if (status !== 400 && status !== 401) return false;
  return /incorrect.?api.?key|invalid.?api.?key|invalid.?key|api.?key.?invalid|authentication.?fail|unauthorized|no.?api.?key|api_key_invalid/i.test(msg || "");
}

function isHardUnavailable(msg: string, status?: number): boolean {
  if (status === 404 || status === 403) return true;
  if (isInvalidKey(msg, status)) return true;
  return /no.?endpoint|endpoint.?not.?found|temporarily.?disabled|model.*unavailable|doesn.*exist|not.*available|no.?credits|no.?license/i.test(msg || "");
}

function isTransientError(msg: string, status?: number): boolean {
  if (status === 503 || status === 502 || status === 500) return true;
  return /overload|temporarily|timeout|timed.?out|service.?unavailable/i.test(msg || "");
}

export function isLimitOrUnavailable(msg: string): boolean {
  return isQuotaExhausted(msg) || isHardUnavailable(msg) || isTransientError(msg);
}

// ─── Model status export ───────────────────────────────────────────────────

export interface ProviderStatus {
  model:         string;
  label:         string;
  order:         number;
  disabled:      boolean;
  disabledUntil: number | null;
  reason:        DisableReason | null;
  hasKey:        boolean;
}

export function getModelStatus(): Record<ProviderId, ProviderStatus> {
  const now    = Date.now();
  const result = {} as Record<ProviderId, ProviderStatus>;
  for (const p of PROVIDERS) {
    const until    = providerDisabledUntil.get(p.id)    ?? 0;
    const reason   = providerDisableReasonMap.get(p.id) ?? null;
    const disabled = now < until;
    result[p.id] = {
      model:         p.model,
      label:         p.label,
      order:         p.order,
      disabled,
      disabledUntil: disabled ? until : null,
      reason:        disabled ? reason : null,
      hasKey:        Boolean(p.apiKey())
    };
  }
  return result;
}

// ─── Per-provider callers ──────────────────────────────────────────────────

const MAX_RETRIES      = 2;
const RETRY_DELAYS_MS  = [2000, 5000];

interface CallResult { text: string; status: number }

/** Gemini native REST API (different shape from OpenAI-compatible) */
async function callGemini(
  prompt: string,
  system: string | undefined,
  maxTokens: number
): Promise<CallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw Object.assign(new Error("GEMINI_API_KEY is not configured"), { skipProvider: true });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const contents: any[] = [];
  if (system) {
    contents.push({ role: "user", parts: [{ text: `[System]: ${system}` }] });
    contents.push({ role: "model", parts: [{ text: "Understood." }] });
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7
    }
  };

  const res     = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body)
  });
  const rawText = await res.text();

  if (!res.ok) {
    let errMsg = rawText.slice(0, 400);
    try { const d = JSON.parse(rawText); errMsg = d?.error?.message || errMsg; } catch {}
    throw Object.assign(new Error(errMsg), { httpStatus: res.status });
  }

  let data: any = {};
  try { data = JSON.parse(rawText); } catch {}
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) throw new Error("Gemini returned empty response");
  return { text, status: res.status };
}

/** OpenAI-compatible caller (Groq, Cerebras, Together, Fireworks, OpenRouter) */
async function callOpenAICompat(
  provider: ProviderConfig,
  prompt: string,
  system: string | undefined,
  maxTokens: number
): Promise<CallResult> {
  const apiKey = provider.apiKey();
  if (!apiKey) throw Object.assign(
    new Error(`${provider.id.toUpperCase()}_API_KEY is not configured`),
    { skipProvider: true }
  );

  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const extraHeaders: Record<string, string> = {};
  if (provider.id === "openrouter") {
    extraHeaders["HTTP-Referer"] = "https://nonfiction-studio.replit.app";
    extraHeaders["X-Title"]      = "Nonfiction AI Studio";
  }

  const res = await fetch(provider.apiUrl, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify({ model: provider.model, messages, temperature: 0.7, max_tokens: maxTokens, stream: false })
  });

  const rawText = await res.text();
  if (!res.ok) {
    let errMsg = rawText.slice(0, 400);
    try {
      const d = JSON.parse(rawText);
      errMsg = d?.error?.message || (typeof d?.error === "string" ? d.error : errMsg);
    } catch {}
    throw Object.assign(new Error(errMsg), { httpStatus: res.status });
  }

  let data: any = {};
  try { data = JSON.parse(rawText); } catch {}
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error(`${provider.id} returned empty response`);
  return { text, status: res.status };
}

/** Dispatch to the correct caller for a given provider */
async function callProvider(
  provider: ProviderConfig,
  prompt: string,
  system: string | undefined,
  maxTokens: number
): Promise<string> {
  const { prompt: finalPrompt, maxTokens: finalMax } = ensureTokenBudget(prompt, maxTokens);
  const startMs = Date.now();

  let lastError = "";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 4000;
      console.log(`[AI] Retry ${attempt}/${MAX_RETRIES} for ${provider.id} in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      let result: CallResult;
      if (provider.id === "gemini") {
        result = await callGemini(finalPrompt, system, finalMax);
      } else {
        result = await callOpenAICompat(provider, finalPrompt, system, finalMax);
      }

      const elapsed = Date.now() - startMs;
      console.log(`[AI] ✓ ${provider.id} succeeded in ${elapsed}ms`);
      return result.text;

    } catch (e: any) {
      if (e?.skipProvider) throw e;  // misconfigured key — propagate immediately
      const httpStatus: number | undefined = e?.httpStatus;
      const msg = e?.message || String(e);
      lastError = msg;

      console.log(`HTTP STATUS: ${httpStatus ?? "unknown"} — ${provider.id}`);
      console.log(`ERROR BODY: ${msg.slice(0, 300)}`);

      // Hard errors — no point retrying
      if (isHardUnavailable(msg, httpStatus) || isQuotaExhausted(msg, httpStatus)) {
        throw Object.assign(e, { httpStatus });
      }

      // Transient — retry if attempts left
      if (attempt < MAX_RETRIES && isTransientError(msg, httpStatus)) continue;

      throw Object.assign(e, { httpStatus });
    }
  }

  throw new Error(`[${provider.id}] failed after ${MAX_RETRIES} retries: ${lastError}`);
}

// ─── Chain runner ──────────────────────────────────────────────────────────

export interface GenOptions {
  maxTokens?:         number;
  lowCredit?:         boolean;
  disabledProviders?: string[];
  onFallback?:        (info: { from: ProviderId; to: ProviderId; reason: string }) => void;
  onSuccess?:         (provider: ProviderId) => void;
}

export interface GenResult {
  text:               string;
  usedProvider:       ProviderId;
  exhaustedProviders: ProviderId[];
}

async function runChain(
  prompt: string,
  system: string | undefined,
  opts: GenOptions
): Promise<GenResult> {
  const clientDisabled   = new Set(opts.disabledProviders ?? []);
  const exhaustedProviders: ProviderId[] = [];
  const maxTokens = opts.lowCredit
    ? Math.min(opts.maxTokens ?? TOKEN_LIMITS.default, LOW_COST_TOKEN_CAP)
    : (opts.maxTokens ?? TOKEN_LIMITS.default);

  // Build eligible chain — only providers with configured keys
  const chain = PROVIDERS.filter((p) => Boolean(p.apiKey()));

  const activeIds = chain.map((p) => p.id).filter((id) => !clientDisabled.has(id));
  console.log("================================");
  console.log("ROUTER START");
  console.log(`[AI] Client-disabled: [${[...clientDisabled].join(", ") || "none"}]`);
  console.log(`[AI] Active providers: [${activeIds.join(", ")}]`);
  console.log("================================");

  const attempts: Array<{ id: ProviderId; error: string }> = [];
  let lastSuccessfulId: ProviderId | null = null;

  for (const provider of chain) {

    // ── Client-side disabled check ────────────────────────────────────────
    if (clientDisabled.has(provider.id)) {
      console.log(`[AI] Skipping ${provider.id} — disabled by user`);
      continue;
    }

    // ── Server-side cooldown check ────────────────────────────────────────
    if (isProviderDisabled(provider.id)) {
      const until    = providerDisabledUntil.get(provider.id) ?? 0;
      const minsLeft = Math.ceil((until - Date.now()) / 60000);
      console.log(`[AI] Skipping ${provider.id} — cooldown ~${minsLeft}min remaining`);
      continue;
    }

    console.log(`[AI] Trying: ${provider.id} (${provider.model})`);

    try {
      const text = await callProvider(provider, prompt, system, maxTokens);

      // Notify on fallback
      if (attempts.length > 0) {
        const prevId = attempts[attempts.length - 1].id;
        opts.onFallback?.({ from: prevId, to: provider.id, reason: "fallback" });
      }
      opts.onSuccess?.(provider.id);

      return { text, usedProvider: provider.id, exhaustedProviders };

    } catch (e: any) {
      const msg        = e?.message || String(e);
      const httpStatus = e?.httpStatus as number | undefined;

      if (e?.skipProvider) {
        console.log(`[AI] Skipping ${provider.id} — key not configured`);
        continue;
      }

      if (isQuotaExhausted(msg, httpStatus)) {
        console.log(`[AI] ${provider.id} quota exhausted — disabled 24h, switching to next provider`);
        disableProvider(provider.id, msg, "credit");
        exhaustedProviders.push(provider.id);
      } else if (isHardUnavailable(msg, httpStatus)) {
        const keyMsg = isInvalidKey(msg, httpStatus)
          ? `[AI] ⚠ ${provider.id} INVALID API KEY (HTTP ${httpStatus}) — check your ${provider.id.toUpperCase()}_API_KEY secret. Disabled 60min.`
          : `[AI] ${provider.id} hard unavailable (${httpStatus}) — disabled 60min`;
        console.log(keyMsg);
        disableProvider(provider.id, msg, "hard");
      } else if (isTransientError(msg, httpStatus)) {
        console.log(`[AI] ${provider.id} transient error — disabled 10min`);
        disableProvider(provider.id, msg, "rate_limit");
      } else {
        console.log(`[AI] ${provider.id} failed: ${msg.slice(0, 200)}`);
      }

      attempts.push({ id: provider.id, error: msg.slice(0, 100) });
    }
  }

  const enabledCount = activeIds.length;
  const hint = enabledCount === 0
    ? "No providers are currently enabled. Enable at least one provider in the AI Provider Status panel."
    : `All ${enabledCount} enabled provider${enabledCount === 1 ? "" : "s"} are unavailable (quota exhausted or offline). Wait for quotas to reset (up to 24h) or click "Reset all" in the provider status panel.`;
  throw new Error(`AI_EXHAUSTED:${attempts.length}:${hint}`);
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function generateContent(
  prompt: string,
  system?: string,
  opts: GenOptions = {}
): Promise<GenResult> {
  return runChain(prompt, system, opts);
}

export async function generateContentFast(
  prompt: string,
  system?: string,
  opts: GenOptions = {}
): Promise<GenResult> {
  return runChain(prompt, system, opts);
}

// ─── JSON extraction + repair ──────────────────────────────────────────────

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

  // If truncated mid-string, close the open string first before adding closers
  const strClose = inString ? '"' : "";
  const closers  = stack.slice().reverse().join("");

  if (lastChildEndPos > 0 && !inString) {
    try { return JSON.parse(s.slice(0, lastChildEndPos + 1) + closers); } catch { /* fall through */ }
  }
  try { return JSON.parse(s + strClose + closers); } catch { return null; }
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
