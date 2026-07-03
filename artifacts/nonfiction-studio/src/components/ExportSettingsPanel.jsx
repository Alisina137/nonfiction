import { TRIM_SIZES, FONT_CHOICES, FONT_SIZE_CHOICES, LINE_SPACING_CHOICES, fontCssFamily } from "@/lib/exportSettings";

const TRIM_ASPECT = {
  "5x8": "5/8",
  "5.5x8.5": "5.5/8.5",
  "6x9": "6/9",
  "8x10": "8/10",
  "8.5x11": "8.5/11",
};

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
        active ? "border-indigo-400 bg-indigo-50 text-indigo-800 ring-1 ring-indigo-300" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-xs font-semibold text-slate-700"
    >
      <span className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-indigo-500" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-4" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

export default function ExportSettingsPanel({ settings, onChange }) {
  const set = (patch) => onChange({ ...settings, ...patch });
  const activeTrim = TRIM_SIZES.find((t) => t.id === settings.trimSize);
  const fontFamily = fontCssFamily(settings.font);

  const sampleParaOne =
    "This is a preview of your manuscript's body text. The trim size, margins, font, and spacing you choose here are applied consistently across every chapter, section, and subsection in the finished book.";
  const sampleParaTwo =
    "Adjust the settings on the left and this page mock-up updates immediately, so you can confirm the layout looks right before generating the full PDF or Word file.";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
      {/* Controls */}
      <div className="space-y-5">
        <div>
          <label className="text-xs font-bold text-slate-800">Trim size</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {TRIM_SIZES.map((t) => (
              <Pill key={t.id} active={settings.trimSize === t.id} onClick={() => set({ trimSize: t.id })}>
                {t.label}
              </Pill>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-800">Margins</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Pill active={settings.marginsMode === "kdp"} onClick={() => set({ marginsMode: "kdp" })}>
              KDP standard (auto gutter)
            </Pill>
            <Pill active={settings.marginsMode === "custom"} onClick={() => set({ marginsMode: "custom" })}>
              Custom
            </Pill>
          </div>
          {settings.marginsMode === "custom" && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {["top", "bottom", "inside", "outside"].map((key) => (
                <label key={key} className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {key}
                  <input
                    type="number"
                    step="0.05"
                    min="0.25"
                    max="2"
                    value={settings.customMargins?.[key] ?? 0.75}
                    onChange={(e) =>
                      set({
                        customMargins: {
                          top: 0.75, bottom: 0.75, inside: 0.75, outside: 0.5,
                          ...settings.customMargins,
                          [key]: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="input-light mt-0.5 text-xs"
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-slate-800">Font</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {FONT_CHOICES.map((f) => (
              <Pill key={f.id} active={settings.font === f.id} onClick={() => set({ font: f.id })}>
                {f.label}
              </Pill>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-bold text-slate-800">Font size</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {FONT_SIZE_CHOICES.map((sz) => (
                <Pill key={sz} active={settings.fontSize === sz} onClick={() => set({ fontSize: sz })}>
                  {sz}pt
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-800">Line spacing</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {LINE_SPACING_CHOICES.map((ls) => (
                <Pill key={ls.value} active={settings.lineSpacing === ls.value} onClick={() => set({ lineSpacing: ls.value })}>
                  {ls.label}
                </Pill>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-800">Paragraph alignment</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Pill active={settings.alignment === "left"} onClick={() => set({ alignment: "left" })}>Left-aligned</Pill>
            <Pill active={settings.alignment === "justified"} onClick={() => set({ alignment: "justified" })}>Justified</Pill>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 border-t border-slate-100 pt-4">
          <Toggle checked={settings.pageNumbers} onChange={(v) => set({ pageNumbers: v })} label="Page numbers" />
          <Toggle checked={settings.headers} onChange={(v) => set({ headers: v })} label="Running headers" />
        </div>

        {settings.headers && (
          <div>
            <label className="text-xs font-bold text-slate-800">Header shows</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Pill active={settings.headerContent === "title"} onClick={() => set({ headerContent: "title" })}>Book title</Pill>
              <Pill active={settings.headerContent === "author"} onClick={() => set({ headerContent: "author" })}>Author name</Pill>
              <Pill active={settings.headerContent === "chapter"} onClick={() => set({ headerContent: "chapter" })}>Chapter name</Pill>
            </div>
          </div>
        )}
      </div>

      {/* Live preview */}
      <div className="flex flex-col items-center">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Preview — {activeTrim?.label}
        </p>
        <div
          className="relative w-full max-w-[240px] overflow-hidden rounded-sm border border-slate-300 bg-white shadow-md"
          style={{ aspectRatio: TRIM_ASPECT[settings.trimSize] || "6/9" }}
        >
          <div
            className="flex h-full flex-col"
            style={{
              padding: "10% 8% 10% 12%",
              fontFamily,
            }}
          >
            {settings.headers && (
              <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-1 text-[6px] italic text-slate-400">
                <span>
                  {settings.headerContent === "author" ? "Author Name" : settings.headerContent === "chapter" ? "Chapter 1" : "Book Title"}
                </span>
              </div>
            )}
            <p className="mb-2 text-center text-[11px] font-bold text-slate-900">Chapter 1</p>
            <p className="mb-3 border-b-2 border-indigo-400 pb-2 text-center text-[7px] font-bold text-slate-400">&nbsp;</p>
            <p
              className="text-slate-800"
              style={{
                fontSize: `${5 + settings.fontSize / 6}px`,
                lineHeight: settings.lineSpacing,
                textAlign: settings.alignment === "justified" ? "justify" : "left",
                textIndent: "1.2em",
                marginBottom: settings.lineSpacing >= 1.5 ? "0.3em" : "0",
              }}
            >
              {sampleParaOne}
            </p>
            <p
              className="mt-1 text-slate-800"
              style={{
                fontSize: `${5 + settings.fontSize / 6}px`,
                lineHeight: settings.lineSpacing,
                textAlign: settings.alignment === "justified" ? "justify" : "left",
                textIndent: "1.2em",
              }}
            >
              {sampleParaTwo}
            </p>
            <div className="mt-auto flex justify-center pt-2">
              {settings.pageNumbers && <span className="text-[6px] text-slate-400">14</span>}
            </div>
          </div>
        </div>
        <p className="mt-2 max-w-[240px] text-center text-[10px] leading-snug text-slate-400">
          A simplified representation — actual pagination depends on your full manuscript.
        </p>
      </div>
    </div>
  );
}
