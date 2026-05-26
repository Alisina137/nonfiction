// Frontend AI fetch wrapper.
//
// Wraps POSTs to /api/ai/* and /api/book/* so they:
//   1. Surface the provider that produced the response (X-AI-Provider header)
//      via a tiny pub/sub bus → ProviderStatusBadge + auto-fallback toasts.
//   2. Handle 409 { needsApproval: "grok" } responses by showing the global
//      GrokApprovalModal; on approve, automatically retry with
//      body.allowGrok = true; on cancel, throw a cancellation error.
//   3. Inject lowCostMode: true when the user has enabled the low-cost toggle
//      (stored in localStorage), routing backend calls to free-only providers.
//   4. Cache successful responses in localStorage (30-min TTL) so repeated
//      identical requests skip the API entirely.
//   5. Translate raw provider errors into friendly human-readable messages.

const APPROVAL_KEY  = "nonfiction-ai-grok-approval";
const LOW_COST_KEY  = "nonfiction-ai-low-cost-mode";
const CACHE_PREFIX  = "nonfiction-ai-cache-";
const CACHE_TTL_MS  = 30 * 60 * 1000; // 30 minutes

// URLs that should never be cached (user modifies existing text)
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
  provider: new Set(),
  fallback:  new Set(),
  approval:  new Set()
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

// ─── Response cache ───────────────────────────────────────────────────────────
// Simple hash: FNV-1a 32-bit over the cache key string.

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

function cacheKey(url, body) {
  // Exclude transient flags from cache key so the result is provider-agnostic
  const { allowGrok: _a, lowCostMode: _l, noCache: _n, ...stable } = body || {};
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
  } catch {
    // Storage quota exceeded — silently skip caching
  }
}

// ─── Friendly error messages ───────────────────────────────────────────────────

function friendlyError(rawMsg) {
  if (!rawMsg) return "AI generation failed. Please try again.";

  // Structured exhaustion error from our router
  if (/AI_EXHAUSTED/.test(rawMsg)) {
    const match = rawMsg.match(/AI_EXHAUSTED:\d+:(.+)/s);
    return match ? match[1].trim() : "All AI providers are currently unavailable. Try again in a few minutes.";
  }
  if (/rate.?limit|429|too.?many.?request/i.test(rawMsg))
    return "The AI provider is rate-limited. The system automatically tried backup providers.";
  if (/insufficient.?credit|credit|quota|billing/i.test(rawMsg))
    return "Your OpenRouter credits are low. Enable Low-cost mode (free models) to continue generating.";
  if (/no.?endpoint|endpoint.?not.?found|model.*unavailable/i.test(rawMsg))
    return "This AI model is temporarily unavailable. A backup provider is being tried automatically.";
  if (/timeout|timed.?out/i.test(rawMsg))
    return "The AI provider timed out. The system is retrying with a backup provider.";
  if (/OPENROUTER_API_KEY/i.test(rawMsg))
    return "OpenRouter API key is not configured. Check your environment secrets.";

  // If message is short and doesn't contain stack traces, show it directly
  if (rawMsg.length < 200 && !/at\s+\w+\s*\(/.test(rawMsg)) return rawMsg;

  return "AI generation failed. Please try again in a moment.";
}

// ─── Modal request gate ──────────────────────────────────────────────────────

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

// ─── Provider tracking ───────────────────────────────────────────────────────

const FREE_PROVIDERS = new Set(["llama", "deepseek", "gemini_free", "mistral"]);

let lastProvider = null;

function emitProviderUsed(provider) {
  if (!provider) return;
  if (lastProvider && lastProvider !== provider) {
    const fromFree = FREE_PROVIDERS.has(lastProvider);
    const toFree   = FREE_PROVIDERS.has(provider);
    let message;

    if (provider === "xai") {
      message = "Switched to Grok (approved fallback).";
    } else if (!fromFree && toFree) {
      message = `Paid providers busy — switched to ${providerLabel(provider)} automatically.`;
    } else if (fromFree && !toFree) {
      message = `${providerLabel(provider)} available — resumed quality mode.`;
    } else if (toFree) {
      message = `Trying ${providerLabel(provider)} (free backup)…`;
    } else {
      message = `Switched: ${providerLabel(lastProvider)} → ${providerLabel(provider)}.`;
    }
    emit("fallback", { message, from: lastProvider, to: provider });
  }
  lastProvider = provider;
  emit("provider", { provider });
}

// ─── Main wrapper ────────────────────────────────────────────────────────────

export class GenerationCanceledError extends Error {
  constructor() {
    super("Generation canceled — Grok approval declined.");
    this.name     = "GenerationCanceledError";
    this.canceled = true;
  }
}

/**
 * POST JSON body to an AI endpoint, transparently handling:
 *   - Response caching (localStorage, 30-min TTL)
 *   - Grok approval gate (HTTP 409)
 *   - Low-cost mode flag (routes to free-only provider chain)
 *   - Provider tracking / fallback toasts
 *   - Friendly error message translation
 *
 *   const data = await aiFetch("/api/ai/lesson", { ...body });
 *
 * Throws:
 *   - GenerationCanceledError when the user declines Grok approval
 *   - Error with .message (user-friendly) on other failures
 */
export async function aiFetch(url, body = {}, { signal, noCache } = {}) {
  const skipCache = noCache || NO_CACHE_PATHS.some((p) => url.startsWith(p)) || (body.noCache === true);

  // ── Cache read ──────────────────────────────────────────────────────────
  if (!skipCache) {
    const cached = getCache(url, body);
    if (cached) {
      console.log(`[aiFetch] cache hit: ${url}`);
      return cached;
    }
  }

  const doPost = async (extra) => {
    const merged = {
      ...body,
      ...(isLowCostMode()  ? { lowCostMode: true } : {}),
      ...(isGrokApproved() ? { allowGrok:   true } : {}),
      ...extra
    };
    const res  = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(merged),
      signal
    });
    const provider = res.headers.get("X-AI-Provider");
    if (provider) emitProviderUsed(provider);
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  let { res, data } = await doPost({});

  // 409 = server wants Grok approval before using it as fallback.
  if (res.status === 409 && data?.needsApproval === "grok") {
    const approved = await requestGrokApproval({ attempted: data.attempted });
    if (!approved) throw new GenerationCanceledError();
    ({ res, data } = await doPost({ allowGrok: true }));
  }

  if (!res.ok) {
    const raw = data?.error || `Request failed (${res.status})`;
    const err = new Error(friendlyError(raw));
    err.status = res.status;
    err.data   = data;
    err.rawMessage = raw;
    throw err;
  }

  // ── Cache write ─────────────────────────────────────────────────────────
  if (!skipCache) setCache(url, body, data);

  return data;
}
