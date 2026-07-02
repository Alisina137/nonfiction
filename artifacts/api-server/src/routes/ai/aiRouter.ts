// ═══════════════════════════════════════════════════════════════════════════
// Multi-Provider AI Router — 5 independent providers, independent free quotas
// ═══════════════════════════════════════════════════════════════════════════
//
// PROVIDER CHAIN (both normal and low-cost mode — same order, same providers):
//   1. Gemini     — Google AI Studio  (GEMINI_API_KEY)
//   2. Groq       — Groq Cloud        (GROQ_API_KEY)
//   3. Cerebras   — Cerebras Cloud    (CEREBRAS_API_KEY)
//   4. OpenRouter — OpenRouter        (OPENROUTER_API_KEY)
//   5. SambaNova  — SambaNova Cloud   (SAMBANOVA_API_KEY)
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

export type ProviderId = "gemini" | "groq" | "cerebras" | "openrouter" | "sambanova";

export interface ProviderConfig {
  id:             ProviderId;
  label:          string;
  model:          string;
  fallbackModels?: string[];   // tried in order when primary model quota-exhausted
  apiUrl:         string;
  apiKey:         () => string | undefined;
  order:          number;
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
    id:             "groq",
    label:          "Groq (Llama 3.3)",
    model:          "llama-3.3-70b-versatile",
    fallbackModels: ["llama-3.1-8b-instant", "gemma2-9b-it"],
    apiUrl:         "https://api.groq.com/openai/v1/chat/completions",
    apiKey:         () => process.env.GROQ_API_KEY,
    order:          2
  },
  {
    id:             "cerebras",
    label:          "Cerebras (GPT-OSS 120B)",
    model:          "gpt-oss-120b",
    fallbackModels: ["zai-glm-4.7"],
    apiUrl:         "https://api.cerebras.ai/v1/chat/completions",
    apiKey:         () => process.env.CEREBRAS_API_KEY,
    order:          3
  },
  {
    id:             "openrouter",
    label:          "OpenRouter (multi-model)",
    model:          "nvidia/nemotron-3-super-120b-a12b:free",
    fallbackModels: [
      "openai/gpt-oss-120b:free",
      "google/gemma-4-31b-it:free",
      "meta-llama/llama-3.3-70b-instruct:free"
    ],
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: () => process.env.OPENROUTER_API_KEY,
    order:  4
  },
  {
    id:             "sambanova",
    label:          "SambaNova (Llama 3.3)",
    model:          "Meta-Llama-3.3-70B-Instruct",
    fallbackModels: ["Meta-Llama-3.1-8B-Instruct"],
    apiUrl:         "https://api.sambanova.ai/v1/chat/completions",
    apiKey:         () => process.env.SAMBANOVA_API_KEY,
    order:          5
  }
];

// ─── Task type → specialized model chain ─────────────────────────────────────
//
// Each phase of the book creation pipeline uses the model best suited for that
// task.  When a TaskType is set in GenOptions, runChain uses the task-specific
// provider order instead of the default PROVIDERS order.
//
// Providers that have no API key are automatically skipped at runtime.
// The same provider may specify model + fallbackModels so that one API key can
// serve multiple quality tiers (e.g. gemini-2.5-pro → gemini-2.5-flash).
//
// PHASE MAP:
//   idea     → Phase 1: Title / idea generation  (Gemini Flash primary)
//   research → Phase 2: Market / competitor analysis  (DeepSeek R1 primary)
//   outline  → Phase 3: Structure / outline  (Gemini Pro primary)
//   write    → Phase 4: Long-form prose  (Gemini Pro + 5-model pool)
//   edit     → Phase 5: Editing / improvement  (Llama 4 Maverick primary)
//   metadata → Phase 6: Description / SEO / metadata  (Gemini Flash-Lite primary)

export type TaskType = "idea" | "research" | "outline" | "write" | "edit" | "metadata";

interface ModelSpec {
  providerId:     ProviderId;
  model:          string;
  label:          string;
  fallbackModels?: string[];
}

