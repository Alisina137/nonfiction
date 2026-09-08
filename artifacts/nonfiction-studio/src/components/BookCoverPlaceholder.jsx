export default function BookCoverPlaceholder() {
  return (
    <section className="mx-auto flex min-h-[520px] w-full max-w-3xl items-center justify-center rounded-3xl border border-slate-200/80 bg-white/75 px-6 py-16 shadow-[0_18px_60px_rgba(15,23,42,0.07)]">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-3xl shadow-inner">
          <span aria-hidden>🎨</span>
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-sky-600">
          Book Cover
        </p>
        <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-slate-900">
          Build soon
        </h2>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          The book cover workspace is being rebuilt. You can continue to the
          next step for now and return here later.
        </p>
        <div className="mx-auto mt-7 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          This step is temporarily optional
        </div>
      </div>
    </section>
  );
}