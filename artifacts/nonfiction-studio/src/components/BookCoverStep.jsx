import { useEffect, useRef, useState } from "react";
import {
  resolveAudience,
  resolveAuthorName,
  resolveBookTitle,
  resolveGenre,
  resolveTone,
  resolveUsp
} from "@/lib/projectMeta";
import { aiFetch } from "@/lib/ai/aiFetch";

// ─── Constants ────────────────────────────────────────────────────────────────

const KDP_TRIM_SIZES = [
  { label: '5" × 8"',          w: 5,    h: 8    },
  { label: '5.06" × 7.81"',    w: 5.06, h: 7.81 },
  { label: '5.25" × 8"',       w: 5.25, h: 8    },
  { label: '5.5" × 8.5"',      w: 5.5,  h: 8.5  },
  { label: '6" × 9" — common', w: 6,    h: 9    },
  { label: '6.14" × 9.21"',    w: 6.14, h: 9.21 },
  { label: '7" × 10"',         w: 7,    h: 10   },
  { label: '8" × 10"',         w: 8,    h: 10   },
  { label: '8.5" × 11"',       w: 8.5,  h: 11   },
];

const CONCEPT_TYPES = [
  { id: "authority", label: "Business Bestseller" },
  { id: "premium",   label: "Premium Authority"   },
  { id: "minimal",   label: "Modern Minimalist"   },
  { id: "metaphor",  label: "Visual Metaphor"     },
  { id: "dynamic",   label: "Creative AI Concept" },
];