export const TASK_CHAINS: Record<TaskType, ModelSpec[]> = {

  // ── Phase 1: Book idea & title generation ──────────────────────────────
  // Gemini Flash leads — fast creative ideation and marketable angles.
  idea: [
    { providerId: "gemini",     model: "gemini-2.5-flash",                              label: "Gemini Flash" },
    { providerId: "groq",       model: "llama-3.3-70b-versatile",                       label: "Groq",              fallbackModels: ["llama-3.1-8b-instant"] },
    { providerId: "openrouter", model: "google/gemma-4-31b-it:free",                    label: "Gemma 4",           fallbackModels: ["openai/gpt-oss-120b:free", "nvidia/nemotron-3-super-120b-a12b:free", "meta-llama/llama-3.3-70b-instruct:free"] },
    { providerId: "cerebras",   model: "gpt-oss-120b",                                  label: "Cerebras",          fallbackModels: ["zai-glm-4.7"] },
    { providerId: "sambanova",  model: "Meta-Llama-3.3-70B-Instruct",                   label: "SambaNova",         fallbackModels: ["Meta-Llama-3.1-8B-Instruct"] },
  ],

  // ── Phase 2: Market analysis & research ────────────────────────────────
  // Nemotron Ultra leads — large reasoning model for competitive intel.
  research: [
    { providerId: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free",        label: "Nemotron Super",    fallbackModels: ["openai/gpt-oss-120b:free", "google/gemma-4-31b-it:free", "meta-llama/llama-3.3-70b-instruct:free"] },
    { providerId: "gemini",     model: "gemini-2.5-pro",                                label: "Gemini Pro",        fallbackModels: ["gemini-2.5-flash"] },
    { providerId: "groq",       model: "llama-3.3-70b-versatile",                       label: "Groq",              fallbackModels: ["llama-3.1-8b-instant"] },
    { providerId: "cerebras",   model: "gpt-oss-120b",                                  label: "Cerebras",          fallbackModels: ["zai-glm-4.7"] },
    { providerId: "sambanova",  model: "Meta-Llama-3.3-70B-Instruct",                   label: "SambaNova",         fallbackModels: ["Meta-Llama-3.1-8B-Instruct"] },
  ],

  // ── Phase 3: Book structure & outline ─────────────────────────────────
  // Gemini Pro leads — excellent at hierarchical structure and chapter planning.
  outline: [
    { providerId: "gemini",     model: "gemini-2.5-pro",                                label: "Gemini Pro",        fallbackModels: ["gemini-2.5-flash"] },
    { providerId: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free",        label: "Nemotron Super",    fallbackModels: ["openai/gpt-oss-120b:free", "google/gemma-4-31b-it:free", "meta-llama/llama-3.3-70b-instruct:free"] },
    { providerId: "groq",       model: "llama-3.3-70b-versatile",                       label: "Groq",              fallbackModels: ["llama-3.1-8b-instant"] },
    { providerId: "cerebras",   model: "gpt-oss-120b",                                  label: "Cerebras",          fallbackModels: ["zai-glm-4.7"] },
    { providerId: "sambanova",  model: "Meta-Llama-3.3-70B-Instruct",                   label: "SambaNova",         fallbackModels: ["Meta-Llama-3.1-8B-Instruct"] },
  ],

  // ── Phase 4: Main content / prose writing ─────────────────────────────
  // Gemini Pro is the primary author; full 5-model fallback pool.
  write: [
    { providerId: "gemini",     model: "gemini-2.5-pro",                                label: "Gemini Pro",        fallbackModels: ["gemini-2.5-flash"] },
    { providerId: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free",        label: "Nemotron Super",    fallbackModels: ["openai/gpt-oss-120b:free", "google/gemma-4-31b-it:free", "meta-llama/llama-3.3-70b-instruct:free"] },
    { providerId: "sambanova",  model: "Meta-Llama-3.3-70B-Instruct",                   label: "SambaNova",         fallbackModels: ["Meta-Llama-3.1-8B-Instruct"] },
    { providerId: "cerebras",   model: "gpt-oss-120b",                                  label: "Cerebras",          fallbackModels: ["zai-glm-4.7"] },
    { providerId: "groq",       model: "llama-3.3-70b-versatile",                       label: "Groq",              fallbackModels: ["llama-3.1-8b-instant", "gemma2-9b-it"] },
  ],

  // ── Phase 5: Editing & quality improvement ─────────────────────────────
  // Gemini Pro leads; full fallback pool.
  edit: [
    { providerId: "gemini",     model: "gemini-2.5-pro",                                label: "Gemini Pro",        fallbackModels: ["gemini-2.5-flash"] },
    { providerId: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free",        label: "Nemotron Super",    fallbackModels: ["openai/gpt-oss-120b:free", "google/gemma-4-31b-it:free", "meta-llama/llama-3.3-70b-instruct:free"] },
    { providerId: "groq",       model: "llama-3.3-70b-versatile",                       label: "Groq",              fallbackModels: ["llama-3.1-8b-instant"] },
    { providerId: "cerebras",   model: "gpt-oss-120b",                                  label: "Cerebras",          fallbackModels: ["zai-glm-4.7"] },
    { providerId: "sambanova",  model: "Meta-Llama-3.3-70B-Instruct",                   label: "SambaNova",         fallbackModels: ["Meta-Llama-3.1-8B-Instruct"] },
  ],

  // ── Phase 6: Metadata generation ──────────────────────────────────────
  // Gemini Flash-Lite leads — fast, efficient for short SEO / description tasks.
  metadata: [
    { providerId: "gemini",     model: "gemini-2.5-flash-lite-preview-06-17",           label: "Gemini Flash-Lite", fallbackModels: ["gemini-2.5-flash"] },
    { providerId: "groq",       model: "llama-3.3-70b-versatile",                       label: "Groq",              fallbackModels: ["llama-3.1-8b-instant"] },
    { providerId: "openrouter", model: "google/gemma-4-31b-it:free",                    label: "Gemma 4",           fallbackModels: ["openai/gpt-oss-120b:free", "nvidia/nemotron-3-super-120b-a12b:free", "meta-llama/llama-3.3-70b-instruct:free"] },
    { providerId: "cerebras",   model: "gpt-oss-120b",                                  label: "Cerebras",          fallbackModels: ["zai-glm-4.7"] },
    { providerId: "sambanova",  model: "Meta-Llama-3.3-70B-Instruct",                   label: "SambaNova",         fallbackModels: ["Meta-Llama-3.1-8B-Instruct"] },
  ],
};

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);

const PROVIDER_BY_ID = Object.fromEntries(PROVIDERS.map((p) => [p.id, p])) as Record<ProviderId, ProviderConfig>;

// ─── Startup key warnings ──────────────────────────────────────────────────
(function warnMissingKeys() {
  for (const p of PROVIDERS) {
    if (!p.apiKey()) {
      console.warn(`[AI] WARNING: ${p.id.toUpperCase()}_API_KEY is not set — ${p.label} will be skipped in the provider chain.`);
    }
  }
})();

// Model lookup for external status consumers
export const MODEL_BY_PROVIDER = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p.model])
) as Record<ProviderId, string>;

