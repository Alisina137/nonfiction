import { useEffect, useState } from "react";
import { subscribeAiBus, resolveGrokApproval } from "@/lib/ai/aiFetch";

export default function GrokApprovalModal() {
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    return subscribeAiBus("approval", ({ open, meta }) => {
      setOpen(open);
      if (open) setMeta(meta || null);
    });
  }, []);

  if (!open) return null;

  const attempted = Array.isArray(meta?.attempted) ? meta.attempted : [];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="border-b border-slate-100 bg-gradient-to-br from-amber-50 to-orange-50 px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Approval required
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            Claude daily limit reached
          </h2>
        </header>
        <div className="px-5 py-4 text-sm leading-relaxed text-slate-700">
          <p>
            OpenAI and Claude are both unavailable right now. Would you like to continue
            generation using <span className="font-semibold text-slate-900">Grok (xAI)</span>?
          </p>
          {attempted.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500">
              {attempted.map((a, i) => (
                <li key={i}>
                  <span className="font-semibold text-slate-700">{a.provider}</span>: {a.error}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-slate-500">
            Approval is remembered in this browser. You can revoke it anytime from the
            provider badge in the dashboard header.
          </p>
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={() => resolveGrokApproval(false)}
            className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => resolveGrokApproval(true)}
            className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Continue with Grok
          </button>
        </footer>
      </div>
    </div>
  );
}