const CONCEPT_DEFAULTS = {
  authority: { bg: "#0f1923", accent: "#d4961a", text: "#ffffff", secondary: "#1a2c3d" },
  premium:   { bg: "#2c2416", accent: "#8b7355", text: "#1a1008", secondary: "#f5f0e8" },
  minimal:   { bg: "#0052cc", accent: "#ffffff", text: "#ffffff", secondary: "#003d99" },
  metaphor:  { bg: "#1e1b4b", accent: "#c084fc", text: "#ffffff", secondary: "#312e81" },
  dynamic:   { bg: "#0c0c0c", accent: "#ff3b3b", text: "#f5f5f5", secondary: "#1a1a1a" },
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = (hex || "#000").replace("#", "");
  const full = h.length === 3 ? h.split("").map(x => x + x).join("") : h;
  const n = parseInt(full, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(r, g, b) {
  const c = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
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

function escSvg(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrapText(text, fontSize, maxWidth) {
  const maxChars = Math.max(5, Math.floor(maxWidth / (fontSize * 0.54)));
  const words = (text || "").split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 6);
}

function downloadSVG(svgStr, filename) {
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadPNG(svgStr, filename) {
  const W = 1600, H = 2560;
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    canvas.getContext("2d").drawImage(img, 0, 0, W, H);
    canvas.toBlob((pngBlob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(pngBlob);
      a.download = filename; a.click();
    }, "image/png");
    URL.revokeObjectURL(url);
  };
  img.onerror = () => { downloadSVG(svgStr, filename.replace(".png", ".svg")); URL.revokeObjectURL(url); };
  img.src = url;
}

// ─── Single Source of Truth ───────────────────────────────────────────────────
// Both the React preview and SVG export consume this object — zero drift.

function buildCoverData(conceptArg, cover, title) {
  const type = typeof conceptArg === "string"
    ? conceptArg
    : (conceptArg?.type || conceptArg?.id || "authority");
  const def = CONCEPT_DEFAULTS[type] || CONCEPT_DEFAULTS.authority;
  const c = (typeof conceptArg === "object" && conceptArg) ? conceptArg : {};
  return {
    type,
    title:       String(title || "Book Title"),
    subtitle:    String(cover?.subtitle   || ""),
    author:      String(cover?.authorLine || "Author Name"),
    tagline:     String(c.tagline || cover?.tagline || ""),
    bg:          c.bg        || def.bg,
    accent:      c.accent    || def.accent,
    text:        c.text      || def.text,
    secondary:   c.secondary || def.secondary,
    designNotes: c.designNotes || "",
  };
}

// ─── SVG Builders ─────────────────────────────────────────────────────────────
// 1600 × 2560 px (5:8 KDP ratio). Each produces a completely different visual.

const SW = 1600, SH = 2560;

function buildAuthoritySVG(cd) {
  const { bg, accent, text, title, subtitle, author, tagline } = cd;
  const PX = 128, PY = 128;
  const tSz = 190, sSz = 88, aSz = 68, tgSz = 54;
  const bandY = Math.round(SH * 0.62);
  const bandH = Math.round(SH * 0.028);
  const tLines = wrapText(title.toUpperCase(), tSz, SW - PX * 2);
  const tLH = Math.round(tSz * 0.93);
  const tBot = bandY - Math.round(SH * 0.035);
  const tTop = tBot - tLines.length * tLH;
  const sLines = subtitle ? wrapText(subtitle, sSz, SW - PX * 2) : [];
  const sY0 = bandY + bandH + Math.round(SH * 0.028);
  const tgEl = tagline
    ? `<text x="${PX}" y="${PY + tgSz}" font-family="Impact,'Arial Black',sans-serif" font-size="${tgSz}" font-weight="700" fill="${accent}" letter-spacing="6" text-anchor="start">${escSvg(tagline.toUpperCase())}</text>`
    : "";
  const titleEl = tLines.map((l, i) =>
    `<text x="${PX}" y="${tTop + i * tLH + tSz}" font-family="Impact,'Arial Black',sans-serif" font-size="${tSz}" font-weight="900" fill="${text}" letter-spacing="-2" text-anchor="start">${escSvg(l)}</text>`
  ).join("\n  ");
  const subEl = sLines.map((l, i) =>
    `<text x="${PX}" y="${sY0 + i * Math.round(sSz * 1.35) + sSz}" font-family="Arial,sans-serif" font-size="${sSz}" fill="${text}" opacity="0.82" text-anchor="start">${escSvg(l)}</text>`
  ).join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <rect width="${SW}" height="${SH}" fill="${bg}"/>
  <pattern id="diag" width="40" height="40" patternUnits="userSpaceOnUse"><line x1="0" y1="40" x2="40" y2="0" stroke="${text}" stroke-width="1" opacity="0.03"/></pattern>
  <rect width="${SW}" height="${SH}" fill="url(#diag)"/>
  ${tgEl}
  ${titleEl}
  <rect x="0" y="${bandY}" width="${SW}" height="${bandH}" fill="${accent}"/>
  ${subEl}
  <text x="${PX}" y="${SH - PY}" font-family="Impact,'Arial Black',sans-serif" font-size="${aSz}" font-weight="700" fill="${accent}" letter-spacing="8" text-anchor="start">${escSvg(author.toUpperCase())}</text>
</svg>`;
}

function buildPremiumSVG(cd) {
  const { accent, text, secondary, title, subtitle, author, tagline } = cd;
  const bgCol = secondary || "#f5f0e8";
  const PX = 192;
  const tSz = 155, sSz = 78, aSz = 62, tgSz = 48;
  const ruleW = SW - PX * 2;
  const tLines = wrapText(title, tSz, ruleW);
  const tLH = Math.round(tSz * 1.15);
  const tBlockH = tLines.length * tLH;
  const centerY = Math.round(SH * 0.44);
  const tTop = centerY - tBlockH / 2;
  const gap = Math.round(SH * 0.042);
  const topRuleY = tTop - gap;
  const botRuleY = tTop + tBlockH + gap;
  const sLines = subtitle ? wrapText(subtitle, sSz, ruleW) : [];
  const sY0 = botRuleY + Math.round(SH * 0.03);
  const tgEl = tagline
    ? `<text x="${SW / 2}" y="${topRuleY - Math.round(SH * 0.025)}" font-family="Georgia,'Times New Roman',serif" font-size="${tgSz}" fill="${accent}" letter-spacing="5" text-anchor="middle" font-style="italic">${escSvg(tagline)}</text>`
    : "";
  const titleEl = tLines.map((l, i) =>
    `<text x="${SW / 2}" y="${tTop + i * tLH + tSz}" font-family="Georgia,'Times New Roman',serif" font-size="${tSz}" font-weight="700" fill="${text}" letter-spacing="-1" text-anchor="middle">${escSvg(l)}</text>`
  ).join("\n  ");
  const subEl = sLines.map((l, i) =>
    `<text x="${SW / 2}" y="${sY0 + i * Math.round(sSz * 1.4) + sSz}" font-family="Georgia,serif" font-size="${sSz}" fill="${text}" opacity="0.7" text-anchor="middle" font-style="italic">${escSvg(l)}</text>`
  ).join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <rect width="${SW}" height="${SH}" fill="${bgCol}"/>
  ${tgEl}
  <line x1="${PX}" y1="${topRuleY}" x2="${SW - PX}" y2="${topRuleY}" stroke="${accent}" stroke-width="2" opacity="0.7"/>
  ${titleEl}
  <line x1="${PX}" y1="${botRuleY}" x2="${SW - PX}" y2="${botRuleY}" stroke="${accent}" stroke-width="2" opacity="0.7"/>
  ${subEl}
  <text x="${SW / 2}" y="${SH - Math.round(SH * 0.048)}" font-family="Georgia,serif" font-size="${aSz}" font-weight="700" fill="${text}" letter-spacing="6" opacity="0.55" text-anchor="middle">${escSvg(author.toUpperCase())}</text>
</svg>`;
}

function buildMinimalSVG(cd) {
  const { bg, accent, text, title, author, tagline } = cd;
  const PX = 144;
  const tSz = 175, aSz = 60, tgSz = 50;
  const cR = Math.round(SW * 0.52);
  const cX = Math.round(SW * 0.92);
  const cY = Math.round(SH * 0.29);
  const tLines = wrapText(title, tSz, SW * 0.76);
  const tLH = Math.round(tSz * 0.98);
  const tBot = Math.round(SH * 0.74);
  const tTop = tBot - tLines.length * tLH;
  const tgEl = tagline
    ? `<text x="${PX}" y="${Math.round(SH * 0.06) + tgSz}" font-family="Arial,Helvetica,sans-serif" font-size="${tgSz}" fill="${text}" opacity="0.45" letter-spacing="5" text-anchor="start">${escSvg(tagline.toUpperCase())}</text>`
    : "";
  const titleEl = tLines.map((l, i) =>
    `<text x="${PX}" y="${tTop + i * tLH + tSz}" font-family="'Arial Black',Impact,sans-serif" font-size="${tSz}" font-weight="900" fill="${text}" letter-spacing="-3" text-anchor="start">${escSvg(l)}</text>`
  ).join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <rect width="${SW}" height="${SH}" fill="${bg}"/>
  <circle cx="${cX}" cy="${cY}" r="${cR}" fill="${accent}" opacity="0.17"/>
  <circle cx="${cX}" cy="${cY}" r="${Math.round(cR * 0.68)}" fill="${accent}" opacity="0.14"/>
  ${tgEl}
  ${titleEl}
  <rect x="${PX}" y="${tBot + Math.round(SH * 0.018)}" width="${Math.round(SW * 0.22)}" height="${Math.round(SH * 0.007)}" fill="${accent}"/>
  <text x="${PX}" y="${SH - Math.round(SH * 0.048)}" font-family="Arial,Helvetica,sans-serif" font-size="${aSz}" fill="${text}" opacity="0.7" text-anchor="start">${escSvg(author)}</text>
</svg>`;
}

function diamondPts(cx, cy, r) {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
}

function buildMetaphorSVG(cd) {
  const { bg, accent, text, secondary, title, subtitle, author, tagline } = cd;
  const PX = 128;
  const tSz = 145, sSz = 72, aSz = 60, tgSz = 52;
  const sCX = SW / 2, sCY = Math.round(SH * 0.5), sR = Math.round(SW * 0.33);
  const tLines = wrapText(title, tSz, SW - PX * 2);
  const tLH = Math.round(tSz * 1.12);
  const tBot = sCY - sR - Math.round(SH * 0.04);
  const tTop = tBot - tLines.length * tLH;
  const sLines = subtitle ? wrapText(subtitle, sSz, SW - PX * 2) : [];
  const sY0 = sCY + sR + Math.round(SH * 0.025);
  const tgEl = tagline
    ? `<text x="${PX}" y="${Math.round(SH * 0.054)}" font-family="Arial,Helvetica,sans-serif" font-size="${tgSz}" fill="${accent}" letter-spacing="5" text-anchor="start">${escSvg(tagline.toUpperCase())}</text>`
    : "";
  const titleEl = tLines.map((l, i) =>
    `<text x="${SW / 2}" y="${tTop + i * tLH + tSz}" font-family="Georgia,'Times New Roman',serif" font-size="${tSz}" font-weight="700" fill="${text}" letter-spacing="-1" text-anchor="middle">${escSvg(l)}</text>`
  ).join("\n  ");
  const subEl = sLines.map((l, i) =>
    `<text x="${SW / 2}" y="${sY0 + i * Math.round(sSz * 1.4) + sSz}" font-family="Georgia,serif" font-size="${sSz}" fill="${text}" opacity="0.75" text-anchor="middle">${escSvg(l)}</text>`
  ).join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <defs>
    <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="48%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${secondary}"/>
    </linearGradient>
  </defs>
  <rect width="${SW}" height="${SH}" fill="url(#mg)"/>
  <polygon points="${diamondPts(sCX, sCY, sR)}" fill="${accent}" opacity="0.14"/>
  <polygon points="${diamondPts(sCX, sCY, Math.round(sR * 0.74))}" fill="${accent}" opacity="0.2"/>
  <polygon points="${diamondPts(sCX, sCY, Math.round(sR * 0.44))}" fill="${accent}" opacity="0.55"/>
  ${tgEl}
  ${titleEl}
  ${subEl}
  <text x="${SW / 2}" y="${SH - Math.round(SH * 0.04)}" font-family="Arial,Helvetica,sans-serif" font-size="${aSz}" fill="${text}" opacity="0.6" letter-spacing="5" text-anchor="middle">${escSvg(author.toUpperCase())}</text>
</svg>`;
}

function buildDynamicSVG(cd) {
  const { bg, accent, text, title, subtitle, author, tagline } = cd;
  const PX = 110;
  const tSz = 185, sSz = 78, aSz = 65, tgSz = 50;
  const band = [
    `0,${Math.round(SH * 0.1)}`,
    `${Math.round(SW * 0.78)},0`,
    `${SW},${Math.round(SH * 0.075)}`,
    `${Math.round(SW * 0.22)},${Math.round(SH * 0.2)}`,
  ].join(" ");
  const tLines = wrapText(title.toUpperCase(), tSz, SW * 0.84);
  const tLH = Math.round(tSz * 0.91);
  const tTop = Math.round(SH * 0.25);
  const sLines = subtitle ? wrapText(subtitle, sSz, SW * 0.75) : [];
  const sY0 = tTop + tLines.length * tLH + Math.round(SH * 0.028);
  const lineX = Math.round(SW * 0.87);
  const tgEl = tagline
    ? `<text x="${PX}" y="${Math.round(SH * 0.078)}" font-family="'Arial Black',Impact,sans-serif" font-size="${tgSz}" fill="${text}" opacity="0.45" letter-spacing="4" text-anchor="start">${escSvg(tagline.toUpperCase())}</text>`
    : "";
  const titleEl = tLines.map((l, i) =>
    `<text x="${PX}" y="${tTop + i * tLH + tSz}" font-family="Impact,'Arial Black',sans-serif" font-size="${tSz}" font-weight="900" fill="${text}" letter-spacing="-3" text-anchor="start">${escSvg(l)}</text>`
  ).join("\n  ");
  const subEl = sLines.map((l, i) =>
    `<text x="${PX}" y="${sY0 + i * Math.round(sSz * 1.3) + sSz}" font-family="Arial,sans-serif" font-size="${sSz}" fill="${text}" opacity="0.68" text-anchor="start">${escSvg(l)}</text>`
  ).join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <rect width="${SW}" height="${SH}" fill="${bg}"/>
  <polygon points="${band}" fill="${accent}" opacity="0.95"/>
  <line x1="${lineX}" y1="${Math.round(SH * 0.24)}" x2="${lineX}" y2="${Math.round(SH * 0.86)}" stroke="${accent}" stroke-width="4" opacity="0.28"/>
  ${tgEl}
  ${titleEl}
  ${subEl}
  <text x="${PX}" y="${SH - Math.round(SH * 0.048)}" font-family="Impact,'Arial Black',sans-serif" font-size="${aSz}" font-weight="700" fill="${accent}" letter-spacing="8" text-anchor="start">${escSvg(author.toUpperCase())}</text>
</svg>`;
}

function buildConceptSVG(cd) {
  switch (cd.type) {
    case "authority": return buildAuthoritySVG(cd);
    case "premium":   return buildPremiumSVG(cd);
    case "minimal":   return buildMinimalSVG(cd);
    case "metaphor":  return buildMetaphorSVG(cd);
    case "dynamic":   return buildDynamicSVG(cd);
    default:          return buildAuthoritySVG(cd);
  }
}

// ─── React Renderers ──────────────────────────────────────────────────────────
// Each mirrors its SVG builder's visual logic using div/CSS.
// thumb=true uses smaller font sizes for the concept grid thumbnails.

function AuthorityRenderer({ cd, thumb }) {
  const { bg, accent, text, title, subtitle, author, tagline } = cd;
  const TS = thumb ? 8.5 : 27, SS = thumb ? 4 : 11.5, AS = thumb ? 3 : 9, TGS = thumb ? 2.5 : 7.5;
  return (
    <div style={{ background: bg, color: text, width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(255,255,255,0.025) 10px,rgba(255,255,255,0.025) 11px)", pointerEvents: "none" }} />
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: thumb ? "5% 7% 3%" : "6% 8% 3.5%" }}>
        {tagline && (
          <div style={{ fontSize: TGS, fontFamily: "Impact,'Arial Black',sans-serif", fontWeight: 700, color: accent, letterSpacing: thumb ? 0.5 : 2.5, textTransform: "uppercase", marginBottom: thumb ? 1.5 : "2.5%" }}>
            {tagline}
          </div>
        )}
        <div style={{ fontSize: TS, fontFamily: "Impact,'Arial Black',sans-serif", fontWeight: 900, lineHeight: 0.95, letterSpacing: -0.5, textTransform: "uppercase", color: text }}>
          {title}
        </div>
      </div>
      <div style={{ background: accent, flexShrink: 0, height: thumb ? 2.5 : 7 }} />
      <div style={{ flexShrink: 0, padding: thumb ? "2% 7% 5%" : "2.5% 8% 5.5%" }}>
        {subtitle && (
          <div style={{ fontSize: SS, fontFamily: "Arial,sans-serif", fontWeight: 400, lineHeight: 1.4, color: text, opacity: 0.82, marginBottom: thumb ? 1.5 : "3%" }}>
            {subtitle}
          </div>
        )}
        <div style={{ fontSize: AS, fontFamily: "Impact,'Arial Black',sans-serif", fontWeight: 600, letterSpacing: thumb ? 0.5 : 2.5, textTransform: "uppercase", color: accent }}>
          {author}
        </div>
      </div>
    </div>
  );
}

function PremiumRenderer({ cd, thumb }) {
  const { accent, text, secondary, title, subtitle, author, tagline } = cd;
  const bgCol = secondary || "#f5f0e8";
  const TS = thumb ? 8 : 25, SS = thumb ? 3.5 : 10, AS = thumb ? 2.8 : 8, TGS = thumb ? 2.2 : 6.5;
  return (
    <div style={{ background: bgCol, color: text, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ width: "76%", textAlign: "center" }}>
        {tagline && (
          <div style={{ fontSize: TGS, fontFamily: "Georgia,serif", fontStyle: "italic", color: accent, letterSpacing: thumb ? 0.5 : 3, textTransform: "uppercase", marginBottom: thumb ? 2 : "5%", opacity: 0.9 }}>
            {tagline}
          </div>
        )}
        <div style={{ height: thumb ? 0.5 : 1, background: accent, opacity: 0.65, marginBottom: thumb ? 2.5 : "5%" }} />
        <div style={{ fontSize: TS, fontFamily: "Georgia,'Times New Roman',serif", fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.3, color: text }}>
          {title}
        </div>
        <div style={{ height: thumb ? 0.5 : 1, background: accent, opacity: 0.65, marginTop: thumb ? 2.5 : "5%", marginBottom: thumb ? 2 : "4%" }} />
        {subtitle && (
          <div style={{ fontSize: SS, fontFamily: "Georgia,serif", fontStyle: "italic", lineHeight: 1.4, color: text, opacity: 0.72 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ position: "absolute", bottom: thumb ? "4%" : "5.5%", textAlign: "center", fontSize: AS, fontFamily: "Georgia,serif", fontWeight: 700, letterSpacing: thumb ? 0.5 : 2.5, textTransform: "uppercase", color: text, opacity: 0.55 }}>
        {author}
      </div>
    </div>
  );
}

function MinimalRenderer({ cd, thumb }) {
  const { bg, accent, text, title, author, tagline } = cd;
  const TS = thumb ? 9 : 27, AS = thumb ? 3 : 8, TGS = thumb ? 2 : 6.5;
  return (
    <div style={{ background: bg, color: text, width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: thumb ? "-14%" : "-12%", right: thumb ? "-30%" : "-25%", width: "88%", paddingBottom: "88%", borderRadius: "50%", background: accent, opacity: 0.17, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "4%", right: thumb ? "-13%" : "-10%", width: "60%", paddingBottom: "60%", borderRadius: "50%", background: accent, opacity: 0.13, pointerEvents: "none" }} />
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: thumb ? "5% 7% 5%" : "7% 9% 5.5%" }}>
        {tagline && (
          <div style={{ fontSize: TGS, fontFamily: "Arial,sans-serif", color: text, opacity: 0.45, letterSpacing: thumb ? 0.5 : 3.5, textTransform: "uppercase", marginBottom: thumb ? 1 : "2%" }}>
            {tagline}
          </div>
        )}
        <div style={{ fontSize: TS, fontFamily: "'Arial Black',Impact,sans-serif", fontWeight: 900, lineHeight: 0.97, letterSpacing: -1, color: text }}>
          {title}
        </div>
        <div style={{ height: thumb ? 1.5 : 4, background: accent, width: thumb ? "18%" : "22%", marginTop: thumb ? 1.5 : "3.5%", marginBottom: thumb ? 1.5 : "3.5%" }} />
        <div style={{ fontSize: AS, fontFamily: "Arial,sans-serif", color: text, opacity: 0.7 }}>
          {author}
        </div>
      </div>
    </div>
  );
}

function MetaphorRenderer({ cd, thumb }) {
  const { bg, accent, text, secondary, title, subtitle, author, tagline } = cd;
  const TS = thumb ? 7.5 : 22, SS = thumb ? 3.5 : 9.5, AS = thumb ? 2.8 : 7.5, TGS = thumb ? 2 : 6.5;
  const hex = "polygon(50% 0%,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%)";
  return (
    <div style={{ background: bg, color: text, width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%", background: secondary, opacity: 0.3 }} />
      {[["58%", 0.15], ["43%", 0.2], ["24%", 0.55]].map(([size, op], i) => (
        <div key={i} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: size, paddingBottom: size, clipPath: hex, background: accent, opacity: op }} />
      ))}
      <div style={{ position: "relative", flex: "0 0 42%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: thumb ? "5% 8%" : "5% 10%" }}>
        {tagline && (
          <div style={{ fontSize: TGS, fontFamily: "Arial,sans-serif", color: accent, letterSpacing: thumb ? 0.5 : 3, textTransform: "uppercase", marginBottom: thumb ? 1 : "2%", opacity: 0.9 }}>
            {tagline}
          </div>
        )}
        <div style={{ fontSize: TS, fontFamily: "Georgia,'Times New Roman',serif", fontWeight: 700, lineHeight: 1.1, color: text }}>
          {title}
        </div>
      </div>
      <div style={{ position: "relative", flex: "0 0 18%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", textAlign: "center", padding: thumb ? "0 8% 5%" : "0 10% 6%" }}>
        {subtitle && (
          <div style={{ fontSize: SS, fontFamily: "Georgia,serif", fontStyle: "italic", color: text, opacity: 0.75, marginBottom: thumb ? 1 : "2.5%" }}>
            {subtitle}
          </div>
        )}
        <div style={{ fontSize: AS, fontFamily: "Arial,sans-serif", color: text, opacity: 0.6, letterSpacing: thumb ? 0.5 : 2.5, textTransform: "uppercase" }}>
          {author}
        </div>
      </div>
    </div>
  );
}

function DynamicRenderer({ cd, thumb }) {
  const { bg, accent, text, title, subtitle, author, tagline } = cd;
  const TS = thumb ? 8.5 : 24, SS = thumb ? 3.5 : 9, AS = thumb ? 2.8 : 7.5, TGS = thumb ? 2 : 6.5;
  return (
    <div style={{ background: bg, color: text, width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: "-20%", height: thumb ? "19%" : "18%", background: accent, transform: `skewY(${thumb ? -5 : -4}deg)`, transformOrigin: "top left" }} />
      <div style={{ position: "absolute", top: "22%", bottom: "15%", right: thumb ? "8%" : "9%", width: thumb ? 0.5 : 1.5, background: accent, opacity: 0.28 }} />
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: thumb ? "21% 7% 5%" : "22% 8% 5.5%" }}>
        {tagline && (
          <div style={{ fontSize: TGS, fontFamily: "'Arial Black',Impact,sans-serif", color: text, opacity: 0.42, letterSpacing: thumb ? 0.5 : 3, textTransform: "uppercase", marginBottom: thumb ? 1 : "2%" }}>
            {tagline}
          </div>
        )}
        <div style={{ fontSize: TS, fontFamily: "Impact,'Arial Black',sans-serif", fontWeight: 900, lineHeight: 0.95, letterSpacing: -0.5, textTransform: "uppercase", color: text }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: SS, fontFamily: "Arial,sans-serif", color: text, opacity: 0.65, lineHeight: 1.4, marginTop: thumb ? 1.5 : "3%", paddingRight: thumb ? "14%" : "13%" }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ position: "relative", padding: thumb ? "0 7% 5%" : "0 8% 5.5%" }}>
        <div style={{ fontSize: AS, fontFamily: "Impact,'Arial Black',sans-serif", fontWeight: 700, color: accent, letterSpacing: thumb ? 0.5 : 3, textTransform: "uppercase" }}>
          {author}
        </div>
      </div>
    </div>
  );
}

function ConceptRenderer({ cd, thumb }) {
  if (!cd) return null;
  switch (cd.type) {
    case "authority": return <AuthorityRenderer cd={cd} thumb={thumb} />;
    case "premium":   return <PremiumRenderer   cd={cd} thumb={thumb} />;
    case "minimal":   return <MinimalRenderer   cd={cd} thumb={thumb} />;
    case "metaphor":  return <MetaphorRenderer  cd={cd} thumb={thumb} />;
    case "dynamic":   return <DynamicRenderer   cd={cd} thumb={thumb} />;
    default:          return <AuthorityRenderer cd={cd} thumb={thumb} />;
  }
}

// ─── Back Cover / Spine ───────────────────────────────────────────────────────

function BackCoverPreview({ cd, cover }) {
  return (
    <div style={{ background: cd.bg, color: cd.text, width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "8%", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: cd.accent }} />
      {cover?.backCoverHook && (
        <div style={{ fontSize: 8, fontFamily: "Georgia,serif", fontWeight: 700, lineHeight: 1.4, marginBottom: "5%", color: cd.text }}>
          {cover.backCoverHook}
        </div>
      )}
      {cover?.backDescription && (
        <div style={{ fontSize: 6, fontFamily: "Arial,sans-serif", lineHeight: 1.6, opacity: 0.84, flex: 1 }}>
          {cover.backDescription.slice(0, 280)}{cover.backDescription.length > 280 ? "…" : ""}
        </div>
      )}
      {cover?.backReviewQuotes && (
        <div style={{ fontSize: 5.5, fontFamily: "Georgia,serif", fontStyle: "italic", opacity: 0.7, marginBottom: "3%", borderLeft: `2px solid ${cd.accent}`, paddingLeft: "4%" }}>
          {cover.backReviewQuotes.slice(0, 100)}{cover.backReviewQuotes.length > 100 ? "…" : ""}
        </div>
      )}
      <div style={{ marginTop: "auto" }}>
        {cover?.backAuthorBio && (
          <div style={{ fontSize: 5.5, fontFamily: "Arial,sans-serif", opacity: 0.65, marginBottom: "4%" }}>
            {cover.backAuthorBio.slice(0, 120)}{cover.backAuthorBio.length > 120 ? "…" : ""}
          </div>
        )}
        <div style={{ width: "34%", height: "11%", border: `1px solid ${cd.text}`, opacity: 0.28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 4.5, fontFamily: "monospace", color: cd.text }}>
          BARCODE
        </div>
      </div>
    </div>
  );
}

function SpinePreview({ cd, spineInches, trimHeight, previewH }) {
  const w = Math.max(8, Math.round((spineInches / trimHeight) * previewH * (trimHeight / 9)));
  const hasText = spineInches >= 0.25;
  return (
    <div style={{ width: w, flexShrink: 0, background: cd.accent, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {hasText && (
        <div style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)", fontSize: 7, fontFamily: "Impact,'Arial Black',sans-serif", fontWeight: 700, color: cd.bg, letterSpacing: 1, whiteSpace: "nowrap", overflow: "hidden", maxHeight: "90%", padding: "4px 0" }}>
          {cd.title} {cd.author ? `· ${cd.author}` : ""}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = [
  { id: "concepts", label: "Concepts"   },
  { id: "text",     label: "Cover Text" },
  { id: "kdp",      label: "KDP Setup"  },
  { id: "back",     label: "Back Cover" },
  { id: "export",   label: "Export"     },
];

export default function BookCoverStep({ bookCover, setBookCover, fullProject, errors }) {
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState("concepts");
  const visitRef = useRef(false);

  const cover = (bookCover && typeof bookCover === "object") ? bookCover : {};
  const title = resolveBookTitle(fullProject);
  const trimSize = KDP_TRIM_SIZES[cover.trimSizeIndex ?? 4];
  const spineInches = calcSpineInches(Number(cover.pageCount) || 200, cover.paperType || "white");

  const rawConcepts = Array.isArray(cover.concepts) && cover.concepts.length >= 5
    ? cover.concepts
    : CONCEPT_TYPES.map(ct => ({ ...CONCEPT_DEFAULTS[ct.id], type: ct.id, label: ct.label, tagline: cover.tagline || "" }));

  const selectedIdx = cover.selectedConceptIndex ?? 0;
  const selectedConcept = rawConcepts[selectedIdx] || rawConcepts[0];
  const selectedCD = buildCoverData(selectedConcept, cover, title);

  useEffect(() => {
    if (visitRef.current) return;
    visitRef.current = true;
    const author = resolveAuthorName(fullProject);
    setBookCover(prev => {
      const p = (prev && typeof prev === "object") ? prev : {};
      const def = CONCEPT_DEFAULTS.authority;
      return {
        subtitle:             p.subtitle             ?? "",
        tagline:              p.tagline              ?? "",
        authorLine:           p.authorLine           || author,
        primaryColor:         p.primaryColor         || def.bg,
        accentColor:          p.accentColor          || def.accent,
        textColor:            p.textColor            || def.text,
        designNotes:          p.designNotes          ?? "",
        trimSizeIndex:        p.trimSizeIndex        ?? 4,
        pageCount:            p.pageCount            ?? 200,
        paperType:            p.paperType            || "white",
        backDescription:      p.backDescription      ?? "",
        backAuthorBio:        p.backAuthorBio        ?? "",
        backCoverHook:        p.backCoverHook        ?? "",
        backReviewQuotes:     p.backReviewQuotes     ?? "",
        backCoverCTA:         p.backCoverCTA         ?? "",
        selectedConceptIndex: p.selectedConceptIndex ?? 0,
        concepts:             p.concepts             ?? null,
        generatedAt:          p.generatedAt          ?? null,
      };
    });
  }, [fullProject, setBookCover]);

  function patch(partial) {
    setBookCover(prev => ({ ...(prev && typeof prev === "object" ? prev : {}), ...partial }));
  }

  function selectConcept(idx) {
    const c = rawConcepts[idx];
    if (!c) return;
    patch({
      selectedConceptIndex: idx,
      primaryColor: c.bg     || CONCEPT_DEFAULTS[c.type || "authority"].bg,
      accentColor:  c.accent || CONCEPT_DEFAULTS[c.type || "authority"].accent,
      textColor:    c.text   || CONCEPT_DEFAULTS[c.type || "authority"].text,
    });
  }

  function patchConcept(idx, fields) {
    const updated = rawConcepts.map((c, i) => i === idx ? { ...c, ...fields } : c);
    const sync = { concepts: updated };
    if (idx === selectedIdx) {
      if (fields.bg)     sync.primaryColor = fields.bg;
      if (fields.accent) sync.accentColor  = fields.accent;
      if (fields.text)   sync.textColor    = fields.text;
    }
    patch(sync);
  }

  async function generateConcepts() {
    setGenerating(true); setStatus("");
    try {
      const bd = fullProject?.bookDetails || {};
      const data = await aiFetch("/api/ai/cover-concepts", {
        title,
        subtitle:    cover.subtitle || bd.subtitle   || "",
        genre:       resolveGenre(fullProject),
        audience:    resolveAudience(fullProject),
        tone:        resolveTone(fullProject),
        corePromise: bd.corePromise || "",
        coreThesis:  bd.coreThesis  || "",
        authorName:  resolveAuthorName(fullProject),
        positioning: resolveUsp(fullProject),
      });
      if (Array.isArray(data.concepts) && data.concepts.length > 0) {
        const merged = CONCEPT_TYPES.map((ct, i) => {
          const match = data.concepts.find(c => c.type === ct.id) || data.concepts[i] || {};
          return { ...CONCEPT_DEFAULTS[ct.id], type: ct.id, label: ct.label, ...match };
        });
        const first = merged[0];
        patch({ concepts: merged, selectedConceptIndex: 0, primaryColor: first.bg, accentColor: first.accent, textColor: first.text, generatedAt: new Date().toISOString() });
        setStatus("5 cover concepts generated — click any concept to select and customize it.");
      } else {
        setStatus("Generation returned no data — try again.");
      }
    } catch (e) {
      setStatus(e.message || "Generation failed.");
    } finally { setGenerating(false); }
  }

  const slug = title.slice(0, 30).replace(/[^a-z0-9]/gi, "-").toLowerCase();

  function copyKDPSpec() {
    const ct = CONCEPT_TYPES.find(t => t.id === selectedConcept?.type) || CONCEPT_TYPES[0];
    const lines = [
      `KDP COVER SPEC — ${title}`,
      `Concept: ${ct.label}`,
      `Trim size: ${trimSize.label}`,
      `Page count: ${Number(cover.pageCount) || 200}`,
      `Paper: ${cover.paperType || "white"}`,
      `Spine width: ${spineInches.toFixed(3)}"`,
      `Full wrap: ${(trimSize.w * 2 + spineInches + 0.25).toFixed(3)}" × ${(trimSize.h + 0.25).toFixed(3)}"`,
      "",
      `Background: ${selectedCD.bg}`,
      `Accent: ${selectedCD.accent}`,
      `Text: ${selectedCD.text}`,
      "",
      `Design notes: ${selectedConcept?.designNotes || "(none)"}`,
      "",
      "KDP bleed: 0.125\" on all sides",
      "Resolution: 300 DPI minimum",
      "Color: RGB for digital, CMYK for print-ready PDF",
    ];
    navigator.clipboard.writeText(lines.join("\n"))
      .then(() => setStatus("KDP spec copied to clipboard!"))
      .catch(() => setStatus("Copy failed — try manually."));
  }

  // Preview geometry
  const PREV_H = 300;
  const frontW = Math.round((trimSize.w / trimSize.h) * PREV_H);
  const WRAP_H = Math.round(PREV_H * 0.72);
  const wrapFW = Math.round(frontW * 0.72);

  return (
    <section className="mx-auto max-w-7xl">
      {status && (
        <p className="mb-4 rounded-lg bg-indigo-50 px-4 py-2.5 text-center text-sm font-medium text-indigo-800">{status}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">

        {/* ── Left: Controls ── */}
        <div>
          <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {TABS.map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="book-panel p-5">

            {/* CONCEPTS ─────────────────────────────────────────────────────── */}
            {tab === "concepts" && (
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">5 Unique Cover Directions</h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">AI generates five completely different visual concepts for your book. Click any thumbnail to select it, then customize colors below.</p>
                  </div>
                  <button type="button" onClick={generateConcepts} disabled={generating}
                    className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-indigo-700 disabled:opacity-60 whitespace-nowrap">
                    {generating ? "Generating…" : "✦ Generate Concepts"}
                  </button>
                </div>

                {/* 5-up thumbnail grid */}
                <div className="grid grid-cols-5 gap-3">
                  {rawConcepts.map((concept, idx) => {
                    const cd = buildCoverData(concept, cover, title);
                    const ct = CONCEPT_TYPES[idx] || CONCEPT_TYPES[0];
                    const isSel = idx === selectedIdx;
                    return (
                      <div key={idx} className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => selectConcept(idx)}
                          style={{ aspectRatio: "5/8", display: "block", width: "100%", position: "relative", overflow: "hidden", borderRadius: 8 }}
                          className={`transition-all ${isSel ? "ring-2 ring-indigo-500 ring-offset-2 shadow-lg scale-[1.02]" : "ring-1 ring-slate-200 hover:ring-indigo-300 hover:shadow-md"}`}>
                          <div style={{ position: "absolute", inset: 0 }}>
                            <ConceptRenderer cd={cd} thumb />
                          </div>
                        </button>
                        <div className={`text-center text-[9px] font-semibold leading-tight ${isSel ? "text-indigo-600" : "text-slate-500"}`}>
                          {ct.label}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Design notes for selected concept */}
                {selectedConcept?.designNotes && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <div className="text-xs font-bold text-indigo-800 mb-1">
                      {CONCEPT_TYPES.find(t => t.id === selectedConcept.type)?.label || "Selected Concept"}
                    </div>
                    <p className="text-xs text-indigo-700 leading-relaxed">{selectedConcept.designNotes}</p>
                  </div>
                )}

                {/* Color customization for selected */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800">Customize Colors</h4>
                    <span className="text-[10px] text-slate-400">
                      Editing: {CONCEPT_TYPES.find(t => t.id === selectedConcept?.type)?.label || "—"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: "bg",     label: "Background" },
                      { key: "accent", label: "Accent"     },
                      { key: "text",   label: "Text"       },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <div className="text-[11px] font-semibold text-slate-700 mb-1">{label}</div>
                        <div className="flex items-center gap-1.5">
                          <input type="color"
                            className="h-8 w-10 cursor-pointer rounded border border-slate-200 p-0.5"
                            value={selectedCD[key] || "#000000"}
                            onChange={e => patchConcept(selectedIdx, { [key]: e.target.value })}
                          />
                          <input
                            className="input-light flex-1 text-[11px] font-mono py-1.5"
                            value={selectedCD[key] || ""}
                            onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) patchConcept(selectedIdx, { [key]: e.target.value }); }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedConcept?.type === "premium" && (
                    <div>
                      <div className="text-[11px] font-semibold text-slate-700 mb-1">Page Color (light background)</div>
                      <div className="flex items-center gap-1.5">
                        <input type="color"
                          className="h-8 w-10 cursor-pointer rounded border border-slate-200 p-0.5"
                          value={selectedCD.secondary || "#f5f0e8"}
                          onChange={e => patchConcept(selectedIdx, { secondary: e.target.value })}
                        />
                        <input
                          className="input-light flex-1 text-[11px] font-mono py-1.5"
                          value={selectedCD.secondary || ""}
                          onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) patchConcept(selectedIdx, { secondary: e.target.value }); }}
                        />
                      </div>
                    </div>
                  )}
                  {(() => {
                    const ratio = contrastRatio(selectedCD.text, selectedCD.bg);
                    const ok = ratio >= 4.5, warn = ratio >= 3;
                    return (
                      <div className={`rounded-lg px-3 py-2 text-xs font-medium ${ok ? "bg-emerald-50 text-emerald-700" : warn ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                        Contrast {ratio.toFixed(1)}:1 — {ok ? "WCAG AA ✓ — good for print" : warn ? "Marginal — may look faded in print" : "Poor — text will be unreadable"}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* TEXT ─────────────────────────────────────────────────────────── */}
            {tab === "text" && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-800">Subtitle</label>
                  <p className="text-[11px] text-slate-400 mt-0.5 mb-1">Appears below the main title — describes the book's core promise</p>
                  <input className="input-light mt-0.5 text-sm" value={cover.subtitle || ""} onChange={e => patch({ subtitle: e.target.value })} placeholder="A practical guide to…" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-800">Tagline</label>
                  <p className="text-[11px] text-slate-400 mt-0.5 mb-1">Short punchy hook — 4–8 words, appears at the top of the cover</p>
                  <input className="input-light text-sm" value={cover.tagline || ""}
                    onChange={e => {
                      const val = e.target.value;
                      const updated = rawConcepts.map(c => ({ ...c, tagline: (c.tagline === cover.tagline || !c.tagline) ? val : c.tagline }));
                      patch({ tagline: val, concepts: updated });
                    }}
                    placeholder="The system that changes everything"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-800">Author Line</label>
                  <p className="text-[11px] text-slate-400 mt-0.5 mb-1">Exactly as it should appear on the cover</p>
                  <input className="input-light mt-0.5 text-sm" value={cover.authorLine || ""} onChange={e => patch({ authorLine: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-800">Design Notes</label>
                  <p className="text-[11px] text-slate-400 mt-0.5 mb-1">Optional notes for yourself or a professional cover designer</p>
                  <textarea className="input-light mt-0.5 min-h-[80px] resize-y text-sm" value={cover.designNotes || ""} onChange={e => patch({ designNotes: e.target.value })} placeholder="Typography mood, visual references, elements to emphasize…" />
                </div>
              </div>
            )}

            {/* KDP ──────────────────────────────────────────────────────────── */}
            {tab === "kdp" && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-800">Trim Size</label>
                    <select className="input-light mt-1 text-sm" value={cover.trimSizeIndex ?? 4} onChange={e => patch({ trimSizeIndex: Number(e.target.value) })}>
                      {KDP_TRIM_SIZES.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-800">Page Count</label>
                    <input type="number" min={24} max={828} className="input-light mt-1 text-sm"
                      value={Number(cover.pageCount) || 200}
                      onChange={e => patch({ pageCount: Number(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-800">Paper Type</label>
                  <div className="mt-1 flex gap-2">
                    {["white", "cream"].map(p => (
                      <button key={p} type="button" onClick={() => patch({ paperType: p })}
                        className={`flex-1 rounded-lg border py-2 text-xs font-semibold capitalize transition ${(cover.paperType || "white") === p ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 space-y-2">
                  <div className="text-xs font-bold text-sky-800">Calculated Dimensions</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-sky-900">
                    <div>Spine width: <strong>{spineInches.toFixed(3)}"</strong></div>
                    <div>Spine text: <strong>{spineInches >= 0.25 ? "Yes ✓" : "Too narrow"}</strong></div>
                    <div>Full wrap W: <strong>{(trimSize.w * 2 + spineInches + 0.25).toFixed(3)}"</strong></div>
                    <div>Full wrap H: <strong>{(trimSize.h + 0.25).toFixed(3)}"</strong></div>
                  </div>
                  {spineInches < 0.25 && (
                    <div className="text-xs font-semibold text-amber-700">⚠ Spine too narrow for text — increase page count above ~100 pages.</div>
                  )}
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600 space-y-1.5">
                  <div className="font-semibold text-slate-800 mb-0.5">KDP Print Requirements</div>
                  <div>· Bleed: 0.125" on all sides (add to all dimensions above)</div>
                  <div>· Resolution: 300 DPI minimum for sharp print quality</div>
                  <div>· Color: RGB for digital preview, CMYK for print-ready PDF</div>
                  <div>· Barcode safe zone: bottom-right of back cover, ≥ 2" × 1.2"</div>
                </div>
                <button type="button" onClick={copyKDPSpec}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  📋 Copy Full KDP Spec to Clipboard
                </button>
              </div>
            )}

            {/* BACK COVER ───────────────────────────────────────────────────── */}
            {tab === "back" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">The full wrap preview updates live as you type. All fields are optional.</p>
                <div>
                  <label className="text-xs font-semibold text-slate-800">Back Cover Hook</label>
                  <p className="text-[11px] text-slate-400 mt-0.5 mb-1">Opening line that grabs the browser's attention</p>
                  <textarea className="input-light mt-0.5 min-h-[60px] resize-y text-sm" value={cover.backCoverHook || ""} onChange={e => patch({ backCoverHook: e.target.value })} placeholder="What if everything you believed about X was wrong?" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-800">Back Cover Description</label>
                  <textarea className="input-light mt-1 min-h-[110px] resize-y text-sm" value={cover.backDescription || ""} onChange={e => patch({ backDescription: e.target.value })} placeholder="In this book, you'll discover…" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-800">Review Quotes</label>
                  <textarea className="input-light mt-1 min-h-[70px] resize-y text-sm" value={cover.backReviewQuotes || ""} onChange={e => patch({ backReviewQuotes: e.target.value })} placeholder={`"A must-read." — Name, Title`} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-800">Author Bio (short version)</label>
                  <textarea className="input-light mt-1 min-h-[70px] resize-y text-sm" value={cover.backAuthorBio || ""} onChange={e => patch({ backAuthorBio: e.target.value })} placeholder="2–3 sentence bio for the back cover…" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-800">Call to Action</label>
                  <input className="input-light mt-1 text-sm" value={cover.backCoverCTA || ""} onChange={e => patch({ backCoverCTA: e.target.value })} placeholder="Start reading today and transform your…" />
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  ⬛ Barcode area (bottom-right corner of back cover) is reserved — leave that zone clear in your final print-ready design.
                </div>
              </div>
            )}

            {/* EXPORT ───────────────────────────────────────────────────────── */}
            {tab === "export" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Export Selected Concept</h3>
                  <p className="text-xs text-slate-500">All exports use the identical cover data as the preview — no differences between what you see and what you get.</p>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Front Cover</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => downloadSVG(buildConceptSVG(selectedCD), `${slug}-${selectedCD.type}.svg`)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      ↓ SVG (vector)
                    </button>
                    <button type="button" onClick={() => downloadPNG(buildConceptSVG(selectedCD), `${slug}-${selectedCD.type}.png`)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      ↓ PNG (1600 × 2560)
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ebook Cover (no subtitle)</div>
                  <button type="button" onClick={() => downloadSVG(buildConceptSVG({ ...selectedCD, subtitle: "" }), `${slug}-${selectedCD.type}-ebook.svg`)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                    ↓ Ebook SVG (subtitle stripped)
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">All 5 Concepts</div>
                  <div className="grid grid-cols-5 gap-2">
                    {rawConcepts.map((concept, idx) => {
                      const cd = buildCoverData(concept, cover, title);
                      const ct = CONCEPT_TYPES[idx];
                      return (
                        <button key={idx} type="button"
                          title={`Download ${ct?.label} SVG`}
                          onClick={() => downloadSVG(buildConceptSVG(cd), `${slug}-${cd.type}.svg`)}
                          className="rounded-lg border border-slate-200 bg-white py-1.5 px-1 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:border-slate-300 truncate">
                          {ct?.label.split(" ")[0]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400">Click each button to download that concept's SVG</p>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">KDP Specification</div>
                  <button type="button" onClick={copyKDPSpec}
                    className="w-full rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100">
                    📋 Copy KDP Spec to Clipboard
                  </button>
                </div>

                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800 space-y-1">
                  <div><strong>SVG:</strong> Scalable vector, 1600 × 2560 native. Open in Illustrator, Affinity Designer, or Inkscape for 300 DPI PDF.</div>
                  <div><strong>PNG:</strong> 1600 × 2560 px rasterized. System fonts — may differ slightly from screen preview with web fonts.</div>
                  <div><strong>KDP submit:</strong> Requires PDF with 0.125" bleed. SVG → professional app → PDF for final submission.</div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Right: Preview ── */}
        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">

          {/* Large front cover preview */}
          <div>
            <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {CONCEPT_TYPES.find(t => t.id === selectedConcept?.type)?.label || "Cover"} Preview
            </p>
            <div className="mx-auto overflow-hidden rounded-lg shadow-xl" style={{ width: frontW, height: PREV_H }}>
              <ConceptRenderer cd={selectedCD} />
            </div>
            <div className="mt-2 flex justify-center gap-2">
              <button type="button" onClick={() => downloadSVG(buildConceptSVG(selectedCD), `${slug}-${selectedCD.type}.svg`)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition">
                ↓ SVG
              </button>
              <button type="button" onClick={() => downloadPNG(buildConceptSVG(selectedCD), `${slug}-${selectedCD.type}.png`)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition">
                ↓ PNG
              </button>
            </div>
          </div>

          {/* Full wrap preview */}
          <div>
            <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Full Wrap</p>
            <div className="flex justify-center overflow-x-auto">
              <div style={{ display: "flex", height: WRAP_H, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", flexShrink: 0 }}>
                <div style={{ width: wrapFW, flexShrink: 0 }}>
                  <BackCoverPreview cd={selectedCD} cover={cover} />
                </div>
                <SpinePreview cd={selectedCD} spineInches={spineInches} trimHeight={trimSize.h} previewH={WRAP_H} />
                <div style={{ width: wrapFW, flexShrink: 0 }}>
                  <ConceptRenderer cd={selectedCD} />
                </div>
              </div>
            </div>
            <p className="mt-1 text-center text-[9px] text-slate-400">
              {trimSize.label} · Spine {spineInches.toFixed(3)}" · {Number(cover.pageCount) || 200} pages
            </p>
          </div>

          {/* Amazon thumbnail + compliance badges */}
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Thumbnail</p>
              <div style={{ width: 72, height: 115, borderRadius: 3, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
                <ConceptRenderer cd={selectedCD} thumb />
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              {(() => {
                const ratio = contrastRatio(selectedCD.text, selectedCD.bg);
                const pc = Number(cover.pageCount) || 200;
                const items = [];
                if      (ratio < 3)   items.push({ cls: "bg-red-50 text-red-700",       msg: `Contrast ${ratio.toFixed(1)}:1 — too low for print` });
                else if (ratio < 4.5) items.push({ cls: "bg-amber-50 text-amber-700",   msg: `Contrast ${ratio.toFixed(1)}:1 — marginal` });
                else                  items.push({ cls: "bg-emerald-50 text-emerald-700", msg: `Contrast ${ratio.toFixed(1)}:1 — WCAG AA ✓` });
                if (pc < 24)  items.push({ cls: "bg-red-50 text-red-700",     msg: "Page count < 24 (KDP minimum)" });
                if (pc > 828) items.push({ cls: "bg-red-50 text-red-700",     msg: "Page count > 828 (KDP maximum)" });
                if (spineInches < 0.25) items.push({ cls: "bg-amber-50 text-amber-700", msg: "Spine too narrow for text" });
                return items.map((it, i) => (
                  <div key={i} className={`rounded px-2 py-1 text-[11px] font-medium ${it.cls}`}>{it.msg}</div>
                ));
              })()}
            </div>
          </div>

          {/* Summary card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-1.5 text-slate-600">
            <div className="font-semibold text-slate-800 mb-1">Cover Summary</div>
            <div>Concept: <span className="font-medium text-slate-800">{CONCEPT_TYPES.find(t => t.id === selectedConcept?.type)?.label || "—"}</span></div>
            <div>Trim: <span className="font-medium text-slate-800">{trimSize.label}</span></div>
            <div>Spine: <span className="font-medium text-slate-800">{spineInches.toFixed(3)}"</span></div>
            <div>Primary: <span className="font-medium text-slate-800 font-mono">{selectedCD.bg}</span></div>
            <div>Accent: <span className="font-medium text-slate-800 font-mono">{selectedCD.accent}</span></div>
            {cover.generatedAt && (
              <div>Generated: <span className="font-medium text-slate-800">{new Date(cover.generatedAt).toLocaleDateString()}</span></div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