// ─── Token budgets ─────────────────────────────────────────────────────────

export const TOKEN_LIMITS: Record<string, number> = {
  title:              1500,
  subtitle:           1200,
  regenTitle:          250,
  outline:            3000,
  transformationPlan: 1200,
  lesson:             6000,
  improve:             900,
  description:         900,
  cover:               600,
  analysis:            500,
  architecturePreview: 500,
  structure:           400,
  details:            2500,
  authorPersona:      3500,
  strategicPlan:      3500,
  bookSection:        1500,
  sectionGen:         1800,
  conceptGen:         2000,
  fieldSuggestion:    1200,
  subsectionGen:       900,
  chapterStrategy:    1200,
  competitiveIntel:   4000,
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
  // Only treat as true daily credit exhaustion when the error message confirms it.
  // A bare HTTP 429 on a free model is usually a per-model rate limit, NOT a daily
  // credit exhaustion — don't burn a 24h cooldown for a simple rate limit.
  return /quota.?exceed|daily.?limit|rate.?limit.?reached|insufficient.?credit|out.?of.?credit|credit.?exhaust|free.?tier.?exhaust|daily.?quota|resource.?exhaust|RESOURCE_EXHAUSTED/i.test(msg || "");
}

function isRateLimit(msg: string, status?: number): boolean {
  // HTTP 429 without credit-exhaustion language = transient rate limit (10 min)
  if (status === 429) return true;
  return /rate.?limit|too.?many.?request/i.test(msg || "");
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
  maxTokens: number,
  model = "gemini-2.5-flash"
): Promise<CallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw Object.assign(new Error("GEMINI_API_KEY is not configured"), { skipProvider: true });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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

  // OpenRouter supports a `models` array for provider-level fallback routing.
  // When the primary model is rate-limited, OpenRouter automatically tries the next.
  // NOTE: OpenRouter rejects requests where `models` has more than 3 entries
  // ("'models' array must have 3 items or fewer"), so cap it here.
  const requestBody = provider.id === "openrouter" && provider.fallbackModels?.length
    ? {
        models:      [provider.model, ...provider.fallbackModels].slice(0, 3),
        route:       "fallback",
        messages,
        temperature: 0.7,
        max_tokens:  maxTokens,
        stream:      false
      }
    : { model: provider.model, messages, temperature: 0.7, max_tokens: maxTokens, stream: false };

  const res = await fetch(provider.apiUrl, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify(requestBody)
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
  const msg  = data?.choices?.[0]?.message;
  // Reasoning models (Cerebras gpt-oss-120b, zai-glm-4.7) put output in `reasoning`
  // when max_tokens is tight; prefer `content`, fall back to `reasoning`.
  const text = msg?.content || msg?.reasoning || "";
  if (!text) throw new Error(`${provider.id} returned empty response`);
  return { text, status: res.status };
}

