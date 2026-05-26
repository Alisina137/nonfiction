// Frontend AI fetch wrapper.
//
// Wraps POSTs to /api/ai/* so they:
//   1. Surface the AI provider via X-AI-Provider header → event bus → ProviderStatusBadge.
//   2. Track credit exhaustion via X-Exhausted-Providers header → localStorage (4-hour TTL).
//   3. Include client-tracked exhausted + manually-disabled providers in every request
//      so the server skips them in the fallback chain.
//   4. Handle 409 { needsApproval: "grok" } → GrokApprovalModal → auto-retry.
//   5. Inject lowCostMode when the user has enabled the low-cost toggle.
//   6. Cache successful responses in localStorage (30-min TTL).
//   7. Translate raw provider errors into friendly human-readable messages.

const APPROVAL_KEY  = "nonfiction-ai-grok-approval";
const LOW_COST_KEY  = "nonfiction-ai-low-cost-mode";
const CACHE_PREFIX  = "nonfiction-ai-cache-";
const CACHE_TTL_MS  = 30 * 60 * 1000;

export const EXHAUSTED_KEY  = "nonfiction-ai-exhausted-local";   // { [provider]: expiresAt }
export const MANUAL_OFF_KEY = "nonfiction-ai-disabled-manual";   // [provider, ...]

const NO_CACHE_PATHS = ["/api/ai/improve"];

export const PROVIDER_LABELS = {
  openai:      "GPT-4.1",
  anthropic:   "Claude",
  xai:         "Grok",
  gemini:      "Gemini",
  llama:       "Llama (free)",
  deepseek:    "DeepSeek (free)",
  gemini_free: "Gemini (free)",
  mistral:     "Mistral (free)"
};

// ─── Tiny event bus ──────────────────────────────────────────────────────────

const listeners = {
  provider:  new Set(),
  fallback:  new Set(),
  approval:  new Set(),
  exhausted: new Set()   // { providers: string[] }
};

function emit(channel, payload) {
  for (const fn of listeners[channel]) {
    try { fn(payload); } catch (e) { console.error("[aiBus]", e); }
  }
}

export function subscribeAiBus(channel, fn) {
  listeners[channel].add(fn);
  return () => listeners[channel].delete(fn);
}

export function providerLabel(id) {
  return PROVIDER_LABELS[id] || id || "Unknown";
}

// ─── Grok approval state ─────────────────────────────────────────────────────

export function isGrokApproved() {
  try { return window.localStorage.getItem(APPROVAL_KEY) === "granted"; } catch { return false; }
}
export function grantGrokApproval() {
  try { window.localStorage.setItem(APPROVAL_KEY, "granted"); } catch {}
}
export function revokeGrokApproval() {
  try { window.localStorage.removeItem(APPROVAL_KEY); } catch {}
}

// ─── Low-cost mode state ─────────────────────────────────────────────────────

export function isLowCostMode() {
  try { return window.localStorage.getItem(LOW_COST_KEY) === "on"; } catch { return false; }
}
export function enableLowCostMode() {
  try { window.localStorage.setItem(LOW_COST_KEY, "on"); } catch {}
}
export function disableLowCostMode() {
  try { window.localStorage.removeItem(LOW_COST_KEY); } catch {}
}

// ─── Credit exhaustion tracking (localStorage) ────────────────────────────────
// Mirrors server-side tracking on the client with a 4-hour TTL.

export function getLocallyExhaustedProviders() {
  try {
    const raw = window.localStorage.getItem(EXHAUSTED_KEY);
    if (!raw) return [];
    const map = JSON.parse(raw);
    const now = Date.now();
    return Object.keys(map).filter((k) => map[k] > now);
  } catch { return []; }
}

