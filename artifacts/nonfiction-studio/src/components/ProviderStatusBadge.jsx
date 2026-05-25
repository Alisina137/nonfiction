import { useEffect, useState } from "react";
import {
  subscribeAiBus,
  providerLabel,
  isGrokApproved,
  grantGrokApproval,
  revokeGrokApproval,
  isLowCostMode,
  enableLowCostMode,
  disableLowCostMode
} from "@/lib/ai/aiFetch";

const COLOR = {
  openai:    "bg-emerald-100 text-emerald-800 border-emerald-200",
  anthropic: "bg-amber-100  text-amber-800  border-amber-200",
  xai:       "bg-violet-100 text-violet-800 border-violet-200",
  gemini:    "bg-sky-100    text-sky-800    border-sky-200",
  llama:     "bg-orange-100 text-orange-800 border-orange-200"
};

function Toggle({ on, onToggle, label, activeClass, title }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        on
          ? activeClass
          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span
        className={`relative inline-flex h-3.5 w-6 shrink-0 items-center rounded-full transition-colors ${
          on ? "bg-current opacity-80" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute h-2.5 w-2.5 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-2.5" : "translate-x-0.5"
          }`}
        />
      </span>
      {label}
    </button>
  );
}

export default function ProviderStatusBadge() {
  const [provider,   setProvider]   = useState(null);
  const [toast,      setToast]      = useState(null);
  const [grokOn,     setGrokOn]     = useState(() => isGrokApproved());
  const [lowCostOn,  setLowCostOn]  = useState(() => isLowCostMode());

  useEffect(() => {
    const unsubP = subscribeAiBus("provider", ({ provider }) => setProvider(provider));
    const unsubF = subscribeAiBus("fallback",  ({ message }) => {
      setToast({ message, id: Date.now() });
      setGrokOn(isGrokApproved());
    });
    const unsubA = subscribeAiBus("approval",  ({ open }) => {
      if (!open) setGrokOn(isGrokApproved());
    });
    return () => { unsubP(); unsubF(); unsubA(); };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  function toggleGrok() {
    if (grokOn) { revokeGrokApproval(); setGrokOn(false); }
    else        { grantGrokApproval();  setGrokOn(true);  }
  }

  function toggleLowCost() {
    if (lowCostOn) {
      disableLowCostMode();
      setLowCostOn(false);
      setToast({ message: "Quality mode on — GPT-4.1 first, best output.", id: Date.now() });
    } else {
      enableLowCostMode();
      setLowCostOn(true);
      setToast({ message: "Low-cost mode on — Gemini Flash first, faster & cheaper.", id: Date.now() });
    }
  }

  const label      = provider ? providerLabel(provider) : "Idle";
  const colorClass = provider
    ? (COLOR[provider] || "bg-slate-100 text-slate-700 border-slate-200")
    : "bg-slate-50 text-slate-500 border-slate-200";

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Current provider badge */}
        <div
          title={provider ? `Last AI provider: ${label}` : "No AI calls yet this session"}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${colorClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${provider ? "bg-current" : "bg-slate-400"}`} />
          {provider ? `Using ${label}` : "AI idle"}
        </div>

        {/* Low-cost mode toggle */}
        <Toggle
          on={lowCostOn}
          onToggle={toggleLowCost}
          label="Low-cost"
          activeClass="border-teal-300 bg-teal-100 text-teal-800 hover:bg-teal-200"
          title={
            lowCostOn
              ? "Low-cost mode: Gemini Flash first. Click to switch back to Quality mode."
              : "Enable low-cost mode: routes all AI calls to Gemini Flash first (cheaper & faster)."
          }
        />

        {/* Grok fallback toggle */}
        <Toggle
          on={grokOn}
          onToggle={toggleGrok}
          label="Grok fallback"
          activeClass="border-violet-300 bg-violet-100 text-violet-800 hover:bg-violet-200"
          title={
            grokOn
              ? "Grok is enabled as fallback. Click to disable."
              : "Enable Grok so it's used if GPT-4.1 / Claude / Gemini are unavailable."
          }
        />
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[110] flex justify-center px-4">
          <div className="pointer-events-auto inline-flex max-w-md items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900 shadow-lg">
            <span className="mt-[2px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-amber-700/70 hover:text-amber-900"
              aria-label="Dismiss"
            >✕</button>
          </div>
        </div>
      )}
    </>
  );
}
