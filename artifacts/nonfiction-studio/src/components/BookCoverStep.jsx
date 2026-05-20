import { useCallback, useEffect, useRef, useState } from "react";
import {
  resolveAudience,
  resolveAuthorName,
  resolveBookTitle,
  resolveGenre,
  resolveTone,
  resolveUsp
} from "@/lib/projectMeta";

// ─── Constants ────────────────────────────────────────────────────────────────

const GENRE_PRESETS = {
  business: {
    label: "Business",
    primaryColor: "#0f172a", accentColor: "#3b82f6", textColor: "#ffffff",
    fontPairingIndex: 1, layoutStyle: "bold-stack", styleMode: "typographic"
  },
  selfhelp: {
    label: "Self-Help",
    primaryColor: "#1e3a5f", accentColor: "#f59e0b", textColor: "#ffffff",
    fontPairingIndex: 0, layoutStyle: "bold-stack", styleMode: "cinematic"
  },
  memoir: {
    label: "Memoir",
    primaryColor: "#292524", accentColor: "#e7c9a2", textColor: "#f5f5f4",
    fontPairingIndex: 3, layoutStyle: "minimal", styleMode: "minimal"
  },
  thriller: {
    label: "Thriller",
    primaryColor: "#0a0a0a", accentColor: "#dc2626", textColor: "#ffffff",
    fontPairingIndex: 1, layoutStyle: "bold-stack", styleMode: "cinematic"
  },
  fantasy: {
    label: "Fantasy",
    primaryColor: "#1e1b4b", accentColor: "#c084fc", textColor: "#f3f0ff",
    fontPairingIndex: 4, layoutStyle: "split-band", styleMode: "illustrated"
  },
  academic: {
    label: "Academic",
    primaryColor: "#1e3a5f", accentColor: "#93c5fd", textColor: "#f8fafc",
    fontPairingIndex: 5, layoutStyle: "typographic", styleMode: "minimal"
  },
  inspirational: {
    label: "Inspirational",
    primaryColor: "#6b21a8", accentColor: "#fbbf24", textColor: "#ffffff",
    fontPairingIndex: 6, layoutStyle: "typographic", styleMode: "abstract"
  }
};

const FONT_PAIRINGS = [
  { label: "Executive",  title: "Playfair Display", sub: "Inter",             author: "Inter" },
  { label: "Impact",     title: "Oswald",            sub: "Open Sans",         author: "Open Sans" },
  { label: "Editorial",  title: "Merriweather",      sub: "Lato",              author: "Lato" },
  { label: "Literary",   title: "EB Garamond",       sub: "Crimson Text",      author: "Crimson Text" },
  { label: "Fantasy",    title: "Cinzel",             sub: "Raleway",           author: "Raleway" },
  { label: "Academic",   title: "Libre Baskerville", sub: "Lato",              author: "Lato" },
  { label: "Modern",     title: "Raleway",            sub: "Nunito",            author: "Nunito" }
];

const STYLE_MODES = [
  { id: "typographic",  label: "Typographic",  icon: "𝗔" },
  { id: "cinematic",    label: "Cinematic",    icon: "🎬" },
  { id: "illustrated",  label: "Illustrated",  icon: "✦" },
  { id: "minimal",      label: "Minimal",      icon: "◦" },
  { id: "abstract",     label: "Abstract",     icon: "◈" },
  { id: "photographic", label: "Photographic", icon: "⬛" }
];