export function markProvidersExhausted(providers) {
  if (!providers?.length) return;
  try {
    const raw = window.localStorage.getItem(EXHAUSTED_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const expiresAt = Date.now() + 4 * 60 * 60 * 1000;
    providers.forEach((p) => { map[p] = expiresAt; });
    // Prune expired
    const now = Date.now();
    Object.keys(map).forEach((k) => { if (map[k] <= now) delete map[k]; });
    window.localStorage.setItem(EXHAUSTED_KEY, JSON.stringify(map));
    emit("exhausted", { providers });
  } catch {}
}

// ─── Manual disable/enable ────────────────────────────────────────────────────

export function getManuallyDisabledProviders() {
  try {
    const raw = window.localStorage.getItem(MANUAL_OFF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function setManuallyDisabled(providerId, disabled) {
  try {
    const list = new Set(getManuallyDisabledProviders());
    if (disabled) list.add(providerId);
    else list.delete(providerId);
    window.localStorage.setItem(MANUAL_OFF_KEY, JSON.stringify([...list]));
  } catch {}
}

// ─── Response cache ────────────────────────────────────────────────────────────

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

function cacheKey(url, body) {
  const { allowGrok: _a, lowCostMode: _l, noCache: _n, disabledProviders: _d, ...stable } = body || {};
  return CACHE_PREFIX + hashStr(url + JSON.stringify(stable));
}

function getCache(url, body) {
  try {
    const k   = cacheKey(url, body);
    const raw = window.localStorage.getItem(k);
    if (!raw) return null;
    const { data, expires } = JSON.parse(raw);
    if (Date.now() > expires) { window.localStorage.removeItem(k); return null; }
    return data;
  } catch { return null; }
}

function setCache(url, body, data) {
  try {
    const k = cacheKey(url, body);
    window.localStorage.setItem(k, JSON.stringify({ data, expires: Date.now() + CACHE_TTL_MS }));
  } catch {}
}

// ─── Friendly error messages ──────────────────────────────────────────────────

function friendlyError(rawMsg) {
  if (!rawMsg) return "AI generation failed. Please try again.";

  if (/AI_EXHAUSTED/.test(rawMsg)) {
    const match = rawMsg.match(/AI_EXHAUSTED:\d+:(.+)/s);
    return match ? match[1].trim() : "All AI providers are currently unavailable. Try again in a few minutes.";
  }
  if (/rate.?limit|429|too.?many.?request/i.test(rawMsg))
    return "The AI provider is rate-limited. The system automatically tried backup providers.";
  if (/insufficient.?credit|can.?only.?afford|requires.?more.?credit|credit|quota|billing/i.test(rawMsg))
    return "Daily credits exhausted on this provider. The system is switching to an available backup automatically.";
  if (/no.?endpoint|endpoint.?not.?found|model.*unavailable/i.test(rawMsg))
    return "Model temporarily unavailable. A backup provider is being tried automatically.";
  if (/timeout|timed.?out/i.test(rawMsg))
    return "The AI provider timed out. The system is retrying with a backup provider.";
  if (/OPENROUTER_API_KEY/i.test(rawMsg))
    return "OpenRouter API key is not configured. Check your environment secrets.";
  if (rawMsg.length < 200 && !/at\s+\w+\s*\(/.test(rawMsg)) return rawMsg;
  return "AI generation failed. Please try again in a moment.";
}

// ─── Modal request gate ───────────────────────────────────────────────────────

let pendingApprovalResolver = null;

export function requestGrokApproval(meta = {}) {
  if (pendingApprovalResolver) return pendingApprovalResolver.promise;
  let resolveFn;
  const promise = new Promise((resolve) => { resolveFn = resolve; });
  pendingApprovalResolver = { promise, resolve: resolveFn };
  emit("approval", { open: true, meta });
  return promise;
}

export function resolveGrokApproval(approved) {
  if (!pendingApprovalResolver) return;
  const r = pendingApprovalResolver;
  pendingApprovalResolver = null;
  emit("approval", { open: false });
  if (approved) grantGrokApproval();
  r.resolve(approved);
}

// ─── Provider tracking ────────────────────────────────────────────────────────

const FREE_PROVIDERS = new Set(["llama", "deepseek", "gemini_free", "mistral"]);
let lastProvider = null;

function emitProviderUsed(provider) {
  if (!provider) return;
  if (lastProvider && lastProvider !== provider) {
    const fromFree = FREE_PROVIDERS.has(lastProvider);
    const toFree   = FREE_PROVIDERS.has(provider);
    let message;
    if (provider === "xai") {
      message = "Switching to Grok (approved fallback).";
    } else if (!fromFree && toFree) {
      message = `Paid providers busy — switching to ${providerLabel(provider)} automatically.`;
    } else if (fromFree && !toFree) {
      message = `${providerLabel(provider)} available — resumed quality mode.`;
    } else if (toFree) {
      message = `Trying ${providerLabel(provider)} (free backup)…`;
    } else {
      message = `Switching: ${providerLabel(lastProvider)} → ${providerLabel(provider)}.`;
    }
    emit("fallback", { message, from: lastProvider, to: provider });
  }
  lastProvider = provider;
  emit("provider", { provider });
}

// ─── Main fetch wrapper ───────────────────────────────────────────────────────

export class GenerationCanceledError extends Error {
  constructor() {
    super("Generation canceled — Grok approval declined.");
    this.name     = "GenerationCanceledError";
    this.canceled = true;
  }
}

/**
 * POST JSON body to an AI endpoint. Transparently handles:
 *   - Caching (localStorage, 30-min TTL)
 *   - Grok approval gate (HTTP 409)
 *   - Low-cost mode (routes to free-only provider chain)
 *   - Exhausted + manually-disabled providers (sent as disabledProviders[])
 *   - X-Exhausted-Providers response header → marks in localStorage
 *   - X-AI-Provider response header → updates status badge
 *   - Friendly error message translation
 */
export async function aiFetch(url, body = {}, { signal, noCache } = {}) {
  const skipCache = noCache || NO_CACHE_PATHS.some((p) => url.startsWith(p)) || (body.noCache === true);

  if (!skipCache) {
    const cached = getCache(url, body);
    if (cached) {
      console.log(`[aiFetch] cache hit: ${url}`);
      return cached;
    }
  }

  const doPost = async (extra) => {
    // Merge client-tracked exhausted + manual disables into every request
    const exhausted = getLocallyExhaustedProviders();
    const manual    = getManuallyDisabledProviders();
    const disabled  = [...new Set([...exhausted, ...manual])];

    const merged = {
      ...body,
      ...(isLowCostMode()  ? { lowCostMode:       true    } : {}),
      ...(isGrokApproved() ? { allowGrok:          true    } : {}),
      ...(disabled.length  ? { disabledProviders:  disabled } : {}),
      ...extra
    };

    const res  = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(merged),
      signal
    });

    // Track which provider succeeded
    const providerHeader = res.headers.get("X-AI-Provider");
    if (providerHeader) emitProviderUsed(providerHeader);

    // Track which providers were credit-exhausted during this call
    const exhaustedHeader = res.headers.get("X-Exhausted-Providers");
    if (exhaustedHeader) {
      const exhaustedList = exhaustedHeader.split(",").map((s) => s.trim()).filter(Boolean);
      if (exhaustedList.length) {
        markProvidersExhausted(exhaustedList);
        console.log(`[aiFetch] credit-exhausted providers tracked: ${exhaustedList.join(", ")}`);
      }
    }

    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  let { res, data } = await doPost({});

  // 409 = server wants Grok approval before using as fallback.
  if (res.status === 409 && data?.needsApproval === "grok") {
    const approved = await requestGrokApproval({ attempted: data.attempted });
    if (!approved) throw new GenerationCanceledError();
    ({ res, data } = await doPost({ allowGrok: true }));
  }

  if (!res.ok) {
    const raw = data?.error || `Request failed (${res.status})`;
    const err = new Error(friendlyError(raw));
    err.status     = res.status;
    err.data       = data;
    err.rawMessage = raw;
    throw err;
  }

  if (!skipCache) setCache(url, body, data);

  return data;
}
