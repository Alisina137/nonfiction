// Client-side model status store + React hook.
//
// Merges three sources of truth:
//   1. Server-polled status from GET /api/ai/model-status (every 3 min)
//   2. Client-tracked exhausted providers (from X-Exhausted-Providers headers,
//      written by aiFetch.jsx → localStorage EXHAUSTED_KEY with 24-hour TTL)
//   3. Manual user overrides (MANUAL_OFF_KEY localStorage, indefinite)

import { useEffect, useMemo, useRef, useState } from "react";
import {
  subscribeAiBus,
  getLocallyExhaustedProviders,
  getManuallyDisabledProviders,
  setManuallyDisabled,
  clearManuallyDisabledProviders,
  EXHAUSTED_KEY
} from "./aiFetch";

const SERVER_CACHE_KEY = "nonfiction-ai-server-status";
const POLL_INTERVAL_MS = 3 * 60 * 1000;

// ─── Static provider metadata (mirrors aiRouter.ts PROVIDERS array) ───────────

export const PROVIDER_DEFS = {
  gemini:     { label: "Gemini (Flash/Pro/Lite)",  model: "gemini-2.5-flash",                              order: 1 },
  groq:       { label: "Groq (Llama 3.3)",         model: "llama-3.3-70b-versatile",                       order: 2 },
  cerebras:   { label: "Cerebras (GPT-OSS 120B)",  model: "gpt-oss-120b",                                  order: 3 },
  openrouter: { label: "OpenRouter (multi-model)", model: "meta-llama/llama-3.3-70b-instruct:free",        order: 4 },
  sambanova:  { label: "SambaNova (Llama 3.3)",    model: "Meta-Llama-3.3-70B-Instruct",                  order: 5 }
};

export const PROVIDER_IDS = Object.keys(PROVIDER_DEFS);

// ─── Status merge logic ───────────────────────────────────────────────────────

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
    const hasKey           = srv.hasKey !== false;  // default true if server hasn't responded yet

    let status        = "available";
    let disabledUntil = null;

    if (!hasKey) {
      status = "no_key";
    } else if (isManual) {
      status = "manually_disabled";
    } else if (isServerDisabled || isLocalExhausted) {
      if (serverReason === "credit" || (isLocalExhausted && serverReason !== "hard" && serverReason !== "rate_limit")) {
        status        = "exhausted";
        disabledUntil = srv.disabledUntil || null;
      } else if (serverReason === "hard") {
        status        = "offline";
        disabledUntil = srv.disabledUntil || null;
      } else {
        status        = "rate_limited";
        disabledUntil = srv.disabledUntil || null;
      }
    }

    result[id] = {
      id,
      label:        def.label,
      model:        def.model,
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
  const [localTick,   setLocalTick]   = useState(0);
  const abortRef   = useRef(null);
  const expiryRef  = useRef(null);

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

  // Auto-expire locally-exhausted providers when their TTL runs out
  useEffect(() => {
    clearTimeout(expiryRef.current);
    try {
      const raw = window.localStorage.getItem(EXHAUSTED_KEY);
      if (!raw) return;
      const map = JSON.parse(raw);
      const now = Date.now();
      const upcoming = Object.values(map)
        .filter((exp) => exp > now)
        .sort((a, b) => a - b);
      if (!upcoming.length) return;
      const delay = upcoming[0] - now + 150;
      expiryRef.current = setTimeout(() => setLocalTick((t) => t + 1), delay);
    } catch {}
    return () => clearTimeout(expiryRef.current);
  }, [localTick]);

  function resetManualDisabled() {
    clearManuallyDisabledProviders();
    setManualDisabledState(new Set());
  }

  function toggleManualDisabled(providerId) {
    const currentStatus = buildMergedStatus(serverProviders, manualDisabled)[providerId]?.status;
    // Never allow toggling exhausted / offline / unconfigured models
    if (["exhausted", "offline", "no_key"].includes(currentStatus)) return;

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
    // localTick forces re-merge when a locally-exhausted provider's TTL expires
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serverProviders, manualDisabled, localTick]
  );

  const availableCount = Object.values(models).filter((m) => m.status === "available").length;
  const exhaustedCount = Object.values(models).filter(
    (m) => m.status === "exhausted" || m.status === "offline"
  ).length;

  return { models, availableCount, exhaustedCount, loading, lastRefresh, refresh, toggleManualDisabled, resetManualDisabled };
}
