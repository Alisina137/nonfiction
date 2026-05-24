import { useEffect, useState } from "react";
import {
  subscribeAiBus,
  providerLabel,
  isGrokApproved,
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
  const [grokApproved, setGrokApproved] = useState(false);

  useEffect(() => {
    setGrokApproved(isGrokApproved());
    const unsubP = subscribeAiBus("provider", ({ provider }) => setProvider(provider));
    const unsubF = subscribeAiBus("fallback", ({ message, to }) => {
      setToast({ message, to, id: Date.now() });
      setGrokApproved(isGrokApproved());
    });
    return () => { unsubP(); unsubF(); };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const label = provider ? providerLabel(provider) : "Idle";
  const colorClass = provider ? (COLOR[provider] || "bg-slate-100 text-slate-700 border-slate-200")
    : "bg-slate-50 text-slate-500 border-slate-200";

  return (
    <>
      <div className="flex items-center gap-2">
        <div
          title={provider ? `Last AI provider used: ${label}` : "No AI calls yet this session"}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${colorClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${provider ? "bg-current" : "bg-slate-400"}`} />
          {provider ? `Using ${label}` : "AI idle"}
        </div>
        {grokApproved && (
          <button
            type="button"
            onClick={() => {
              revokeGrokApproval();
              setGrokApproved(false);
            }}
            title="Grok approval is active. Click to revoke."
            className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-700 hover:bg-violet-100"
          >
            Grok ✓ — revoke
          </button>
        )}
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
