// Frontend AI fetch wrapper.
//
// Wraps POSTs to /api/ai/* and /api/book/* so they:
//   1. Surface the provider that produced the response (X-AI-Provider header)
//      via a tiny pub/sub bus → ProviderStatusBadge + auto-fallback toasts.
//   2. Handle 409 { needsApproval: "grok" } responses by showing the global
//      GrokApprovalModal; on approve, automatically retry with
//      body.allowGrok = true; on cancel, throw a cancellation error.
//   3. Inject lowCostMode: true when the user has enabled the low-cost toggle
//      (stored in localStorage), so the backend routes to the Gemini-first chain.
//
// Approval is also cached in localStorage so the user is only prompted once
// per browser unless they explicitly revoke it.

const APPROVAL_KEY  = "nonfiction-ai-grok-approval";
const LOW_COST_KEY  = "nonfiction-ai-low-cost-mode";

const PROVIDER_LABELS = {
  openai:    "GPT-4.1",
  anthropic: "Claude",
  xai:       "Grok",
  gemini:    "Gemini",
  llama:     "Llama 3.3"
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

let lastProvider = null;

function emitProviderUsed(provider) {
  if (!provider) return;
  if (lastProvider && lastProvider !== provider) {
    let message;
    if (provider === "xai") {
      message = "Switched to Grok (approved fallback).";
    } else if (provider === "llama") {
      message = "All primary providers busy — switched to Llama 3.3 (free fallback).";
    } else if (lastProvider === "llama") {
      message = `${providerLabel(provider)} is back — resumed primary chain.`;
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
    this.name  = "GenerationCanceledError";
    this.canceled = true;
  }
}

/**
 * POST JSON body to an AI endpoint, transparently handling:
 *   - Grok approval gate (HTTP 409)
 *   - Low-cost mode flag (injected from localStorage)
 *   - Provider tracking / fallback toasts
 *
 *   const data = await aiFetch("/api/ai/lesson", { ...body });
 *
 * Throws:
 *   - GenerationCanceledError when the user declines Grok approval
 *   - Error with .message from server on other failures
 */
export async function aiFetch(url, body = {}, { signal } = {}) {
  const doPost = async (extra) => {
    const merged = {
      ...body,
      ...(isLowCostMode()   ? { lowCostMode: true }  : {}),
      ...(isGrokApproved()  ? { allowGrok:   true }  : {}),
      ...extra
    };
    const res  = await fetch(url, {
      method: "POST",
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
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data   = data;
    throw err;
  }
  return data;
}
