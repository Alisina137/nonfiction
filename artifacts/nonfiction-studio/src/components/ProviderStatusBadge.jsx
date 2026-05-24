import { useEffect, useState } from "react";
import {
  subscribeAiBus,
  providerLabel,
  isGrokApproved,
  grantGrokApproval,
  revokeGrokApproval
} from "@/lib/ai/aiFetch";

const COLOR = {
  openai: "bg-emerald-100 text-emerald-800 border-emerald-200",
  anthropic: "bg-amber-100 text-amber-800 border-amber-200",
  xai: "bg-violet-100 text-violet-800 border-violet-200",
  gemini: "bg-sky-100 text-sky-800 border-sky-200"
};

export default function ProviderStatusBadge() {
  const [provider, setProvider] = useState(null);
  const [toast, setToast] = useState(null);
  const [grokOn, setGrokOn] = useState(() => isGrokApproved());

  useEffect(() => {
    const unsubP = subscribeAiBus("provider", ({ provider }) => setProvider(provider));
    const unsubF = subscribeAiBus("fallback", ({ message }) => {
      setToast({ message, id: Date.now() });
      setGrokOn(isGrokApproved());
    });
    const unsubA = subscribeAiBus("approval", ({ open }) => {
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
    if (grokOn) {
      revokeGrokApproval();
      setGrokOn(false);
    } else {
      grantGrokApproval();
      setGrokOn(true);
    }
  }

  const label = provider ? providerLabel(provider) : "Idle";
  const colorClass = provider
    ? (COLOR[provider] || "bg-slate-100 text-slate-700 border-slate-200")
    : "bg-slate-50 text-slate-500 border-slate-200";

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Provider in use */}
        <div
          title={provider ? `Last AI provider used: ${label}` : "No AI calls yet this session"}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${colorClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${provider ? "bg-current" : "bg-slate-400"}`} />
          {provider ? `Using ${label}` : "AI idle"}
        </div>

        {/* Persistent Grok toggle — always visible */}
        <button
          type="button"
          onClick={toggleGrok}
          title={
            grokOn
              ? "Grok is enabled as fallback. Click to disable."
              : "Enable Grok so it's used automatically if OpenAI / Claude are unavailable."
          }
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            grokOn
              ? "border-violet-300 bg-violet-100 text-violet-800 hover:bg-violet-200"
              : "border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
          }`}
        >
          {/* Toggle pill */}
          <span
            className={`relative inline-flex h-3.5 w-6 shrink-0 items-center rounded-full transition-colors ${
              grokOn ? "bg-violet-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute h-2.5 w-2.5 rounded-full bg-white shadow transition-transform ${
                grokOn ? "translate-x-2.5" : "translate-x-0.5"
              }`}
            />
          </span>
          Grok fallback
        </button>
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[110] flex justify-center px-4">
          <div className="pointer-events-auto inline-flex max-w-md items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900 shadow-lg">
            <span className="mt-[2px] h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-amber-700/70 hover:text-amber-900"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