const KDP_TRIM_SIZES = [
  { label: '5" × 8"',          w: 5,    h: 8 },
  { label: '5.06" × 7.81"',    w: 5.06, h: 7.81 },
  { label: '5.25" × 8"',       w: 5.25, h: 8 },
  { label: '5.5" × 8.5"',      w: 5.5,  h: 8.5 },
  { label: '6" × 9" — common', w: 6,    h: 9 },
  { label: '6.14" × 9.21"',    w: 6.14, h: 9.21 },
  { label: '7" × 10"',         w: 7,    h: 10 },
  { label: '8" × 10"',         w: 8,    h: 10 },
  { label: '8.5" × 11"',       w: 8.5,  h: 11 }
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(r, g, b) {
  const c = [r, g, b].map(x => {
    x /= 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrastRatio(hex1, hex2) {
  try {
    const l1 = relativeLuminance(...hexToRgb(hex1));
    const l2 = relativeLuminance(...hexToRgb(hex2));
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  } catch { return 1; }
}

function calcSpineInches(pageCount, paperType) {
  const ppi = paperType === "cream" ? 0.0028 : 0.0025;
  return Math.round(pageCount * ppi * 1000) / 1000;
}

function runComplianceChecks(cover, spineInches) {
  const issues = [];
  const pageCount = Number(cover.pageCount) || 0;
  const ratio = contrastRatio(cover.textColor || "#fff", cover.primaryColor || "#000");

  if (pageCount < 24) issues.push({ level: "error", msg: "Page count must be ≥ 24 for KDP paperback." });
  if (pageCount > 828) issues.push({ level: "error", msg: "KDP paperback max is 828 pages." });
  if (ratio < 3) issues.push({ level: "error", msg: `Low contrast: ${ratio.toFixed(1)}:1 — text may be unreadable in print.` });
  else if (ratio < 4.5) issues.push({ level: "warn", msg: `Contrast ${ratio.toFixed(1)}:1 — WCAG AA requires 4.5:1. May be hard to read.` });
  if (spineInches < 0.0625) issues.push({ level: "warn", msg: "Spine too narrow — no text or design allowed on spine." });
  else if (spineInches < 0.25) issues.push({ level: "warn", msg: `Spine ${spineInches.toFixed(3)}" — too narrow for author name on spine.` });
  if (!cover.subtitle) issues.push({ level: "info", msg: "No subtitle — a subtitle significantly improves discoverability." });
  if (!cover.tagline) issues.push({ level: "info", msg: "No tagline — taglines help browsers understand the book at a glance." });
  return issues;
}

// ─── SVG Export ───────────────────────────────────────────────────────────────

function buildFrontCoverSVG(cover, title) {
  const fp = FONT_PAIRINGS[cover.fontPairingIndex ?? 0];
  const bg = cover.primaryColor || "#0c4a6e";
  const acc = cover.accentColor || "#38bdf8";
  const tc = cover.textColor || "#ffffff";
  const W = 1600, H = 2560;
  const mode = cover.styleMode || "typographic";

  let bgEl = `<rect width="${W}" height="${H}" fill="${bg}"/>`;
  let decoration = "";

  if (mode === "cinematic") {
    bgEl = `<defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${bg}" stop-opacity="1"/>
      <stop offset="100%" stop-color="#000" stop-opacity="1"/>
    </linearGradient></defs><rect width="${W}" height="${H}" fill="url(#cg)"/>`;
    decoration = `<rect x="0" y="${H * 0.6}" width="${W}" height="4" fill="${acc}" opacity="0.8"/>`;
  } else if (mode === "illustrated") {
    decoration = `
      <rect x="60" y="60" width="${W - 120}" height="${H - 120}" fill="none" stroke="${acc}" stroke-width="12"/>
      <rect x="100" y="100" width="${W - 200}" height="${H - 200}" fill="none" stroke="${acc}" stroke-width="4" opacity="0.5"/>
      <circle cx="${W / 2}" cy="${H * 0.38}" r="460" fill="${acc}" opacity="0.08"/>`;
  } else if (mode === "abstract") {
    bgEl = `<defs><linearGradient id="ag" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="50%" stop-color="${acc}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${bg}"/>
    </linearGradient></defs><rect width="${W}" height="${H}" fill="url(#ag)"/>`;
    decoration = `<ellipse cx="${W * 0.8}" cy="${H * 0.2}" rx="700" ry="400" fill="${acc}" opacity="0.15"/>
      <ellipse cx="${W * 0.2}" cy="${H * 0.8}" rx="500" ry="300" fill="${acc}" opacity="0.12"/>`;
  } else if (mode === "minimal") {
    bgEl = `<rect width="${W}" height="${H}" fill="#f8f8f6"/>`;
    decoration = `<line x1="160" y1="${H * 0.52}" x2="${W - 160}" y2="${H * 0.52}" stroke="${bg}" stroke-width="3"/>`;
  } else if (mode === "photographic") {
    decoration = `<rect x="0" y="0" width="${W}" height="${H * 0.62}" fill="#888" opacity="0.35"/>
      <rect x="0" y="${H * 0.62}" width="${W}" height="${H * 0.38}" fill="${bg}"/>`;
  } else {
    decoration = `<rect x="120" y="${H * 0.72}" width="220" height="8" fill="${acc}" rx="4"/>`;
  }

  const titleColor = mode === "minimal" ? bg : tc;
  const titleY = mode === "photographic" ? H * 0.68 : mode === "cinematic" ? H * 0.64 : H * 0.7;
  const titleLines = wrapText(title, 22);

  const titleSvg = titleLines.map((line, i) => (
    `<text x="120" y="${titleY + i * 160}" font-family="${fp?.title || "serif"}" font-size="130" font-weight="800" fill="${titleColor}">${escSvg(line)}</text>`
  )).join("\n");

  const subtitleSvg = cover.subtitle
    ? `<text x="120" y="${titleY + titleLines.length * 160 + 80}" font-family="${fp?.sub || "sans-serif"}" font-size="72" fill="${titleColor}" opacity="0.88">${escSvg(cover.subtitle)}</text>`
    : "";

  const tagSvg = cover.tagline
    ? `<text x="120" y="200" font-family="${fp?.sub || "sans-serif"}" font-size="60" font-weight="600" fill="${acc}" letter-spacing="4">${escSvg(cover.tagline.toUpperCase())}</text>`
    : "";

  const authorSvg = `<text x="120" y="${H - 160}" font-family="${fp?.author || "sans-serif"}" font-size="64" fill="${titleColor}" opacity="0.85" letter-spacing="3">${escSvg((cover.authorLine || "").toUpperCase())}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${bgEl}
  ${decoration}
  ${tagSvg}
  ${titleSvg}
  ${subtitleSvg}
  ${authorSvg}
</svg>`;
}

function wrapText(text, maxChars) {
  const words = (text || "").split(" ");
  const lines = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > maxChars) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function escSvg(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function downloadSVG(svgString, filename) {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Cover Preview ────────────────────────────────────────────────────────────

function FrontCoverInner({ cover, title, scale = 1, thumb = false }) {
  const fp = FONT_PAIRINGS[cover.fontPairingIndex ?? 0];
  const bg = cover.primaryColor || "#0c4a6e";
  const acc = cover.accentColor || "#38bdf8";
  const tc = cover.textColor || "#ffffff";
  const mode = cover.styleMode || "typographic";
  const titleFont = fp?.title || "serif";
  const subFont = fp?.sub || "sans-serif";
  const authorFont = fp?.author || "sans-serif";
  const align = cover.textAlign || "left";
  const titleSz = thumb ? 10 : (cover.titleSize || 22);
  const subSz = thumb ? 5 : (cover.subtitleSize || 12);
  const authorSz = thumb ? 4 : (cover.authorSize || 9);

  const minimalBg = mode === "minimal" ? "#f8f8f4" : bg;
  const textCol = mode === "minimal" ? bg : tc;

  const wrapStyle = {
    background: minimalBg,
    color: textCol,
    fontFamily: titleFont,
    position: "relative",
    overflow: "hidden",
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column"
  };

  return (
    <div style={wrapStyle}>
      {mode === "cinematic" && (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${bg} 0%, #000 100%)` }} />
      )}
      {mode === "abstract" && (
        <>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${bg} 0%, ${acc}33 60%, ${bg} 100%)` }} />
          <div style={{ position: "absolute", top: "-20%", right: "-15%", width: "70%", height: "70%", borderRadius: "50%", background: acc, opacity: 0.12 }} />
          <div style={{ position: "absolute", bottom: "-10%", left: "-10%", width: "50%", height: "50%", borderRadius: "50%", background: acc, opacity: 0.1 }} />
        </>
      )}
      {mode === "illustrated" && (
        <>
          <div style={{ position: "absolute", inset: thumb ? 3 : 8, border: `${thumb ? 1 : 3}px solid ${acc}`, opacity: 0.7 }} />
          <div style={{ position: "absolute", inset: thumb ? 5 : 14, border: `${thumb ? 0.5 : 1}px solid ${acc}`, opacity: 0.35 }} />
          <div style={{ position: "absolute", top: "25%", left: "50%", transform: "translate(-50%,-50%)", width: thumb ? "50%" : "65%", paddingBottom: thumb ? "50%" : "65%", borderRadius: "50%", background: acc, opacity: 0.07 }} />
        </>
      )}
      {mode === "photographic" && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "58%", background: "linear-gradient(180deg, #888 0%, #555 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: thumb ? 6 : 11, color: "#ccc", fontFamily: "sans-serif", letterSpacing: 1 }}>IMAGE AREA</span>
        </div>
      )}

      <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1, padding: thumb ? "5% 7%" : "6% 8%", textAlign: align }}>
        {cover.tagline && (
          <div style={{
            fontSize: thumb ? 3.5 : 9, fontFamily: subFont, fontWeight: 700,
            letterSpacing: thumb ? 1 : 3, textTransform: "uppercase",
            color: acc, marginBottom: thumb ? 3 : "5%", opacity: 0.95
          }}>
            {cover.tagline}
          </div>
        )}

        {mode === "photographic" ? (
          <div style={{ marginTop: "auto", paddingTop: "60%" }}>
            <div style={{ fontSize: titleSz, fontFamily: titleFont, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.5, color: textCol, marginBottom: thumb ? 2 : "3%" }}>
              {title}
            </div>
          </div>
        ) : mode === "cinematic" ? (
          <div style={{ marginTop: "auto" }}>
            <div style={{ position: "relative" }}>
              <div style={{ height: thumb ? 1 : 3, background: acc, marginBottom: thumb ? 3 : "4%", width: "40%" }} />
              <div style={{ fontSize: titleSz, fontFamily: titleFont, fontWeight: 800, lineHeight: 1.05, color: textCol, marginBottom: thumb ? 1 : "2%" }}>
                {title}
              </div>
            </div>
          </div>
        ) : mode === "minimal" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: align === "center" ? "center" : "flex-start" }}>
            <div style={{ height: thumb ? 1 : 2, background: bg, marginBottom: thumb ? 4 : "6%", width: "30%", opacity: 0.5 }} />
            <div style={{ fontSize: titleSz * 0.9, fontFamily: titleFont, fontWeight: 700, lineHeight: 1.15, color: bg, letterSpacing: -0.3 }}>
              {title}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: "auto" }}>
            {mode !== "illustrated" && <div style={{ width: thumb ? 12 : 28, height: thumb ? 1.5 : 4, background: acc, borderRadius: 2, marginBottom: thumb ? 3 : "4%" }} />}
            <div style={{ fontSize: titleSz, fontFamily: titleFont, fontWeight: 800, lineHeight: 1.08, color: textCol, letterSpacing: -0.3 }}>
              {title}
            </div>
          </div>
        )}

        {cover.subtitle && (
          <div style={{ fontSize: subSz, fontFamily: subFont, lineHeight: 1.35, color: textCol, opacity: 0.9, marginTop: thumb ? 2 : "3%", fontWeight: 500 }}>
            {cover.subtitle}
          </div>
        )}

        <div style={{ marginTop: "auto", paddingTop: thumb ? 3 : "5%", fontSize: authorSz, fontFamily: authorFont, letterSpacing: thumb ? 0.5 : 2, textTransform: "uppercase", opacity: 0.85, color: textCol, fontWeight: 600 }}>
          {cover.authorLine || "Author Name"}
        </div>
      </div>
    </div>
  );
}

function SpinePreview({ cover, title, spineInches, trimHeight }) {
  const fp = FONT_PAIRINGS[cover.fontPairingIndex ?? 0];
  const bg = cover.primaryColor || "#0c4a6e";
  const acc = cover.accentColor || "#38bdf8";
  const tc = cover.textColor || "#ffffff";
  const hasText = spineInches >= 0.25;
  const spineRatioOfHeight = spineInches / trimHeight;
  const previewWidth = Math.max(8, Math.round(spineRatioOfHeight * 220 * (trimHeight / 9)));

  return (
    <div style={{
      width: previewWidth,
      background: acc,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      position: "relative",
      overflow: "hidden"
    }}>
      {hasText && (
        <div style={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          transform: "rotate(180deg)",
          fontSize: 7,
          fontFamily: fp?.title || "serif",
          fontWeight: 700,
          color: bg,
          letterSpacing: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          maxHeight: "90%",
          padding: "4px 0"
        }}>
          {title} {cover.authorLine ? `• ${cover.authorLine}` : ""}
        </div>
      )}
    </div>
  );
}

function BackCoverPreview({ cover }) {
  const fp = FONT_PAIRINGS[cover.fontPairingIndex ?? 0];
  const bg = cover.primaryColor || "#0c4a6e";
  const acc = cover.accentColor || "#38bdf8";
  const tc = cover.textColor || "#ffffff";
  const subFont = fp?.sub || "sans-serif";

  return (
    <div style={{ background: bg, color: tc, width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "8%", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: acc }} />
      {cover.backCoverHook && (
        <div style={{ fontSize: 9, fontFamily: fp?.title || "serif", fontWeight: 700, lineHeight: 1.4, marginBottom: "6%", color: tc }}>
          {cover.backCoverHook}
        </div>
      )}
      {cover.backDescription && (
        <div style={{ fontSize: 7, fontFamily: subFont, lineHeight: 1.6, opacity: 0.88, marginBottom: "4%", flex: 1 }}>
          {cover.backDescription.slice(0, 280)}{cover.backDescription.length > 280 ? "…" : ""}
        </div>
      )}
      {cover.backReviewQuotes && (
        <div style={{ fontSize: 6.5, fontFamily: subFont, fontStyle: "italic", opacity: 0.75, marginBottom: "4%", borderLeft: `2px solid ${acc}`, paddingLeft: "4%" }}>
          {cover.backReviewQuotes.slice(0, 120)}{cover.backReviewQuotes.length > 120 ? "…" : ""}
        </div>
      )}
      <div style={{ marginTop: "auto" }}>
        {cover.backAuthorBio && (
          <div style={{ fontSize: 6, fontFamily: subFont, opacity: 0.7, marginBottom: "4%" }}>
            {cover.backAuthorBio.slice(0, 100)}{cover.backAuthorBio.length > 100 ? "…" : ""}
          </div>
        )}
        <div style={{
          width: "32%", height: "12%", border: `1px solid ${tc}`, opacity: 0.3,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 5, fontFamily: "monospace", color: tc
        }}>
          BARCODE
        </div>
        <div style={{ fontSize: 5, fontFamily: subFont, opacity: 0.4, marginTop: "2%" }}>
          KDP SAFE ZONE ≥ 0.125" bleed required
        </div>
      </div>
    </div>
  );
}

function FullWrapPreview({ cover, title }) {
  const trimSize = KDP_TRIM_SIZES[cover.trimSizeIndex ?? 4];
  const pageCount = Number(cover.pageCount) || 200;
  const spineInches = calcSpineInches(pageCount, cover.paperType || "white");
  const trimH = trimSize.h;
  const PREVIEW_H = 220;
  const frontW = Math.round((trimSize.w / trimH) * PREVIEW_H);

  return (
    <div>
      <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Full Wrap Preview</p>
      <div className="flex justify-center">
        <div style={{ display: "flex", height: PREVIEW_H, boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}>
          <div style={{ width: frontW, flexShrink: 0 }}>
            <BackCoverPreview cover={cover} />
          </div>
          <SpinePreview cover={cover} title={title} spineInches={spineInches} trimHeight={trimH} />
          <div style={{ width: frontW, flexShrink: 0 }}>
            <FrontCoverInner cover={cover} title={title} />
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[9px] text-slate-400">
        {trimSize.label} · Spine: {spineInches.toFixed(3)}" ({pageCount} pages, {cover.paperType || "white"} paper)
      </p>
    </div>
  );
}

function ThumbnailPreview({ cover, title }) {
  const ratio = contrastRatio(cover.textColor || "#fff", cover.primaryColor || "#000");
  const poor = ratio < 3;
  const warn = ratio >= 3 && ratio < 4.5;

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Amazon Thumbnail</p>
      <div style={{ position: "relative", display: "inline-block" }}>
        <div style={{ width: 72, height: 108, borderRadius: 4, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
          <FrontCoverInner cover={cover} title={title} thumb />
        </div>
        {(poor || warn) && (
          <div style={{ position: "absolute", top: -6, right: -6, width: 16, height: 16, borderRadius: "50%", background: poor ? "#ef4444" : "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700 }}>
            !
          </div>
        )}
      </div>
      <div className={`text-[10px] font-semibold ${poor ? "text-red-600" : warn ? "text-amber-600" : "text-emerald-600"}`}>
        {poor ? "Poor contrast" : warn ? "Marginal contrast" : "Good contrast"} {ratio.toFixed(1)}:1
      </div>
    </div>
  );
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ label, value }) {
  const pct = (value / 10) * 100;
  const color = value >= 8 ? "#22c55e" : value >= 6 ? "#f59e0b" : "#ef4444";
  const r = 16, circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
          strokeLinecap="round" transform="rotate(-90 22 22)" />
        <text x="22" y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{value}</text>
      </svg>
      <span className="text-[9px] font-semibold text-slate-600 text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Field Label ──────────────────────────────────────────────────────────────

function FL({ children, hint }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-semibold tracking-tight text-slate-800">
      {children}
      {hint && <span className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 bg-white text-[9px] font-bold text-sky-600" title={hint}>i</span>}
    </label>
  );
}

// ─── Tab Nav ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: "style",      label: "Style" },
  { id: "type",       label: "Typography" },
  { id: "colors",     label: "Colors" },
  { id: "copy",       label: "Copy" },
  { id: "kdp",        label: "KDP Setup" },
  { id: "back",       label: "Back Cover" },
  { id: "ai",         label: "AI Tools" }
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookCoverStep({ bookCover, setBookCover, fullProject, description, errors }) {
  const [tab, setTab] = useState("style");
  const [briefBusy, setBriefBusy] = useState(false);
  const [criticBusy, setCriticBusy] = useState(false);
  const [variantsBusy, setVariantsBusy] = useState(false);
  const [status, setStatus] = useState("");
  const visitRef = useRef(false);

  const cover = bookCover && typeof bookCover === "object" ? bookCover : {};
  const title = resolveBookTitle(fullProject);
  const fp = FONT_PAIRINGS[cover.fontPairingIndex ?? 0];
  const trimSize = KDP_TRIM_SIZES[cover.trimSizeIndex ?? 4];
  const spineInches = calcSpineInches(Number(cover.pageCount) || 200, cover.paperType || "white");
  const compliance = runComplianceChecks(cover, spineInches);
  const variants = Array.isArray(cover.variants) ? cover.variants : [];
  const activeIdx = cover.activeVariant ?? 0;
  const critic = cover.critic || null;

  // Seed defaults
  useEffect(() => {
    if (visitRef.current) return;
    visitRef.current = true;
    const author = resolveAuthorName(fullProject);
    setBookCover((prev) => {
      const p = prev && typeof prev === "object" ? prev : {};
      return {
        subtitle: p.subtitle || "",
        tagline: p.tagline || "",
        authorLine: p.authorLine || author,
        layoutStyle: p.layoutStyle || "typographic",
        styleMode: p.styleMode || "typographic",
        primaryColor: p.primaryColor || "#0c4a6e",
        accentColor: p.accentColor || "#38bdf8",
        textColor: p.textColor || "#ffffff",
        genrePreset: p.genrePreset || "",
        fontPairingIndex: p.fontPairingIndex ?? 0,
        titleSize: p.titleSize ?? 22,
        subtitleSize: p.subtitleSize ?? 12,
        authorSize: p.authorSize ?? 9,
        textAlign: p.textAlign || "left",
        trimSizeIndex: p.trimSizeIndex ?? 4,
        pageCount: p.pageCount ?? 200,
        paperType: p.paperType || "white",
        backDescription: p.backDescription || "",
        backAuthorBio: p.backAuthorBio || "",
        backReviewQuotes: p.backReviewQuotes || "",
        backCoverHook: p.backCoverHook || "",
        backCoverCTA: p.backCoverCTA || "",
        designNotes: p.designNotes || "",
        mood: p.mood || "",
        typographyDirection: p.typographyDirection || "",
        imagerySuggestions: p.imagerySuggestions || "",
        colorPsychology: p.colorPsychology || "",
        audienceTargeting: p.audienceTargeting || "",
        compositionGuidance: p.compositionGuidance || "",
        variants: p.variants || null,
        activeVariant: p.activeVariant ?? 0,
        critic: p.critic || null,
        generatedAt: p.generatedAt || null
      };
    });
  }, [fullProject, setBookCover]);

  function patch(partial) {
    setBookCover((prev) => ({ ...(prev && typeof prev === "object" ? prev : {}), ...partial }));
  }

  function applyPreset(id) {
    const p = GENRE_PRESETS[id];
    if (!p) return;
    patch({ genrePreset: id, primaryColor: p.primaryColor, accentColor: p.accentColor, textColor: p.textColor, fontPairingIndex: p.fontPairingIndex, layoutStyle: p.layoutStyle, styleMode: p.styleMode });
  }

  function applyVariant(idx) {
    const v = variants[idx];
    if (!v) return;
    patch({
      activeVariant: idx,
      primaryColor: v.primaryColor || cover.primaryColor,
      accentColor: v.accentColor || cover.accentColor,
      textColor: v.textColor || cover.textColor,
      layoutStyle: v.layoutStyle || cover.layoutStyle,
      styleMode: v.styleMode || cover.styleMode,
      fontPairingIndex: typeof v.fontPairingIndex === "number" ? v.fontPairingIndex : cover.fontPairingIndex,
      tagline: v.tagline || cover.tagline
    });
  }

  async function onGenerateBrief() {
    setBriefBusy(true);
    setStatus("");
    try {
      const res = await fetch("/api/ai/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle: cover.subtitle || "",
          audience: resolveAudience(fullProject),
          tone: resolveTone(fullProject),
          genre: resolveGenre(fullProject),
          usp: resolveUsp(fullProject),
          authorName: resolveAuthorName(fullProject),
          description: description || "",
          genrePreset: cover.genrePreset || "",
          styleMode: cover.styleMode || "typographic"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      patch({
        subtitle: data.subtitle || cover.subtitle,
        tagline: data.tagline || cover.tagline,
        authorLine: data.authorLine || cover.authorLine,
        layoutStyle: data.layoutStyle || cover.layoutStyle,
        primaryColor: data.primaryColor || cover.primaryColor,
        accentColor: data.accentColor || cover.accentColor,
        textColor: data.textColor || cover.textColor,
        designNotes: data.designNotes || cover.designNotes,
        mood: data.mood || "",
        typographyDirection: data.typographyDirection || "",
        imagerySuggestions: data.imagerySuggestions || "",
        colorPsychology: data.colorPsychology || "",
        audienceTargeting: data.audienceTargeting || "",
        compositionGuidance: data.compositionGuidance || "",
        backCoverHook: data.backCoverHook || cover.backCoverHook,
        backCoverCTA: data.backCoverCTA || cover.backCoverCTA,
        generatedAt: new Date().toISOString()
      });
      setStatus("Cover brief generated — refine details below.");
    } catch (e) {
      setStatus(e.message || "Generation failed.");
    } finally {
      setBriefBusy(false);
    }
  }

  async function onCritic() {
    setCriticBusy(true);
    setStatus("");
    try {
      const res = await fetch("/api/ai/cover-critic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          ...cover,
          fontPairingLabel: fp?.label || "default",
          genre: resolveGenre(fullProject)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Critic failed");
      patch({ critic: data });
      setStatus("AI cover critique complete.");
    } catch (e) {
      setStatus(e.message || "Critique failed.");
    } finally {
      setCriticBusy(false);
    }
  }

  async function onVariants() {
    setVariantsBusy(true);
    setStatus("");
    try {
      const res = await fetch("/api/ai/cover-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle: cover.subtitle,
          audience: resolveAudience(fullProject),
          genre: resolveGenre(fullProject),
          tone: resolveTone(fullProject),
          usp: resolveUsp(fullProject)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const newVariants = Array.isArray(data.variants) ? data.variants : [];
      patch({ variants: newVariants, activeVariant: 0 });
      if (newVariants[0]) applyVariant(0);
      setStatus(`${newVariants.length} cover concepts generated — select A, B, or C below.`);
    } catch (e) {
      setStatus(e.message || "Variants failed.");
    } finally {
      setVariantsBusy(false);
    }
  }

  function onExportSVG() {
    const svg = buildFrontCoverSVG(cover, title);
    const slug = title.slice(0, 30).replace(/[^a-z0-9]/gi, "-").toLowerCase();
    downloadSVG(svg, `${slug}-front-cover.svg`);
  }

  function onExportEbookSVG() {
    const svg = buildFrontCoverSVG({ ...cover, subtitle: "" }, title);
    const slug = title.slice(0, 30).replace(/[^a-z0-9]/gi, "-").toLowerCase();
    downloadSVG(svg, `${slug}-ebook-cover.svg`);
  }

  function copyKDPSpec() {
    const lines = [
      `KDP COVER SPEC — ${title}`,
      `Trim size: ${trimSize.label}`,
      `Page count: ${Number(cover.pageCount) || 200}`,
      `Paper: ${cover.paperType || "white"}`,
      `Spine width: ${spineInches.toFixed(3)}"`,
      `Front + spine + back (wrap): ${(trimSize.w * 2 + spineInches + 0.25).toFixed(3)}" × ${(trimSize.h + 0.25).toFixed(3)}"`,
      "",
      `Style mode: ${cover.styleMode || "typographic"}`,
      `Layout: ${cover.layoutStyle || "typographic"}`,
      `Font pairing: ${fp?.label} (Title: ${fp?.title} / Sub: ${fp?.sub} / Author: ${fp?.author})`,
      `Primary color: ${cover.primaryColor}`,
      `Accent color: ${cover.accentColor}`,
      `Text color: ${cover.textColor}`,
      "",
      `Mood: ${cover.mood || "(not generated)"}`,
      `Typography direction: ${cover.typographyDirection || "(not generated)"}`,
      `Imagery suggestions: ${cover.imagerySuggestions || "(not generated)"}`,
      `Color psychology: ${cover.colorPsychology || "(not generated)"}`,
      `Composition guidance: ${cover.compositionGuidance || "(not generated)"}`,
      "",
      `Design notes: ${cover.designNotes || "(none)"}`,
      "",
      `KDP bleed requirement: 0.125" on all sides`,
      `Resolution: 300 DPI for print`,
      `Color mode: RGB for digital, CMYK for print`
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => setStatus("KDP spec copied to clipboard!")).catch(() => setStatus("Copy failed — try manually."));
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const ip = "input-light mt-1 text-sm";

  return (
    <section className="mx-auto max-w-7xl">
      {status && <p className="mb-4 rounded-lg bg-indigo-50 px-4 py-2.5 text-center text-sm font-medium text-indigo-800">{status}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">

        {/* ── LEFT: Controls ── */}
        <div>
          {/* Tab bar */}
          <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="book-panel space-y-5 p-5">

            {/* ── Style Tab ── */}
            {tab === "style" && (
              <div className="space-y-5">
                <div>
                  <FL hint="Sets a genre-matched color palette, font, and layout.">Genre Preset</FL>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(GENRE_PRESETS).map(([id, p]) => (
                      <button key={id} type="button" onClick={() => applyPreset(id)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${cover.genrePreset === id ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300"}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <FL hint="Controls the visual treatment of the cover layout.">Cover Style Mode</FL>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {STYLE_MODES.map((m) => (
                      <button key={m.id} type="button" onClick={() => patch({ styleMode: m.id })}
                        className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-center transition ${cover.styleMode === m.id ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                        <span className="text-lg leading-none">{m.icon}</span>
                        <span className="text-[10px] font-semibold leading-tight">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <FL hint="Curated title + subtitle + author font combinations.">Font Pairing</FL>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {FONT_PAIRINGS.map((pair, idx) => (
                      <button key={idx} type="button" onClick={() => patch({ fontPairingIndex: idx })}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${cover.fontPairingIndex === idx ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                        <div className="text-[11px] font-bold text-slate-800" style={{ fontFamily: pair.title }}>{pair.label}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{pair.title}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Typography Tab ── */}
            {tab === "type" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <FL>Title Size (px-equiv)</FL>
                    <input type="range" min={14} max={36} step={1} className="mt-2 w-full"
                      value={Number(cover.titleSize) || 22}
                      onChange={(e) => patch({ titleSize: Number(e.target.value) })} />
                    <div className="text-[10px] text-slate-500 mt-0.5">{cover.titleSize || 22}px</div>
                  </div>
                  <div>
                    <FL>Subtitle Size</FL>
                    <input type="range" min={8} max={18} step={1} className="mt-2 w-full"
                      value={Number(cover.subtitleSize) || 12}
                      onChange={(e) => patch({ subtitleSize: Number(e.target.value) })} />
                    <div className="text-[10px] text-slate-500 mt-0.5">{cover.subtitleSize || 12}px</div>
                  </div>
                  <div>
                    <FL>Author Size</FL>
                    <input type="range" min={6} max={14} step={1} className="mt-2 w-full"
                      value={Number(cover.authorSize) || 9}
                      onChange={(e) => patch({ authorSize: Number(e.target.value) })} />
                    <div className="text-[10px] text-slate-500 mt-0.5">{cover.authorSize || 9}px</div>
                  </div>
                </div>

                <div>
                  <FL>Text Alignment</FL>
                  <div className="mt-2 flex gap-2">
                    {["left", "center", "right"].map((a) => (
                      <button key={a} type="button" onClick={() => patch({ textAlign: a })}
                        className={`flex-1 rounded-lg border py-2 text-xs font-semibold capitalize transition ${cover.textAlign === a ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Current Pairing: {fp?.label}</div>
                  <div className="space-y-1 text-xs text-slate-600">
                    <div>Title: <span className="font-medium text-slate-800" style={{ fontFamily: fp?.title }}>{fp?.title}</span></div>
                    <div>Subtitle: <span className="font-medium text-slate-800" style={{ fontFamily: fp?.sub }}>{fp?.sub}</span></div>
                    <div>Author: <span className="font-medium text-slate-800" style={{ fontFamily: fp?.author }}>{fp?.author}</span></div>
                  </div>
                </div>

                <div>
                  <FL hint="Controls the overall content layout order.">Layout Style</FL>
                  <select className={ip} value={cover.layoutStyle || "typographic"} onChange={(e) => patch({ layoutStyle: e.target.value })}>
                    {["typographic", "split-band", "minimal", "bold-stack"].map((l) => (
                      <option key={l} value={l}>{l.replace("-", " ")}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* ── Colors Tab ── */}
            {tab === "colors" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { key: "primaryColor", label: "Primary Background", hint: "Dominant cover background color." },
                    { key: "accentColor", label: "Accent / Highlight", hint: "Used for decorative elements, spine, accents." },
                    { key: "textColor", label: "Text Color", hint: "Main title and body text color — ensure strong contrast." }
                  ].map(({ key, label, hint }) => (
                    <div key={key}>
                      <FL hint={hint}>{label}</FL>
                      <div className="mt-2 flex items-center gap-2">
                        <input type="color" className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200"
                          value={cover[key] || "#000000"} onChange={(e) => patch({ [key]: e.target.value })} />
                        <input className="input-light flex-1 text-xs font-mono"
                          value={cover[key] || ""}
                          onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && patch({ [key]: e.target.value })} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Contrast Check</div>
                  {(() => {
                    const ratio = contrastRatio(cover.textColor || "#fff", cover.primaryColor || "#000");
                    const color = ratio >= 4.5 ? "text-emerald-700" : ratio >= 3 ? "text-amber-700" : "text-red-700";
                    const bg = ratio >= 4.5 ? "bg-emerald-50" : ratio >= 3 ? "bg-amber-50" : "bg-red-50";
                    return (
                      <div className={`rounded-lg px-3 py-2 ${bg}`}>
                        <span className={`text-sm font-bold ${color}`}>{ratio.toFixed(1)}:1</span>
                        <span className={`ml-2 text-xs ${color}`}>
                          {ratio >= 4.5 ? "WCAG AA ✓ — good for print and screen" : ratio >= 3 ? "Marginal — may look faded in print" : "Poor — text likely unreadable"}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ── Copy Tab ── */}
            {tab === "copy" && (
              <div className="space-y-4">
                <div>
                  <FL hint="Appears directly under the main title on the front cover.">Subtitle</FL>
                  <input className={ip} value={cover.subtitle || ""} onChange={(e) => patch({ subtitle: e.target.value })} placeholder="A practical guide to…" />
                </div>
                <div>
                  <FL hint="Short punchy hook — appears at the very top of the cover, usually in the accent color.">Tagline</FL>
                  <input className={ip} value={cover.tagline || ""} onChange={(e) => patch({ tagline: e.target.value })} placeholder="Systems that compound" />
                </div>
                <div>
                  <FL hint="Exactly as it should appear on the cover.">Author Line</FL>
                  <input className={ip} value={cover.authorLine || ""} onChange={(e) => patch({ authorLine: e.target.value })} />
                </div>
                <div>
                  <FL hint="Notes for you or a cover designer — mood, references, elements to avoid.">Design Notes</FL>
                  <textarea className="input-light mt-1 min-h-[90px] resize-y text-sm" value={cover.designNotes || ""} onChange={(e) => patch({ designNotes: e.target.value })} placeholder="Typography mood, imagery references, hierarchy notes…" />
                </div>
                {cover.mood && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 space-y-2 text-xs text-indigo-900">
                    <div><span className="font-bold">Mood:</span> {cover.mood}</div>
                    {cover.typographyDirection && <div><span className="font-bold">Typography:</span> {cover.typographyDirection}</div>}
                    {cover.colorPsychology && <div><span className="font-bold">Color psychology:</span> {cover.colorPsychology}</div>}
                    {cover.compositionGuidance && <div><span className="font-bold">Composition:</span> {cover.compositionGuidance}</div>}
                    {cover.audienceTargeting && <div><span className="font-bold">Audience signal:</span> {cover.audienceTargeting}</div>}
                    {cover.imagerySuggestions && <div><span className="font-bold">Imagery:</span> {cover.imagerySuggestions}</div>}
                  </div>
                )}
              </div>
            )}

            {/* ── KDP Setup Tab ── */}
            {tab === "kdp" && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FL hint="Standard KDP paperback trim sizes.">Trim Size</FL>
                    <select className={ip} value={cover.trimSizeIndex ?? 4} onChange={(e) => patch({ trimSizeIndex: Number(e.target.value) })}>
                      {KDP_TRIM_SIZES.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <FL hint="KDP paperback: 24–828 pages.">Page Count</FL>
                    <input type="number" min={24} max={828} className={ip} value={Number(cover.pageCount) || 200} onChange={(e) => patch({ pageCount: Number(e.target.value) })} />
                  </div>
                </div>

                <div>
                  <FL hint="Cream paper is slightly thicker; produces a wider spine.">Paper Type</FL>
                  <div className="mt-1 flex gap-2">
                    {["white", "cream"].map((p) => (
                      <button key={p} type="button" onClick={() => patch({ paperType: p })}
                        className={`flex-1 rounded-lg border py-2 text-xs font-semibold capitalize transition ${cover.paperType === p ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
                  <div className="text-xs font-semibold text-sky-800 mb-2">Calculated Spine Width</div>
                  <div className="text-2xl font-bold text-sky-900">{spineInches.toFixed(3)}"</div>
                  <div className="text-xs text-sky-700 mt-1">
                    Full wrap width: {(trimSize.w * 2 + spineInches + 0.25).toFixed(3)}" × {(trimSize.h + 0.25).toFixed(3)}" (incl. 0.125" bleed)
                  </div>
                  {spineInches < 0.25 && <div className="mt-2 text-xs font-semibold text-amber-700">⚠ Spine too narrow for text — increase page count or leave spine blank.</div>}
                  {spineInches >= 0.25 && <div className="mt-2 text-xs text-sky-700">✓ Wide enough for author name and title on spine.</div>}
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-2">KDP Compliance</div>
                  {compliance.length === 0 ? (
                    <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">✓ All checks passed</div>
                  ) : (
                    <div className="space-y-1.5">
                      {compliance.map((c, i) => (
                        <div key={i} className={`rounded-lg px-3 py-2 text-xs ${c.level === "error" ? "bg-red-50 text-red-700" : c.level === "warn" ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-600"}`}>
                          {c.level === "error" ? "✗" : c.level === "warn" ? "⚠" : "ℹ"} {c.msg}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Back Cover Tab ── */}
            {tab === "back" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">All fields are optional. The back cover preview updates in real time in the right panel.</p>
                <div>
                  <FL hint="Opening hook — the first thing a browser reads when flipping the book over.">Back Cover Hook</FL>
                  <textarea className="input-light mt-1 min-h-[60px] resize-y text-sm" value={cover.backCoverHook || ""} onChange={(e) => patch({ backCoverHook: e.target.value })} placeholder="What if everything you thought you knew about X was wrong?" />
                </div>
                <div>
                  <FL hint="200–300 word book description for the back cover.">Back Cover Description</FL>
                  <textarea className="input-light mt-1 min-h-[120px] resize-y text-sm" value={cover.backDescription || ""} onChange={(e) => patch({ backDescription: e.target.value })} placeholder="In this book, you'll discover…" />
                </div>
                <div>
                  <FL hint="1–3 short review quotes from readers, experts, or early reviewers.">Review Quotes</FL>
                  <textarea className="input-light mt-1 min-h-[80px] resize-y text-sm" value={cover.backReviewQuotes || ""} onChange={(e) => patch({ backReviewQuotes: e.target.value })} placeholder={`"A must-read." — Name, Title`} />
                </div>
                <div>
                  <FL hint="Short 2–3 sentence author bio for the back cover.">Author Bio (short)</FL>
                  <textarea className="input-light mt-1 min-h-[80px] resize-y text-sm" value={cover.backAuthorBio || ""} onChange={(e) => patch({ backAuthorBio: e.target.value })} placeholder="About the author…" />
                </div>
                <div>
                  <FL hint="Final call to action — what should the reader do after reading the back cover?">Back Cover CTA</FL>
                  <input className={ip} value={cover.backCoverCTA || ""} onChange={(e) => patch({ backCoverCTA: e.target.value })} placeholder="Start reading today and transform your…" />
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  ⬛ Barcode safe area (bottom-right, ≥ 2" × 1.2") is reserved automatically. Leave the bottom-right of your back cover design clear.
                </div>
              </div>
            )}

            {/* ── AI Tools Tab ── */}
            {tab === "ai" && (
              <div className="space-y-6">
                <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-sky-50 p-5">
                  <div className="text-sm font-bold text-indigo-900 mb-1">AI Cover Brief Generator</div>
                  <p className="text-xs text-indigo-700 mb-4">Generates a complete design brief: mood, typography direction, color psychology, imagery suggestions, composition guidance, and back cover copy.</p>
                  <button type="button" disabled={briefBusy} onClick={onGenerateBrief}
                    className="rounded-full bg-gradient-to-r from-indigo-600 to-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-50">
                    {briefBusy ? "Generating brief…" : "Generate cover brief"}
                  </button>
                </div>

                <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50 p-5">
                  <div className="text-sm font-bold text-violet-900 mb-1">AI Cover Critic</div>
                  <p className="text-xs text-violet-700 mb-4">AI reviews your current cover design for hierarchy, readability, contrast, KDP compliance, and bestseller potential — with scores and specific recommendations.</p>
                  <button type="button" disabled={criticBusy} onClick={onCritic}
                    className="rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-50">
                    {criticBusy ? "Analyzing…" : "Critique my cover"}
                  </button>
                  {critic && (
                    <div className="mt-5 space-y-4">
                      <div className="flex gap-3 flex-wrap">
                        {Object.entries(critic.scores || {}).map(([k, v]) => (
                          <ScoreRing key={k} label={k.replace(/([A-Z])/g, " $1").trim()} value={v} />
                        ))}
                        {typeof critic.overall === "number" && <ScoreRing label="Overall" value={critic.overall} />}
                      </div>
                      {critic.topIssue && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800"><span className="font-bold">Top issue:</span> {critic.topIssue}</div>}
                      {critic.topRecommendation && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><span className="font-bold">Top recommendation:</span> {critic.topRecommendation}</div>}
                      {critic.feedback && (
                        <div className="space-y-1.5">
                          {Object.entries(critic.feedback).map(([k, v]) => (
                            <div key={k} className="text-xs text-slate-600">
                              <span className="font-semibold text-slate-800 capitalize">{k.replace(/([A-Z])/g, " $1")}:</span> {String(v)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-5">
                  <div className="text-sm font-bold text-emerald-900 mb-1">Generate A/B/C Variants</div>
                  <p className="text-xs text-emerald-700 mb-4">Creates 3 distinctly different cover concepts: A (safe commercial), B (bold distinctive), C (avant-garde). Click a variant chip to apply it to the preview.</p>
                  <button type="button" disabled={variantsBusy} onClick={onVariants}
                    className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-50">
                    {variantsBusy ? "Generating variants…" : "Generate A / B / C variants"}
                  </button>
                  {variants.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <div className="flex gap-2">
                        {variants.map((v, idx) => (
                          <button key={idx} type="button" onClick={() => applyVariant(idx)}
                            className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${activeIdx === idx ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300"}`}>
                            {v.variantLabel}
                          </button>
                        ))}
                      </div>
                      {variants[activeIdx]?.concept && (
                        <div className="rounded-lg bg-white border border-emerald-100 px-3 py-2 text-xs text-slate-700">
                          <span className="font-bold text-emerald-700">Variant {variants[activeIdx].variantLabel}:</span> {variants[activeIdx].concept}
                          {variants[activeIdx].designNotes && <div className="mt-1 text-slate-500">{variants[activeIdx].designNotes}</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Export buttons */}
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-700 mb-3">Export</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onExportSVG}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                ↓ Front Cover SVG
              </button>
              <button type="button" onClick={onExportEbookSVG}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                ↓ Ebook Cover SVG
              </button>
              <button type="button" onClick={copyKDPSpec}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                📋 Copy KDP Spec
              </button>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">SVG files are scalable vector — open in Illustrator, Affinity Designer, or Inkscape for print-ready 300 DPI export. KDP requires RGB PNG or PDF with 0.125" bleed.</p>
          </div>
        </div>

        {/* ── RIGHT: Preview panel ── */}
        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <FullWrapPreview cover={cover} title={title} />
          <ThumbnailPreview cover={cover} title={title} />

          {/* Compliance summary */}
          {compliance.filter(c => c.level !== "info").length > 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 space-y-1.5">
              <div className="text-xs font-bold text-amber-800">KDP Compliance Issues</div>
              {compliance.filter(c => c.level !== "info").map((c, i) => (
                <div key={i} className={`text-[11px] ${c.level === "error" ? "text-red-700" : "text-amber-700"}`}>
                  {c.level === "error" ? "✗" : "⚠"} {c.msg}
                </div>
              ))}
            </div>
          )}

          {/* Quick stats */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-1.5 text-slate-600">
            <div className="font-semibold text-slate-800 mb-2">Cover Summary</div>
            <div>Style: <span className="font-medium text-slate-800 capitalize">{cover.styleMode || "typographic"}</span></div>
            <div>Font: <span className="font-medium text-slate-800">{fp?.label}</span></div>
            <div>Trim: <span className="font-medium text-slate-800">{trimSize.label}</span></div>
            <div>Spine: <span className="font-medium text-slate-800">{spineInches.toFixed(3)}"</span></div>
            <div>Contrast: <span className={`font-medium ${contrastRatio(cover.textColor || "#fff", cover.primaryColor || "#000") >= 4.5 ? "text-emerald-700" : "text-amber-700"}`}>{contrastRatio(cover.textColor || "#fff", cover.primaryColor || "#000").toFixed(1)}:1</span></div>
            {variants.length > 0 && <div>Variant: <span className="font-medium text-slate-800">{variants[activeIdx]?.variantLabel || "—"}</span></div>}
          </div>
        </div>
      </div>
    </section>
  );
}
