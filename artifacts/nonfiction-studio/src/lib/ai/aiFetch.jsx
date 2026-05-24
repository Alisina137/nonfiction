// Frontend AI fetch wrapper.
//
// Wraps POSTs to /api/ai/* and /api/book/* so they:
//   1. Surface the provider that produced the response (X-AI-Provider header)
//      via a tiny pub/sub bus → ProviderStatusBadge + auto-fallback toasts.
//   2. Handle 409 { needsApproval: "grok" } responses by showing the global
//      GrokApprovalModal; on approve, automatically retry with
//      body.allowGrok = true; on cancel, throw a cancellation error.
//
// Approval is also cached in localStorage so the user is only prompted once
// per browser unless they explicitly revoke it.

const APPROVAL_KEY = "nonfiction-ai-grok-approval";

const PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Claude",
  xai: "Grok",
  gemini: "Gemini"
};

// ─── Tiny event bus ──────────────────────────────────────────────────────────

const listeners = {
  provider: new Set(),
  fallback: new Set(),
  approval: new Set()
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

// ─── Approval state ──────────────────────────────────────────────────────────

export function isGrokApproved() {
  try {
    return window.localStorage.getItem(APPROVAL_KEY) === "granted";
  } catch {
    return false;
  }
}

export function grantGrokApproval() {
  try { window.localStorage.setItem(APPROVAL_KEY, "granted"); } catch {}
}

export function revokeGrokApproval() {
  try { window.localStorage.removeItem(APPROVAL_KEY); } catch {}
}

// ─── Modal request gate ──────────────────────────────────────────────────────

let pendingApprovalResolver = null;

/**
 * Open the global Grok approval modal and resolve with the user's decision.
 * If a request is already pending, share the same promise.
 */
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
    if (lastProvider === "openai" && provider === "anthropic") {
      emit("fallback", {
        message: "OpenAI daily limit reached. Switched to Claude automatically.",
        from: lastProvider,
        to: provider
      });
    } else if (lastProvider === "anthropic" && provider === "openai") {
      emit("fallback", {
        message: "OpenAI is back online — resumed primary provider.",
        from: lastProvider,
        to: provider
      });
    } else if (provider === "xai") {
      emit("fallback", {
        message: "Generating with Grok (approved fallback).",
        from: lastProvider,
        to: provider
      });
    } else {
      emit("fallback", {
        message: `Switched provider: ${providerLabel(lastProvider)} → ${providerLabel(provider)}.`,
        from: lastProvider,
        to: provider
      });
    }
  }
  lastProvider = provider;
  emit("provider", { provider });
}

// ─── Main wrapper ────────────────────────────────────────────────────────────

export class GenerationCanceledError extends Error {
  constructor() {
    super("Generation canceled — Grok approval declined.");
    this.name = "GenerationCanceledError";
    this.canceled = true;
  }
}

/**
 * POST JSON body to an AI endpoint, transparently handling the Grok approval
 * gate (HTTP 409). Returns the parsed JSON payload on success.
 *
 *   const data = await aiFetch("/api/ai/lesson", { ...body });
 *
 * Throws:
 *   - GenerationCanceledError when the user declines Grok approval
 *   - Error with .message from server on other failures
 */
export async function aiFetch(url, body = {}, { signal } = {}) {
  const doPost = async (extra) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, ...extra }),
      signal
    });
    const provider = res.headers.get("X-AI-Provider");
    if (provider) emitProviderUsed(provider);
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  // First attempt — pre-attach allowGrok if the user already approved earlier.
  let { res, data } = await doPost(isGrokApproved() ? { allowGrok: true } : {});

  // 409 = server is asking for Grok permission.
  if (res.status === 409 && data?.needsApproval === "grok") {
    const approved = await requestGrokApproval({ attempted: data.attempted });
    if (!approved) throw new GenerationCanceledError();
    ({ res, data } = await doPost({ allowGrok: true }));
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
