import { useEffect, useRef, useState } from "react";
import { aiFetch, GenerationCanceledError } from "@/lib/ai/aiFetch";

function FieldLabel({ children, hint }) {
  return (
    <label className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-slate-800">
      {children}
      {hint && (
        <span
          className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300/90 bg-white text-[10px] font-bold text-sky-600 shadow-sm"
          title={hint}
        >
          i
        </span>
      )}
    </label>
  );
}

export default function ResearchStep({ research, setResearch, errors }) {
  // Subtitle suggestions
  const [subtitleSuggestions, setSubtitleSuggestions] = useState([]);
  const [subtitlesLoading, setSubtitlesLoading] = useState(false);
  const [subtitlesError, setSubtitlesError] = useState("");

  // Topic suggestion
  const [topicLoading, setTopicLoading]   = useState(false);
  const [topicError, setTopicError]       = useState("");
  const [topicOptions, setTopicOptions]   = useState([]);

  const subtitleDebounceRef = useRef(null);

  function patch(partial) {
    setResearch(typeof partial === "function" ? partial : { ...research, ...partial });
  }

  // ─── Auto-suggest subtitles (debounced) ─────────────────────────────────────
  useEffect(() => {
    const title = research?.bookTitle?.trim() || "";
    if (!title || title.length < 4) {
      clearTimeout(subtitleDebounceRef.current);
      return;
    }
    clearTimeout(subtitleDebounceRef.current);
    subtitleDebounceRef.current = setTimeout(() => {
      fetchSubtitles(title);
    }, 1800);
    return () => clearTimeout(subtitleDebounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [research?.bookTitle]);

  async function fetchSubtitles(titleOverride) {
    const title = (titleOverride || research?.bookTitle || "").trim();
    if (!title || subtitlesLoading) return;
    setSubtitlesLoading(true);
    setSubtitlesError("");
    try {
      const data = await aiFetch("/api/ai/suggest-subtitles", {
        title,
        niche:     "",
        subNiche:  "",
        deepNiche: "",
      });
      const subs = Array.isArray(data.subtitles)
        ? data.subtitles.filter((s) => s?.subtitle)
        : [];
      if (!subs.length) throw new Error("No subtitles returned. Try again.");
      setSubtitleSuggestions(subs);
    } catch (err) {
      setSubtitleSuggestions([]);
      setSubtitlesError(
        err instanceof GenerationCanceledError
          ? "Generation canceled — Grok approval declined."
          : err?.message || "Failed to suggest subtitles."
      );
    } finally {
      setSubtitlesLoading(false);
    }
  }

  // ─── Topic suggestion ────────────────────────────────────────────────────────
  async function fetchTopic() {
    const title = (research?.bookTitle || "").trim();
    if (!title || topicLoading) return;
    setTopicLoading(true);
    setTopicError("");
    setTopicOptions([]);
    try {
      const data = await aiFetch("/api/ai/suggest-topic", {
        title,
        subtitle:  research?.bookSubtitle || "",
        niche:     "",
        subNiche:  "",
        deepNiche: ""
      });
      const opts = Array.isArray(data?.topics) ? data.topics.filter((t) => t?.topic) : [];
      if (!opts.length) throw new Error("No topics returned. Try again.");
      setTopicOptions(opts);
    } catch (err) {
      setTopicError(err?.message || "Failed to generate topic. Try again.");
    } finally {
      setTopicLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl">

      {/* ── Header ── */}
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700/90">Step 1 — Idea input</p>
        <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Start with your idea
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Name your book and describe its core topic.
          Title, subtitle, and topic flow into every AI step — outline, writing, cover, and description.
        </p>
      </header>

      {/* ── Main form ── */}
      <section className="book-panel mt-6 space-y-6">

        {/* ── Book Title ── */}
        <section>
          <FieldLabel hint="Your working title — can be refined later in the Title step.">Book title</FieldLabel>
          <input
            className="input-light mt-1.5"
            placeholder="Enter your book title"
            value={research.bookTitle || ""}
            onChange={(e) => patch({ bookTitle: e.target.value })}
          />
        </section>

        {/* ── Book Subtitle ── */}
        <section>
          <div className="flex items-end justify-between gap-2">
            <FieldLabel hint="Clarifies who the book is for and what transformation they get. Used in the outline, writing, cover, and description steps.">
              Book subtitle <span className="font-normal text-slate-400">(recommended)</span>
            </FieldLabel>
            <button
              type="button"
              disabled={!research?.bookTitle?.trim() || subtitlesLoading}
              onClick={() => fetchSubtitles()}
              className="mb-0.5 whitespace-nowrap rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition hover:border-sky-400 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {subtitlesLoading ? "Generating…" : "AI Suggest"}
            </button>
          </div>
          <input
            className="input-light mt-1.5"
            placeholder="e.g. The Entrepreneur's System for Unbreakable Daily Habits"
            value={research.bookSubtitle || ""}
            onChange={(e) => patch({ bookSubtitle: e.target.value })}
          />

          {/* Subtitle suggestions */}
          {subtitlesError && <p className="mt-1.5 text-xs text-red-600">{subtitlesError}</p>}
          {subtitleSuggestions.length > 0 && (
            <section className="mt-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Suggested subtitles — click to apply
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {subtitleSuggestions.map((sub) => {
                  const subText = typeof sub === "string" ? sub : (sub.subtitle || "");
                  const angle   = typeof sub === "object" ? (sub.angle || "") : "";
                  const active  = research.bookSubtitle === subText;
                  return (
                    <li key={subText}>
                      <button
                        type="button"
                        onClick={() => patch({ bookSubtitle: subText })}
                        className={`w-full rounded-lg border px-3.5 py-2.5 text-left text-sm transition ${
                          active
                            ? "border-sky-500 bg-sky-500 text-white font-semibold shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50"
                        }`}
                      >
                        {angle && (
                          <span className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${active ? "text-sky-200" : "text-slate-400"}`}>
                            {angle}
                          </span>
                        )}
                        {subText}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {subtitlesLoading && (
            <p className="mt-2 text-xs text-slate-400 animate-pulse">
              Generating subtitle suggestions based on your title…
            </p>
          )}
        </section>

        {/* ── Book Topic ── */}
        <section>
          <div className="flex items-end justify-between gap-2">
            <FieldLabel hint="The exact core topic — who it's for and what it helps them achieve. Used by every AI step.">
              Book topic
            </FieldLabel>
            <button
              type="button"
              disabled={!research?.bookTitle?.trim() || topicLoading}
              onClick={fetchTopic}
              className="mb-0.5 whitespace-nowrap rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition hover:border-sky-400 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {topicLoading ? "Generating…" : "AI Generate"}
            </button>
          </div>
          <textarea
            className="input-light mt-1.5 min-h-[72px] resize-y"
            placeholder="e.g. Self-discipline for entrepreneurs — building unbreakable daily systems while running a business"
            value={research.bookTopic || ""}
            onChange={(e) => patch({ bookTopic: e.target.value })}
          />
          {topicError && <p className="mt-1 text-xs text-red-600">{topicError}</p>}
          {topicLoading && (
            <p className="mt-1 text-xs text-slate-400 animate-pulse">
              Generating topic options based on your title…
            </p>
          )}
          {!topicError && !topicLoading && topicOptions.length === 0 && (
            <p className="mt-1 text-[11px] text-slate-400">
              Tip: be specific — "Self-discipline for entrepreneurs" beats "discipline habits".
            </p>
          )}
          {topicOptions.length > 0 && (
            <section className="mt-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Topic options — click to apply
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {topicOptions.map((opt) => {
                  const active = research.bookTopic === opt.topic;
                  return (
                    <li key={opt.style}>
                      <button
                        type="button"
                        onClick={() => patch({ bookTopic: opt.topic })}
                        className={`w-full rounded-lg border px-3.5 py-2.5 text-left text-sm transition ${
                          active
                            ? "border-sky-500 bg-sky-500 text-white font-semibold shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50"
                        }`}
                      >
                        {opt.style && (
                          <span className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${active ? "text-sky-200" : "text-slate-400"}`}>
                            {opt.style}
                          </span>
                        )}
                        {opt.topic}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </section>

        {/* ── Author name ── */}
        <section>
          <FieldLabel hint="Name as it will appear on the cover.">Author name</FieldLabel>
          <input
            className="input-light mt-1.5"
            placeholder="Enter your author name"
            value={research.authorName || ""}
            onChange={(e) => patch({ authorName: e.target.value })}
          />
          {errors.authorName && <p className="mt-1 text-xs text-red-600">{errors.authorName}</p>}
        </section>

        {/* ── Optional fields ── */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4 space-y-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Optional — shapes AI research, outline, and writing
          </p>

          {/* Desired transformation */}
          <section>
            <FieldLabel hint="The specific change the reader experiences by the last page.">
              Desired transformation
            </FieldLabel>
            <input
              className="input-light mt-1.5"
              placeholder="e.g. Stop overthinking and build consistent daily discipline within 90 days"
              value={research.stanceOnTopic || ""}
              onChange={(e) => patch({ stanceOnTopic: e.target.value })}
            />
          </section>

          {/* Custom notes */}
          <section>
            <FieldLabel hint="Anything else the AI should know — competitor books, unique angle, personal story, tone ideas.">
              Custom notes
            </FieldLabel>
            <textarea
              className="input-light mt-1.5 min-h-[72px] resize-y"
              placeholder="e.g. I want this to stand out from Atomic Habits by focusing on identity-level change in masculine psychology. I have 10 years of coaching experience."
              value={research.standout || ""}
              onChange={(e) => patch({ standout: e.target.value })}
            />
          </section>
        </div>

      </section>
    </section>
  );
}
