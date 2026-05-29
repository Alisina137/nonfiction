import { useEffect, useRef, useState } from "react";
import {
  subscribeAiBus,
  providerLabel,
  isLowCostMode,
  enableLowCostMode,
  disableLowCostMode,
  resetAllProviders
} from "@/lib/ai/aiFetch";
import { useModelStatus, PROVIDER_DEFS } from "@/lib/ai/modelStatus";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeRemaining(until) {
  if (!until) return "";
  const ms = until - Date.now();
  if (ms <= 0) return "";
  const h = Math.floor(ms / 3600000);
  const m = Math.ceil((ms % 3600000) / 60000);
  if (h >= 1) return `~${h}h ${m}m`;
  return `~${m}m`;
}

function StatusDot({ status }) {
  const cls = {
    available:         "bg-emerald-400",
    exhausted:         "bg-red-400",
    offline:           "bg-red-400",
    rate_limited:      "bg-amber-400",
    manually_disabled: "bg-slate-300"
  }[status] || "bg-slate-300";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

function statusLabel(m) {
  if (m.status === "available")         return "Available";
  if (m.status === "manually_disabled") return "Disabled";
  if (m.status === "exhausted") {
    const left = timeRemaining(m.disabledUntil);
    return left ? `Credits exhausted · resets in ${left}` : "Credits exhausted";
  }
  if (m.status === "offline") {
    const left = timeRemaining(m.disabledUntil);
    return left ? `Offline · back in ${left}` : "Offline";
  }
  if (m.status === "rate_limited") {
    const left = timeRemaining(m.disabledUntil);
    return left ? `Rate limited · back in ${left}` : "Rate limited";
  }
  return m.status;
}

function statusTextColor(status) {
  if (status === "available")         return "text-emerald-700";
  if (status === "exhausted")         return "text-red-600";
  if (status === "offline")           return "text-red-600";
  if (status === "rate_limited")      return "text-amber-600";
  if (status === "manually_disabled") return "text-slate-400";
  return "text-slate-500";
}

const PROVIDER_COLOR = {
  openai:      "bg-emerald-100 text-emerald-800 border-emerald-200",
  anthropic:   "bg-amber-100   text-amber-800   border-amber-200",
  xai:         "bg-violet-100  text-violet-800  border-violet-200",
  gemini:      "bg-sky-100     text-sky-800     border-sky-200",
  llama:       "bg-orange-100  text-orange-800  border-orange-200",
  deepseek:    "bg-teal-100    text-teal-800    border-teal-200",
  gemini_free: "bg-cyan-100    text-cyan-800    border-cyan-200",
  mistral:     "bg-rose-100    text-rose-800    border-rose-200"
};

function Toggle({ on, onToggle, label, activeClass, title, disabled: btnDisabled }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={btnDisabled}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        btnDisabled
          ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
          : on
            ? activeClass
            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span
        className={`relative inline-flex h-3.5 w-6 shrink-0 items-center rounded-full transition-colors ${
          on && !btnDisabled ? "bg-current opacity-80" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute h-2.5 w-2.5 rounded-full bg-white shadow transition-transform ${
            on && !btnDisabled ? "translate-x-2.5" : "translate-x-0.5"
          }`}
        />
      </span>
      {label}
    </button>
  );
}

// ─── Model list row ───────────────────────────────────────────────────────────

