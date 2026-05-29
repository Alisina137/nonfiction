// Client-side model status store + React hook.
//
// Merges three sources of truth:
//   1. Server-polled status from GET /api/ai/model-status (every 3 min)
//   2. Client-tracked exhausted providers (from X-Exhausted-Providers headers,
//      written by aiFetch.jsx → localStorage EXHAUSTED_KEY with 4-hour TTL)
//   3. Manual user overrides (MANUAL_OFF_KEY localStorage, indefinite)
//
// Non-React helpers (markProvidersExhausted, getLocallyExhaustedProviders,
// getManuallyDisabledProviders, setManuallyDisabled) live in aiFetch.jsx to
// avoid a circular import — aiFetch ← modelStatus ← aiFetch.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  subscribeAiBus,
  getLocallyExhaustedProviders,
  getManuallyDisabledProviders,
  setManuallyDisabled
} from "./aiFetch";

const SERVER_CACHE_KEY  = "nonfiction-ai-server-status";
const POLL_INTERVAL_MS  = 3 * 60 * 1000;  // poll every 3 minutes

// ─── Static provider metadata (matches aiRouter.ts) ──────────────────────────

export const PROVIDER_DEFS = {
  gemini:      { label: "Gemini 2.5 Flash",    model: "google/gemini-2.5-flash",                         tier: "paid",  order: 1 },
  openai:      { label: "GPT-4.1 Mini",        model: "openai/gpt-4.1-mini",                              tier: "paid",  order: 2 },
  anthropic:   { label: "Claude 3.7 Sonnet",   model: "anthropic/claude-3.7-sonnet",                      tier: "paid",  order: 7 },
  xai:         { label: "Grok Mini",           model: "x-ai/grok-3-mini-beta",                            tier: "paid",  order: 8 },
  deepseek:    { label: "DeepSeek (free)",     model: "deepseek/deepseek-chat-v3-0324:free",              tier: "free",  order: 3 },
  llama:       { label: "Llama 3.3 (free)",    model: "meta-llama/llama-3.3-70b-instruct:free",          tier: "free",  order: 4 },
  gemini_free: { label: "Gemini Flash (free)", model: "google/gemini-2.0-flash-exp:free",                tier: "free",  order: 5 },
  mistral:     { label: "Mistral (free)",      model: "mistralai/mistral-small-3.1-24b-instruct:free",   tier: "free",  order: 6 }
};

export const PROVIDER_IDS = Object.keys(PROVIDER_DEFS);

// ─── Status merge logic ───────────────────────────────────────────────────────

/**
 * Builds a merged status record from:
 *   serverProviders  — raw payload from GET /api/ai/model-status
 *   manualDisabledSet — Set of provider IDs the user has manually toggled off
 *
 * Each entry has:
 *   status: 'available' | 'exhausted' | 'rate_limited' | 'offline' | 'manually_disabled'
 *   disabledUntil: timestamp | null
 *   inFallback: boolean
 */
function buildMergedStatus(serverProviders, manualDisabledSet) {
  const now            = Date.now();
  const localExhausted = new Set(getLocallyExhaustedProviders());
  const result         = {};

  for (const id of PROVIDER_IDS) {
    const def = PROVIDER_DEFS[id];
    const srv = serverProviders[id] || {};

    const isManual         = manualDisabledSet.has(id);
    const isLocalExhausted = localExhausted.has(id);
    const isServerDisabled = srv.disabled && srv.disabledUntil && srv.disabledUntil > now;
    const serverReason     = srv.reason || null;

    let status       = "available";
    let disabledUntil = null;

    if (isManual) {
      status = "manually_disabled";
    } else if (isServerDisabled || isLocalExhausted) {
      if (serverReason === "credit" || (isLocalExhausted && serverReason !== "hard" && serverReason !== "rate_limit")) {
        status       = "exhausted";
        disabledUntil = srv.disabledUntil || null;
      } else if (serverReason === "hard") {
        status       = "offline";
        disabledUntil = srv.disabledUntil || null;
      } else {
        status       = "rate_limited";
        disabledUntil = srv.disabledUntil || null;
      }
    }

    result[id] = {
      id,
      label:        def.label,
      model:        def.model,
      tier:         def.tier,
      order:        def.order,
      status,
      disabledUntil,
      inFallback:   status === "available"
    };
  }
  return result;
}

// ─── React hook ───────────────────────────────────────────────────────────────

export function useModelStatus() {
  const [serverProviders, setServerProviders] = useState(() => {
    try {
      const raw = localStorage.getItem(SERVER_CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const [manualDisabled, setManualDisabledState] = useState(
    () => new Set(getManuallyDisabledProviders())
  );

  const [loading,     setLoading]     = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const abortRef = useRef(null);

  async function refresh() {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/model-status", { signal: ctrl.signal });
      if (!res.ok) return;
      const data      = await res.json();
      const providers = data.providers || {};
      setServerProviders(providers);
      setLastRefresh(Date.now());
      try { localStorage.setItem(SERVER_CACHE_KEY, JSON.stringify(providers)); } catch {}
    } catch (e) {
      if (e?.name !== "AbortError") console.warn("[modelStatus] refresh failed:", e?.message);
    } finally {
      setLoading(false);
    }
  }

  // Poll on mount + every 3 min
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => { clearInterval(id); abortRef.current?.abort(); };
  }, []);

  // Re-poll when aiFetch reports credit-exhausted providers
  useEffect(() => {
    const unsub = subscribeAiBus("exhausted", () => {
      setTimeout(refresh, 1500);
    });
    return unsub;
  }, []);

  function toggleManualDisabled(providerId) {
    const currentStatus = buildMergedStatus(serverProviders, manualDisabled)[providerId]?.status;
    // Never allow re-enabling exhausted / offline models — they reset automatically
    if (currentStatus === "exhausted" || currentStatus === "offline") return;

    setManualDisabledState((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
        setManuallyDisabled(providerId, false);
      } else {
        next.add(providerId);
        setManuallyDisabled(providerId, true);
      }
      return next;
    });
  }

  const models = useMemo(
    () => buildMergedStatus(serverProviders, manualDisabled),
    [serverProviders, manualDisabled]
  );

  const availableCount = Object.values(models).filter((m) => m.status === "available").length;
  const exhaustedCount = Object.values(models).filter(
    (m) => m.status === "exhausted" || m.status === "offline"
  ).length;

  return { models, availableCount, exhaustedCount, loading, lastRefresh, refresh, toggleManualDisabled };
}
