import { useState } from "react";

export default function BookTitleStep({ research, analysis, bookTitle, errors, setBookTitleBlock }) {
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  function effectiveChosen() {
    const custom = bookTitle.customTitle?.trim() || "";
    const picked = bookTitle.pickedFromAi?.trim() || "";
    return custom || picked || "";
  }

  async function generateSuggestions() {
    setLoading(true);
    setApiError("");
    try {
      const res = await fetch("/api/book/contextual-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ research, analysis })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not generate titles.");
      const titles = Array.isArray(data.titles) ? data.titles.filter(Boolean) : [];
      setBookTitleBlock({
        suggestions: titles,
        pickedFromAi: bookTitle.pickedFromAi || "",
        customTitle: bookTitle.customTitle || ""
      });
      if (!titles.length) setApiError("No titles returned. Try again or type your own below.");
    } catch (e) {
      setApiError(e.message || "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="font-serif text-2xl font-bold text-slate-900 md:text-3xl">Book title</h2>
      <p className="mt-2 text-sm text-slate-600">
        Suggestions are grounded in your <span className="font-medium text-slate-800">Research</span> and{" "}
        <span className="font-medium text-slate-800">Analysis</span> competitor set. Prefer a recommendation, then fine-tune—or
        write a fully custom title at the end.
      </p>

      {errors.form && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{errors.form}</p>
      )}

      {apiError && <p className="mt-3 text-sm text-rose-700">{apiError}</p>}

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={generateSuggestions}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Generating…" : "Suggest titles from my research"}
        </button>
        {effectiveChosen() ? (
          <p className="flex items-center text-sm text-emerald-800">
            Selected: <span className="ml-2 font-semibold">{effectiveChosen()}</span>
          </p>
        ) : (
          <p className="text-sm text-slate-500">Choose a suggestion or enter a custom title to continue.</p>
        )}
      </div>

      {bookTitle.suggestions?.length > 0 && (
        <ul className="mt-8 space-y-2">
          {bookTitle.suggestions.map((title) => {
            const active = bookTitle.pickedFromAi === title && !(bookTitle.customTitle || "").trim();
            const customOverrides = !!(bookTitle.customTitle || "").trim();
            const looksSelected = !customOverrides && active;
            return (
              <li key={title}>
                <button
                  type="button"
                  onClick={() =>
                    setBookTitleBlock({
                      ...bookTitle,
                      pickedFromAi: title,
                      customTitle: ""
                    })
                  }
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                    looksSelected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
                  }`}
                >
                  {title}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-lg font-semibold text-slate-900">Custom title</h3>
        <p className="mt-1 text-xs text-slate-600">
          Overrides any selected suggestion above. Use this when you already know exactly what belongs on the cover.
        </p>
        <input
          className="input-light mt-4"
          placeholder="Type your definitive book title…"
          value={bookTitle.customTitle || ""}
          onChange={(e) =>
            setBookTitleBlock({
              ...bookTitle,
              customTitle: e.target.value
            })
          }
        />
      </div>
    </div>
  );
}
