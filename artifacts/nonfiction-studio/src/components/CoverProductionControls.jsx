import {
  PAPERBACK_INTERIORS,
  formatInches,
} from "@/lib/coverKdp";

const SURFACES = [
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "full", label: "Full Cover" },
];

const BACK_LAYOUTS = [
  { id: "editorial", label: "Editorial" },
  { id: "authority", label: "Authority" },
  { id: "benefits", label: "Benefits" },
  { id: "minimal", label: "Minimal" },
];

export default function CoverProductionControls({
  metadata,
  printSetup,
  setPrintSetup,
  backCover,
  setBackCover,
  geometry,
  preflight,
  surface,
  setSurface,
  generatingBack,
  onGenerateBack,
}) {
  const updateSetup = (key, value) => setPrintSetup((prev) => ({ ...prev, [key]: value }));
  const updateBack = (key, value) => setBackCover((prev) => ({ ...prev, [key]: value }));

  return (
    <section className="border-b border-gray-800 bg-[#0f1724] px-4 py-3 text-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-gray-700 bg-gray-900/80 p-1">
          {SURFACES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSurface(item.id)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                surface === item.id
                  ? "bg-indigo-600 text-white shadow"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1 text-indigo-300">
            {formatInches(geometry.fullWidth)} × {formatInches(geometry.fullHeight)}
          </span>
          <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-sky-300">
            Spine {formatInches(geometry.spineWidth)}
          </span>
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
            {geometry.pixels300.width} × {geometry.pixels300.height}px @ 300 DPI
          </span>
          <span className={`rounded-full border px-2.5 py-1 font-bold ${
            preflight.status === "pass"
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
              : preflight.status === "block"
                ? "border-red-500/25 bg-red-500/10 text-red-300"
                : "border-amber-500/25 bg-amber-500/10 text-amber-300"
          }`}>
            {preflight.status === "pass" ? "KDP READY" : preflight.status === "block" ? `${preflight.blocked} BLOCK` : `${preflight.reviews} REVIEW`}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.25fr_1fr]">
        <div className="rounded-xl border border-gray-800 bg-gray-950/35 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">KDP print setup</p>
              <p className="mt-1 text-[11px] text-gray-400">
                Trim is fixed before cover generation so artwork is designed at the correct proportions.
              </p>
            </div>
            {printSetup.estimatedPageCount && (
              <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[9px] font-bold text-amber-300">ESTIMATED PAGES</span>
            )}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Trim</span>
              <div className="rounded-lg border border-gray-700 bg-gray-900 px-2.5 py-2 text-[11px] font-semibold text-gray-200">
                {metadata.bookSize}
              </div>
            </label>

            <label className="space-y-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Pages</span>
              <input
                type="number"
                min="24"
                max="828"
                step="2"
                value={printSetup.pageCount}
                onChange={(e) => {
                  updateSetup("pageCount", Math.max(24, Number(e.target.value) || 24));
                  updateSetup("estimatedPageCount", false);
                }}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-2.5 py-2 text-[11px] text-gray-100 outline-none focus:border-indigo-500"
              />
            </label>

            <label className="space-y-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Interior</span>
              <select
                value={printSetup.interiorId}
                onChange={(e) => updateSetup("interiorId", e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-2.5 py-2 text-[11px] text-gray-100 outline-none focus:border-indigo-500"
              >
                {PAPERBACK_INTERIORS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Reading direction</span>
              <select
                value={printSetup.readingDirection}
                onChange={(e) => updateSetup("readingDirection", e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-2.5 py-2 text-[11px] text-gray-100 outline-none focus:border-indigo-500"
              >
                <option value="ltr">Left to right</option>
                <option value="rtl">Right to left</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/70 px-2.5 py-2 text-[10px] text-gray-300">
              <input
                type="checkbox"
                checked={!!printSetup.showGuides}
                onChange={(e) => updateSetup("showGuides", e.target.checked)}
              />
              Safe/bleed guides
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/70 px-2.5 py-2 text-[10px] text-gray-300">
              <input
                type="checkbox"
                checked={!!printSetup.spineText}
                onChange={(e) => updateSetup("spineText", e.target.checked)}
              />
              Spine text
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/70 px-2.5 py-2 text-[10px] text-gray-300">
              <span>Barcode</span>
              <select
                value={printSetup.barcodeMode}
                onChange={(e) => updateSetup("barcodeMode", e.target.value)}
                className="rounded border border-gray-700 bg-gray-950 px-1.5 py-1 text-[10px]"
              >
                <option value="kdp">KDP places it</option>
                <option value="own">I provide barcode</option>
                <option value="none">No barcode reserved</option>
              </select>
            </label>
          </div>

          {!geometry.spineTextEligible && printSetup.spineText && (
            <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-300">
              Spine text is disabled for production at {geometry.pageCount} pages. KDP requires more than 79 pages.
            </p>
          )}
          {printSetup.readingDirection === "rtl" && !["Hebrew", "Yiddish", "Japanese"].includes(metadata.language) && (
            <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-300">
              KDP currently limits RTL paperback printing to specific supported languages. Verify the publishing language before export.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/35 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">Back cover</p>
              <p className="mt-1 text-[11px] text-gray-400">Use the manuscript and listing copy to create a concise print blurb.</p>
            </div>
            <button
              type="button"
              onClick={onGenerateBack}
              disabled={generatingBack}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {generatingBack ? "Generating…" : "✦ Generate copy"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {BACK_LAYOUTS.map((layout) => (
              <button
                type="button"
                key={layout.id}
                onClick={() => updateBack("layout", layout.id)}
                className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition ${
                  backCover.layout === layout.id
                    ? "border-indigo-400 bg-indigo-500/15 text-indigo-300"
                    : "border-gray-700 bg-gray-900 text-gray-400 hover:text-gray-200"
                }`}
              >
                {layout.label}
              </button>
            ))}
          </div>

          <input
            value={backCover.headline || ""}
            onChange={(e) => updateBack("headline", e.target.value)}
            placeholder="Back-cover headline"
            className="mt-3 w-full rounded-lg border border-gray-700 bg-gray-900 px-2.5 py-2 text-[11px] font-semibold text-gray-100 outline-none focus:border-indigo-500"
          />
          <textarea
            value={backCover.blurb || ""}
            onChange={(e) => updateBack("blurb", e.target.value)}
            rows={4}
            placeholder="Back-cover blurb…"
            className="mt-2 w-full resize-y rounded-lg border border-gray-700 bg-gray-900 px-2.5 py-2 text-[11px] leading-relaxed text-gray-200 outline-none focus:border-indigo-500"
          />

          <p className="mt-2 text-[9px] text-gray-600">
            Barcode-safe space remains protected in the Full Cover preview and is never used for important copy.
          </p>
        </div>
      </div>
    </section>
  );
}
