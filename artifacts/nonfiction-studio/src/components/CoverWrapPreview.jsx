import { useEffect, useRef, useState } from "react";

function workspaceBackground(id) {
  if (id === "light") return { background: "#e5e7eb" };
  if (id === "checkerboard") {
    return {
      backgroundColor: "#f8f8f8",
      backgroundImage: "linear-gradient(45deg,#cbd5e1 25%,transparent 25%),linear-gradient(-45deg,#cbd5e1 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#cbd5e1 75%),linear-gradient(-45deg,transparent 75%,#cbd5e1 75%)",
      backgroundSize: "20px 20px",
      backgroundPosition: "0 0,0 10px,10px -10px,-10px 0",
    };
  }
  return { background: "#111827" };
}

function GuideFrame({ trimWidth, trimHeight, safeMargin }) {
  const x = Math.min(18, Math.max(2, safeMargin / trimWidth * 100));
  const y = Math.min(18, Math.max(2, safeMargin / trimHeight * 100));
  return (
    <div
      className="pointer-events-none absolute border border-dashed border-emerald-300/70"
      style={{ left: `${x}%`, right: `${x}%`, top: `${y}%`, bottom: `${y}%` }}
    >
      <span className="absolute left-1 top-1 rounded bg-emerald-950/70 px-1 py-0.5 text-[7px] font-bold text-emerald-200">SAFE</span>
    </div>
  );
}

function BarcodeGuide({ geometry, printSetup }) {
  if (printSetup?.barcodeMode === "none") return null;
  const width = Math.min(48, geometry.barcode.width / geometry.trimWidth * 100);
  const height = Math.min(34, geometry.barcode.height / geometry.trimHeight * 100);
  const side = geometry.barcode.side;
  return (
    <div
      className="pointer-events-none absolute bottom-[4%] flex items-center justify-center border border-dashed border-amber-300/90 bg-amber-100/10 text-center"
      style={{
        width: `${width}%`,
        height: `${height}%`,
        [side]: "4%",
      }}
    >
      <span className="rounded bg-amber-950/80 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-amber-200">
        Barcode safe
      </span>
    </div>
  );
}