function ModelRow({ m, onToggle }) {
  const canToggle = m.status !== "exhausted" && m.status !== "offline";
  const isOn      = m.status === "available";

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <StatusDot status={m.status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[12px] font-semibold text-slate-800">{m.label}</span>
          {m.tier === "free" && (
            <span className="text-[10px] font-medium text-slate-400">free</span>
          )}
        </div>
        <p className={`mt-px text-[11px] leading-tight ${statusTextColor(m.status)}`}>
          {statusLabel(m)}
        </p>
      </div>

      {/* Manual enable/disable toggle — locked when exhausted/offline */}
      <button
        type="button"
        disabled={!canToggle}
        onClick={() => canToggle && onToggle(m.id)}
        title={
          !canToggle
            ? "Automatically re-enables when credits reset"
            : isOn
              ? `Disable ${m.label}`
              : `Enable ${m.label}`
        }
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
          !canToggle
            ? "cursor-not-allowed border-slate-100 bg-slate-100"
            : isOn
              ? "border-emerald-500 bg-emerald-500"
              : "border-slate-300 bg-slate-200"
        }`}
      >
        <span
          className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            isOn ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProviderStatusBadge() {
  const [activeProvider, setActiveProvider] = useState(null);
  const [toast,          setToast]          = useState(null);
  const [lowCostOn,      setLowCostOn]      = useState(() => isLowCostMode());
  const [panelOpen,      setPanelOpen]      = useState(false);
  const [resetting,      setResetting]      = useState(false);
  const panelRef  = useRef(null);
  const btnRef    = useRef(null);

  const { models, availableCount, loading, lastRefresh, refresh, toggleManualDisabled } = useModelStatus();

  // Bus subscriptions
  useEffect(() => {
    const unsubP = subscribeAiBus("provider", ({ provider }) => setActiveProvider(provider));
    const unsubF = subscribeAiBus("fallback", ({ message }) => {
      setToast({ message, id: Date.now() });
    });
    const unsubE = subscribeAiBus("exhausted", ({ providers }) => {
      const names = providers.map((p) => PROVIDER_DEFS[p]?.label || p).join(", ");
      setToast({
        message: `Daily credits exhausted for ${names}. Switching to next available model.`,
        id: Date.now(),
        kind: "warn"
      });
    });
    return () => { unsubP(); unsubF(); unsubE(); };
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return;
    function handleClick(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [panelOpen]);

  function toggleLowCost() {
    if (lowCostOn) {
      disableLowCostMode();
      setLowCostOn(false);
      setToast({ message: "Quality mode on — using paid AI providers (GPT-4.1 / Claude / Gemini).", id: Date.now() });
    } else {
      enableLowCostMode();
      setLowCostOn(true);
      setToast({ message: "Low-cost mode on — using free AI providers only (DeepSeek, Llama, Mistral).", id: Date.now() });
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await resetAllProviders();
      await refresh();
      setToast({ message: "All provider states reset — every model is now available.", id: Date.now() });
    } catch {
      setToast({ message: "Reset failed. Try refreshing the page.", id: Date.now(), kind: "warn" });
    } finally {
      setResetting(false);
    }
  }

  const label      = activeProvider ? providerLabel(activeProvider) : "Idle";
  const colorClass = activeProvider
    ? (PROVIDER_COLOR[activeProvider] || "bg-slate-100 text-slate-700 border-slate-200")
    : "bg-slate-50 text-slate-500 border-slate-200";

  const totalCount = 8;
  const paidModels = Object.values(models).filter((m) => m.tier === "paid").sort((a, b) => a.order - b.order);
  const freeModels = Object.values(models).filter((m) => m.tier === "free").sort((a, b) => a.order - b.order);

  const statusSummaryColor =
    availableCount >= 6 ? "text-emerald-700" :
    availableCount >= 3 ? "text-amber-700"   :
    "text-red-600";

  return (
    <>
      <div className="relative flex items-center gap-2">
        {/* Current provider badge */}
        <div
          title={activeProvider ? `Active AI: ${label}` : "No AI calls yet this session"}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${colorClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${activeProvider ? "bg-current" : "bg-slate-400"}`} />
          {activeProvider ? `${label}` : "AI idle"}
        </div>

        {/* Model status button */}
        <div className="relative">
          <button
            ref={btnRef}
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            title="View all AI model availability"
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              panelOpen
                ? "border-sky-300 bg-sky-50 text-sky-800"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className={`font-bold tabular-nums ${statusSummaryColor}`}>{availableCount}</span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-500">{totalCount}</span>
            <span className="ml-0.5 text-slate-400">▾</span>
          </button>

          {/* Dropdown panel */}
          {panelOpen && (
            <div
              ref={panelRef}
              className="absolute left-0 top-full z-[200] mt-2 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-[12px] font-bold text-slate-800">AI Model Status</p>
                  {lastRefresh && (
                    <p className="text-[10px] text-slate-400">
                      Updated {Math.round((Date.now() - lastRefresh) / 1000)}s ago
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => refresh()}
                  disabled={loading}
                  title="Refresh model availability"
                  className="rounded-lg border border-slate-200 p-1 text-slate-400 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-40"
                >
                  <svg
                    className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M13.65 2.35A8 8 0 1 0 15 8h-1.5a6.5 6.5 0 1 1-1.15-3.74l-1.71 1.71A1 1 0 0 0 11 7.5h4A.5.5 0 0 0 15.5 7V3a1 1 0 0 0-1.7-.71l-1.15 1.06Z" />
                  </svg>
                </button>
              </div>

              <div className="px-4 py-2">
                {/* Paid models */}
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Paid · Normal mode
                </p>
                <div className="divide-y divide-slate-50">
                  {paidModels.map((m) => (
                    <ModelRow key={m.id} m={m} onToggle={toggleManualDisabled} />
                  ))}
                </div>

                {/* Free models */}
                <p className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Free · Low-cost mode
                </p>
                <div className="divide-y divide-slate-50">
                  {freeModels.map((m) => (
                    <ModelRow key={m.id} m={m} onToggle={toggleManualDisabled} />
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between rounded-b-2xl border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                <span className="text-[11px] text-slate-500">
                  <span className={`font-bold ${statusSummaryColor}`}>{availableCount}</span>
                  <span> of {totalCount} models active</span>
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={resetting}
                  title="Reset all provider states — clears exhausted and disabled flags"
                  className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                >
                  {resetting ? "Resetting…" : "Reset all"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Low-cost mode toggle */}
        <Toggle
          on={lowCostOn}
          onToggle={toggleLowCost}
          label="Low-cost"
          activeClass="border-teal-300 bg-teal-100 text-teal-800 hover:bg-teal-200"
          title={
            lowCostOn
              ? "Low-cost mode: free providers only (DeepSeek → Llama → Gemini free → Mistral). Click to switch back to Quality mode."
              : "Enable Low-cost mode: use only free AI providers. Saves OpenRouter credits."
          }
        />

      </div>

      {/* Toast notifications */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[110] flex justify-center px-4">
          <div className={`pointer-events-auto inline-flex max-w-md items-start gap-2 rounded-xl border px-4 py-3 text-xs font-medium shadow-lg ${
            toast.kind === "warn"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}>
            <span className={`mt-[2px] h-1.5 w-1.5 shrink-0 rounded-full ${toast.kind === "warn" ? "bg-red-500" : "bg-amber-500"}`} />
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className={`ml-2 ${toast.kind === "warn" ? "text-red-700/70 hover:text-red-900" : "text-amber-700/70 hover:text-amber-900"}`}
              aria-label="Dismiss"
            >✕</button>
          </div>
        </div>
      )}
    </>
  );
}