/** Dispatch to the correct caller for a given provider, with per-model fallback on quota exhaustion.
 *
 * @param modelOverride        - Override the provider's default primary model
 * @param fallbackModelsOverride - Override the provider's default fallback model list
 * @returns { text, modelUsed } — the generated text and the model that produced it
 */
async function callProvider(
  provider: ProviderConfig,
  prompt: string,
  system: string | undefined,
  maxTokens: number,
  modelOverride?: string,
  fallbackModelsOverride?: string[]
): Promise<{ text: string; modelUsed: string }> {

  // Build an effective provider config with any task-specific overrides applied.
  const effectiveProvider: ProviderConfig = {
    ...provider,
    model:          modelOverride          ?? provider.model,
    fallbackModels: fallbackModelsOverride ?? provider.fallbackModels
  };

  const { prompt: finalPrompt, maxTokens: finalMax } = ensureTokenBudget(prompt, maxTokens);
  const startMs = Date.now();

  // All providers (including OpenRouter) iterate through fallback models manually here.
  // For OpenRouter's PRIMARY call we still send the `models` array so their router can
  // pick the best available — but if that call fails hard (e.g. model removed from free
  // tier), we fall through to the individual fallback models one-by-one ourselves.
  const modelsToTry = [effectiveProvider.model, ...(effectiveProvider.fallbackModels ?? [])];

  let lastQuotaError: any = null;

  for (let modelIdx = 0; modelIdx < modelsToTry.length; modelIdx++) {
    const currentModel = modelsToTry[modelIdx];
    // For OpenRouter fallback iterations (modelIdx > 0) send a single-model request
    // rather than the full `models` array — the primary model may be gone and we
    // don't want it included in the fallback attempt.
    const activeProvider = {
      ...effectiveProvider,
      model: currentModel,
      fallbackModels: (effectiveProvider.id === "openrouter" && modelIdx > 0)
        ? []
        : effectiveProvider.fallbackModels,
    };

    if (modelIdx > 0) {
      console.log(`[AI] ${provider.id}: primary model quota exhausted — trying fallback model "${currentModel}"`);
    }

    let modelQuotaExhausted = false;
    let lastError = "";

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = RETRY_DELAYS_MS[attempt - 1] ?? 4000;
        console.log(`[AI] Retry ${attempt}/${MAX_RETRIES} for ${provider.id}/${currentModel} in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
      }

      try {
        let result: CallResult;
        if (provider.id === "gemini") {
          result = await callGemini(finalPrompt, system, finalMax, currentModel);
        } else {
          result = await callOpenAICompat(activeProvider, finalPrompt, system, finalMax);
        }

        const elapsed = Date.now() - startMs;
        const modelTag = modelIdx > 0 ? ` (fallback: ${currentModel})` : "";
        console.log(`[AI] ✓ ${provider.id}${modelTag} — model: ${currentModel} — ${elapsed}ms`);
        return { text: result.text, modelUsed: currentModel };

      } catch (e: any) {
        if (e?.skipProvider) throw e;  // misconfigured key — propagate immediately
        const httpStatus: number | undefined = e?.httpStatus;
        const msg = e?.message || String(e);
        lastError = msg;

        console.log(`HTTP STATUS: ${httpStatus ?? "unknown"} — ${provider.id}/${currentModel}`);
        console.log(`ERROR BODY: ${msg.slice(0, 300)}`);

        // Hard errors — if there are still fallback models to try, skip to the next
        // one instead of killing the whole provider. This handles cases like
        // OpenRouter returning 404 for a specific free-tier model being removed.
        if (isHardUnavailable(msg, httpStatus)) {
          const hasMoreModels = modelIdx < modelsToTry.length - 1;
          if (hasMoreModels) {
            console.log(`[AI] ${provider.id}/${currentModel} model unavailable (${httpStatus}) — skipping to next fallback`);
            modelQuotaExhausted = true;
            break;
          }
          throw Object.assign(e, { httpStatus });
        }

        // Quota exhausted — move to next fallback model instead of retrying
        if (isQuotaExhausted(msg, httpStatus)) {
          const hasMore = modelIdx < modelsToTry.length - 1;
          console.log(`[AI] ${provider.id}/${currentModel} quota exhausted${hasMore ? " — trying next fallback model" : " — all models exhausted"}`);
          lastQuotaError = Object.assign(e, { httpStatus });
          modelQuotaExhausted = true;
          break;
        }

        // Transient — retry if attempts left
        if (attempt < MAX_RETRIES && isTransientError(msg, httpStatus)) continue;

        throw Object.assign(e, { httpStatus });
      }
    }

    if (!modelQuotaExhausted) {
      throw new Error(`[${provider.id}/${currentModel}] failed after ${MAX_RETRIES} retries: ${lastError}`);
    }
  }

  throw lastQuotaError ?? Object.assign(new Error(`[${provider.id}] all models quota exhausted`), { httpStatus: 429 });
}

// ─── Chain runner ──────────────────────────────────────────────────────────

export interface GenOptions {
  maxTokens?:         number;
  lowCredit?:         boolean;
  disabledProviders?: string[];
  preferredProvider?: string;
  taskType?:          TaskType;
  onFallback?:        (info: { from: ProviderId; to: ProviderId; reason: string }) => void;
  onSuccess?:         (provider: ProviderId) => void;
}

export interface GenResult {
  text:               string;
  usedProvider:       ProviderId;
  usedModel:          string;
  exhaustedProviders: ProviderId[];
}

async function runChain(
  prompt: string,
  system: string | undefined,
  opts: GenOptions
): Promise<GenResult> {
  const clientDisabled    = new Set(opts.disabledProviders ?? []);
  const { taskType }      = opts;
  const exhaustedProviders: ProviderId[] = [];
  const maxTokens = opts.lowCredit
    ? Math.min(opts.maxTokens ?? TOKEN_LIMITS.default, LOW_COST_TOKEN_CAP)
    : (opts.maxTokens ?? TOKEN_LIMITS.default);

  // ── Build typed chain items with model overrides ──────────────────────────
  //
  // Each item carries: the provider config + the specific model to use + its
  // fallback models for that task.  This lets one provider key serve different
  // model tiers depending on the task (e.g. gemini-2.5-pro for outline writing,
  // gemini-2.5-flash-lite for metadata).

  interface ChainItem {
    provider:      ProviderConfig;
    model:         string;
    fallbackModels: string[];
    label:         string;
  }

  let chainItems: ChainItem[];

  if (taskType && TASK_CHAINS[taskType]) {
    // ── Task-specific chain ───────────────────────────────────────────────
    // Process specs in the task's defined order.  Each provider appears at most
    // once (first occurrence wins); providers without API keys are skipped.
    const seen = new Set<ProviderId>();
    chainItems  = [];
    for (const spec of TASK_CHAINS[taskType]) {
      const p = PROVIDER_BY_ID[spec.providerId];
      if (!p || !p.apiKey()) continue;
      if (seen.has(p.id))    continue;
      seen.add(p.id);
      chainItems.push({
        provider:       p,
        model:          spec.model,
        fallbackModels: spec.fallbackModels ?? [],
        label:          spec.label
      });
    }
  } else {
    // ── Default chain ─────────────────────────────────────────────────────
    // Use PROVIDERS order; respect the client's preferred-provider hint.
    let providers = PROVIDERS.filter((p) => Boolean(p.apiKey()));
    const preferred = opts.preferredProvider as ProviderId | undefined;
    if (preferred && PROVIDER_BY_ID[preferred]) {
      const pref = providers.find((p) => p.id === preferred);
      if (pref) providers = [pref, ...providers.filter((p) => p.id !== preferred)];
    }
    chainItems = providers.map((p) => ({
      provider:       p,
      model:          p.model,
      fallbackModels: p.fallbackModels ?? [],
      label:          p.label
    }));
  }

  const activeLabels = chainItems
    .filter((c) => !clientDisabled.has(c.provider.id))
    .map((c) => c.label);

  console.log("================================");
  console.log("ROUTER START");
  if (taskType)  console.log(`[AI] Task:     ${taskType}`);
  console.log(`[AI] Chain:    [${activeLabels.join(", ")}]`);
  console.log(`[AI] Disabled: [${[...clientDisabled].join(", ") || "none"}]`);
  console.log("================================");

  const attempts: Array<{ id: ProviderId; error: string }> = [];

  for (const { provider, model, fallbackModels, label } of chainItems) {

    // ── Client-side disabled check ────────────────────────────────────────
    if (clientDisabled.has(provider.id)) {
      console.log(`[AI] Skipping ${label} — disabled by user`);
      continue;
    }

    // ── Server-side cooldown check ────────────────────────────────────────
    if (isProviderDisabled(provider.id)) {
      const until    = providerDisabledUntil.get(provider.id) ?? 0;
      const minsLeft = Math.ceil((until - Date.now()) / 60000);
      console.log(`[AI] Skipping ${label} — cooldown ~${minsLeft}min remaining`);
      continue;
    }

    console.log(`[AI] Trying: ${label} (model: ${model})`);

    try {
      const { text, modelUsed } = await callProvider(
        provider, prompt, system, maxTokens, model, fallbackModels
      );

      if (attempts.length > 0) {
        const prevId = attempts[attempts.length - 1].id;
        opts.onFallback?.({ from: prevId, to: provider.id, reason: "fallback" });
      }
      opts.onSuccess?.(provider.id);

      return { text, usedProvider: provider.id, usedModel: modelUsed, exhaustedProviders };

    } catch (e: any) {
      const msg        = e?.message || String(e);
      const httpStatus = e?.httpStatus as number | undefined;

      if (e?.skipProvider) {
        console.log(`[AI] Skipping ${label} — key not configured`);
        continue;
      }

      if (isQuotaExhausted(msg, httpStatus)) {
        console.log(`[AI] ${label} daily quota exhausted — disabled 24h, switching to next provider`);
        disableProvider(provider.id, msg, "credit");
        exhaustedProviders.push(provider.id);
      } else if (isRateLimit(msg, httpStatus)) {
        // HTTP 429 without credit-exhaustion language = transient rate limit
        console.log(`[AI] ${label} rate limited (429) — disabled 10min, switching to next provider`);
        disableProvider(provider.id, msg, "rate_limit");
        exhaustedProviders.push(provider.id);
      } else if (isHardUnavailable(msg, httpStatus)) {
        const keyMsg = isInvalidKey(msg, httpStatus)
          ? `[AI] ⚠ ${label} INVALID API KEY (HTTP ${httpStatus}) — check your ${provider.id.toUpperCase()}_API_KEY secret. Disabled 60min.`
          : `[AI] ${label} hard unavailable (${httpStatus}) — disabled 60min`;
        console.log(keyMsg);
        disableProvider(provider.id, msg, "hard");
      } else if (isTransientError(msg, httpStatus)) {
        console.log(`[AI] ${label} transient error — disabled 10min`);
        disableProvider(provider.id, msg, "rate_limit");
      } else {
        console.log(`[AI] ${label} failed: ${msg.slice(0, 200)}`);
      }

      attempts.push({ id: provider.id, error: msg.slice(0, 100) });
    }
  }

  const enabledCount = activeLabels.length;
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

  // Strip trailing comma that would produce invalid `{"key": "val", }` JSON
  const base = inString ? s : s.replace(/,\s*$/, "");
  try { return JSON.parse(base + strClose + closers); } catch { return null; }
}

/**
 * Escape literal newlines / tabs / carriage returns inside JSON string values.
 * AI models (especially Groq / Llama) often emit multi-line prose directly
 * inside JSON strings, which is invalid JSON but extremely common.
 */
function sanitizeJsonNewlines(raw: string): string {
  let result  = "";
  let inStr   = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (escaped)         { result += c; escaped = false; continue; }
    if (c === "\\" && inStr) { result += c; escaped = true; continue; }
    if (c === '"')       { inStr = !inStr; result += c; continue; }
    if (inStr) {
      if (c === "\n")    { result += "\\n";  continue; }
      if (c === "\r")    { result += "\\r";  continue; }
      if (c === "\t")    { result += "\\t";  continue; }
    }
    result += c;
  }
  return result;
}

export function extractJSON(text: string): any {
  // Pre-strip code fences so all downstream logic sees clean text.
  // Handles: ```json...```, ```...```, unclosed fences, and mixed-case tags.
  let t = String(text || "").trim()
    .replace(/^```[a-zA-Z]*\r?\n?/, "")  // strip opening fence + optional lang tag
    .replace(/\r?\n?```\s*$/, "")         // strip closing fence
    .trim();

  // ── 1. Direct parse (fast path) ───────────────────────────────────────
  try { return JSON.parse(t); } catch { /* fall through */ }

  // ── 2. Sanitize unescaped newlines inside strings, then retry ─────────
  // Groq / Llama frequently emit literal newlines inside JSON string values.
  const sanitized = sanitizeJsonNewlines(t);
  try { return JSON.parse(sanitized); } catch { /* fall through */ }

  // ── 3. Repair truncated JSON ──────────────────────────────────────────
  const r0 = repairTruncatedJSON(sanitized);
  if (r0 !== null) return r0;

  // ── 4. Find first { or [ and retry from there ─────────────────────────
  const objStart = sanitized.indexOf("{");
  const arrStart = sanitized.indexOf("[");
  const start =
    objStart === -1 ? arrStart :
    arrStart === -1 ? objStart :
    Math.min(objStart, arrStart);

  if (start !== -1) {
    const raw = sanitized.slice(start);
    try { return JSON.parse(raw); } catch { /* fall through */ }
    const r = repairTruncatedJSON(raw);
    if (r !== null) return r;
  }

  throw new Error(`Could not parse JSON from AI response: ${t.slice(0, 200)}`);
}