function BackContent({ backCover, palette, geometry, printSetup, showGuides }) {
  const layout = backCover?.layout || "editorial";
  const bullets = Array.isArray(backCover?.bullets) ? backCover.bullets.filter(Boolean).slice(0, 3) : [];
  const common = "relative z-10 h-full w-full overflow-hidden";
  const bg = palette?.bg || "#111827";
  const text = palette?.text || "#f8fafc";
  const accent = palette?.accent || "#c084fc";

  const copy = (
    <>
      {backCover?.headline && (
        <h3
          className="font-serif font-bold leading-tight"
          style={{ color: text, fontSize: layout === "minimal" ? "4.2%" : "4.8%" }}
        >
          {backCover.headline}
        </h3>
      )}
      {backCover?.blurb && (
        <div
          className="whitespace-pre-line leading-relaxed"
          style={{ color: text, opacity: 0.9, fontSize: "2.25%" }}
        >
          {backCover.blurb}
        </div>
      )}
      {layout === "benefits" && bullets.length > 0 && (
        <ul className="space-y-[2%]" style={{ color: text, fontSize: "2.15%" }}>
          {bullets.map((bullet, index) => (
            <li key={index} className="flex gap-[2%]">
              <span style={{ color: accent }}>◆</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
      {backCover?.authorLine && (
        <p className="mt-auto border-t pt-[4%]" style={{ borderColor: `${accent}55`, color: text, opacity: 0.8, fontSize: "1.9%" }}>
          {backCover.authorLine}
        </p>
      )}
    </>
  );

  return (
    <div className={common} style={{ background: bg, color: text }}>
      <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 80% 15%, ${accent}, transparent 35%)` }} />
      {layout === "authority" && <div className="absolute inset-y-0 left-0 w-[5%]" style={{ background: accent }} />}
      <div
        className={`relative z-10 flex h-full flex-col ${
          layout === "minimal"
            ? "justify-center text-center"
            : layout === "authority"
              ? "justify-center"
              : "justify-start"
        }`}
        style={{ padding: layout === "minimal" ? "12%" : "10%", gap: "5%" }}
      >
        {copy}
      </div>
      {showGuides && <GuideFrame trimWidth={geometry.trimWidth} trimHeight={geometry.trimHeight} safeMargin={geometry.safeMargin} />}
      {showGuides && <BarcodeGuide geometry={geometry} printSetup={printSetup} />}
    </div>
  );
}

function SpineContent({ metadata, palette, geometry, printSetup, showGuides }) {
  const eligible = geometry.spineTextEligible && printSetup?.spineText;
  const bg = palette?.bg || "#111827";
  const text = palette?.text || "#f8fafc";
  const accent = palette?.accent || "#c084fc";

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden" style={{ background: bg }}>
      <div className="absolute inset-y-0 left-0 w-[8%]" style={{ background: accent, opacity: 0.45 }} />
      {eligible ? (
        <div
          className="flex max-h-[88%] items-center gap-2 overflow-hidden whitespace-nowrap font-semibold"
          style={{
            color: text,
            fontSize: "clamp(7px, 1.4vw, 14px)",
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
          }}
        >
          <span>{metadata.title || "Book Title"}</span>
          {metadata.author ? <span style={{ opacity: 0.7 }}>· {metadata.author}</span> : null}
        </div>
      ) : (
        <span
          className="select-none text-center font-bold uppercase tracking-widest"
          style={{ color: text, opacity: 0.35, fontSize: "clamp(6px, 0.9vw, 10px)", writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          No spine text
        </span>
      )}
      {showGuides && (
        <div className="pointer-events-none absolute inset-y-[3%] border-x border-dashed border-sky-300/60" style={{ left: "18%", right: "18%" }} />
      )}
    </div>
  );
}

export default function CoverWrapPreview({
  surface,
  zoom,
  canvasBg,
  geometry,
  printSetup,
  metadata,
  backCover,
  palette,
  frontContent,
  bookSizeLabel,
}) {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 700, h: 520 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ratio = surface === "full"
    ? geometry.fullWidth / geometry.fullHeight
    : geometry.trimWidth / geometry.trimHeight;
  const padding = 48;
  const maxH = Math.max(200, containerSize.h - padding * 2);
  const maxW = Math.max(120, containerSize.w - padding * 2);
  const byH = { h: maxH, w: maxH * ratio };
  const byW = { w: maxW, h: maxW / ratio };
  const fit = byH.w <= maxW ? byH : byW;
  const scale = zoom === "fit" ? 1 : (typeof zoom === "number" ? zoom : 1);
  const previewW = fit.w * scale;
  const previewH = fit.h * scale;
  const showGuides = !!printSetup?.showGuides;

  const frontPanel = (
    <div className="relative h-full w-full overflow-hidden" style={{ background: palette?.bg || "#111827" }}>
      {frontContent}
      {showGuides && <GuideFrame trimWidth={geometry.trimWidth} trimHeight={geometry.trimHeight} safeMargin={geometry.safeMargin} />}
    </div>
  );

  const backPanel = (
    <BackContent
      backCover={backCover}
      palette={palette}
      geometry={geometry}
      printSetup={printSetup}
      showGuides={showGuides}
    />
  );

  let content = frontPanel;
  if (surface === "back") content = backPanel;

  if (surface === "full") {
    const bleed = geometry.bleed;
    const trim = geometry.trimWidth;
    const spine = Math.max(geometry.spineWidth, 0.02);
    const cols = `${bleed}fr ${trim}fr ${spine}fr ${trim}fr ${bleed}fr`;
    const rows = `${bleed}fr ${geometry.trimHeight}fr ${bleed}fr`;
    const ltr = geometry.readingDirection !== "rtl";

    content = (
      <div
        className="relative grid h-full w-full overflow-hidden"
        style={{
          gridTemplateColumns: cols,
          gridTemplateRows: rows,
          background: palette?.bg || "#111827",
        }}
      >
        <div style={{ gridColumn: ltr ? "2" : "4", gridRow: "2" }}>{backPanel}</div>
        <div style={{ gridColumn: "3", gridRow: "2" }}>
          <SpineContent
            metadata={metadata}
            palette={palette}
            geometry={geometry}
            printSetup={printSetup}
            showGuides={showGuides}
          />
        </div>
        <div style={{ gridColumn: ltr ? "4" : "2", gridRow: "2" }}>{frontPanel}</div>

        {showGuides && (
          <>
            <div className="pointer-events-none absolute inset-0 border border-fuchsia-300/50" />
            <div className="pointer-events-none absolute left-0 right-0 top-0 border-t border-dashed border-fuchsia-300/70" />
            <div className="pointer-events-none absolute left-0 right-0 bottom-0 border-b border-dashed border-fuchsia-300/70" />
            <span className="pointer-events-none absolute left-2 top-2 rounded bg-fuchsia-950/80 px-1.5 py-0.5 text-[7px] font-bold text-fuchsia-200">
              BLEED {geometry.bleed.toFixed(3)}″
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-0 flex-1 items-center justify-center overflow-auto"
      style={workspaceBackground(canvasBg)}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          style={{
            width: Math.round(previewW),
            height: Math.round(previewH),
            overflow: "hidden",
            boxShadow: "0 24px 64px rgba(0,0,0,.48),0 6px 16px rgba(0,0,0,.28)",
            borderRadius: 2,
          }}
        >
          {content}
        </div>
        <div className="mt-3 text-center text-[9px] font-medium tracking-wide text-slate-400">
          {surface === "full"
            ? `Full wrap · ${geometry.fullWidth.toFixed(3)}″ × ${geometry.fullHeight.toFixed(3)}″`
            : `${surface === "back" ? "Back" : "Front"} · ${bookSizeLabel}`}
          {" · "}
          {zoom === "fit" ? "Fit" : `${Math.round((typeof zoom === "number" ? zoom : 1) * 100)}%`}
        </div>
      </div>
    </div>
  );
}
