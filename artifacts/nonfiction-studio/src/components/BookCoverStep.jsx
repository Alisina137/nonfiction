import { useEffect, useRef, useState } from "react";
import {
  resolveAudience, resolveAuthorName, resolveBookTitle,
  resolveGenre, resolveTone, resolveUsp,
} from "@/lib/projectMeta";
import { aiFetch } from "@/lib/ai/aiFetch";

// ─── Constants ────────────────────────────────────────────────────────────────

const KDP_TRIM_SIZES = [
  { label: '5" × 8"',            w: 5,    h: 8    },
  { label: '5.06" × 7.81"',      w: 5.06, h: 7.81 },
  { label: '5.25" × 8"',         w: 5.25, h: 8    },
  { label: '5.5" × 8.5"',        w: 5.5,  h: 8.5  },
  { label: '6" × 9" — common',   w: 6,    h: 9    },
  { label: '6.14" × 9.21"',      w: 6.14, h: 9.21 },
  { label: '7" × 10"',           w: 7,    h: 10   },
  { label: '8" × 10"',           w: 8,    h: 10   },
  { label: '8.5" × 11"',         w: 8.5,  h: 11   },
];

const PHASES = [
  { id: "info",     label: "Book Info"  },
  { id: "strategy", label: "Strategy"   },
  { id: "design",   label: "Design"     },
  { id: "concepts", label: "Concepts"   },
  { id: "review",   label: "Review"     },
];

const CONCEPT_TYPES = [
  { id: "authority", label: "Business Bestseller" },
  { id: "premium",   label: "Premium Editorial"   },
  { id: "minimal",   label: "Modern Minimalist"   },
  { id: "metaphor",  label: "Visual Metaphor"     },
  { id: "dynamic",   label: "Creative Dynamic"    },
  { id: "boldType",  label: "Bold Typography"     },
  { id: "cinematic", label: "Cinematic"            },
  { id: "vibrant",   label: "Vibrant Energy"      },
];

const CONCEPT_DEFAULTS = {
  authority: { bg: "#0f1923", accent: "#d4961a", text: "#ffffff", secondary: "#1a2c3d" },
  premium:   { bg: "#2c2416", accent: "#8b7355", text: "#1a1008", secondary: "#f5f0e8" },
  minimal:   { bg: "#0052cc", accent: "#ffffff", text: "#ffffff", secondary: "#003d99" },
  metaphor:  { bg: "#1e1b4b", accent: "#c084fc", text: "#ffffff", secondary: "#312e81" },
  dynamic:   { bg: "#0c0c0c", accent: "#ff3b3b", text: "#f5f5f5", secondary: "#1a1a1a" },
  boldType:  { bg: "#0d0d1a", accent: "#7c3aed", text: "#f8f8ff", secondary: "#1e0a3c", cssBg: "linear-gradient(155deg,#0d0d1a 0%,#1e0a3c 100%)" },
  cinematic: { bg: "#0a0a0f", accent: "#c9a84c", text: "#f0ede5", secondary: "#1a1225", cssBg: "linear-gradient(175deg,#0a0a0f 0%,#1a1225 55%,#0a0a0f 100%)" },
  vibrant:   { bg: "#e63946", accent: "#ffffff", text: "#ffffff", secondary: "#c1121f" },
};

const WIZARD_GENRES = [
  "Self Help","Business","Health","Psychology","Productivity",
  "Finance","Biography","Fiction","Fantasy","Romance","Thriller","Children's",
];
const WIZARD_STYLES = [
  "Bestseller Style","Minimalist","Premium","Luxury","Corporate",
  "Modern","Illustrated","Cinematic","Vintage","Bold Typography","AI Creative",
];
const WIZARD_MOODS = [
  "Inspirational","Motivational","Empowering","Professional","Mysterious",
  "Hopeful","Exciting","Adventurous","Emotional","Educational",
];
const WIZARD_COLORS = ["Auto","Warm","Cool","Vibrant","Dark","Light","Premium"];
const WIZARD_IMAGERY = ["AI decides","No characters","People","Objects","Abstract","Landscape","Illustration"];

const GENRE_CONCEPT_SCORES = {
  "Self Help":    { authority:95,premium:88,minimal:85,metaphor:80,dynamic:75,boldType:82,cinematic:68,vibrant:78 },
  "Business":     { authority:95,premium:92,minimal:88,metaphor:75,dynamic:80,boldType:85,cinematic:70,vibrant:72 },
  "Health":       { authority:80,premium:85,minimal:90,metaphor:82,dynamic:75,boldType:78,cinematic:72,vibrant:85 },
  "Psychology":   { authority:82,premium:95,minimal:85,metaphor:92,dynamic:78,boldType:80,cinematic:88,vibrant:68 },
  "Productivity": { authority:90,premium:85,minimal:92,metaphor:82,dynamic:85,boldType:88,cinematic:72,vibrant:80 },
  "Finance":      { authority:92,premium:95,minimal:82,metaphor:75,dynamic:78,boldType:80,cinematic:72,vibrant:65 },
  "Biography":    { authority:85,premium:95,minimal:78,metaphor:82,dynamic:72,boldType:75,cinematic:90,vibrant:65 },
  "Fiction":      { authority:60,premium:70,minimal:65,metaphor:88,dynamic:85,boldType:80,cinematic:92,vibrant:82 },
  "Fantasy":      { authority:60,premium:65,minimal:60,metaphor:92,dynamic:88,boldType:78,cinematic:85,vibrant:90 },
  "Romance":      { authority:62,premium:80,minimal:72,metaphor:85,dynamic:78,boldType:70,cinematic:88,vibrant:92 },
  "Thriller":     { authority:75,premium:72,minimal:78,metaphor:80,dynamic:90,boldType:85,cinematic:95,vibrant:70 },
  "Children's":   { authority:60,premium:65,minimal:68,metaphor:75,dynamic:82,boldType:72,cinematic:60,vibrant:95 },
};

const PROF_SCORES = {
  authority:92, premium:95, minimal:88, metaphor:85,
  dynamic:78,   boldType:82, cinematic:90, vibrant:75,
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)] : [0,0,0];
}
function relativeLuminance(r, g, b) {
  const s = [r,g,b].map(c => { const v = c/255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); });
  return 0.2126*s[0] + 0.7152*s[1] + 0.0722*s[2];
}
function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(...hexToRgb(hex1));
  const l2 = relativeLuminance(...hexToRgb(hex2));
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}
function calcSpineInches(pageCount, paperType) {
  const ppi = paperType === "cream" ? 0.0025 : 0.002252;
  return pageCount * ppi;
}
function escSvg(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function wrapText(text, fontSize, maxWidth) {
  const words = String(text).split(/\s+/);
  const charsPerPx = 1.6 / fontSize;
  const maxChars = Math.max(4, Math.floor(maxWidth * charsPerPx));
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (test.length > maxChars && current) { lines.push(current); current = word; }
    else current = test;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}
function downloadSVG(svgStr, filename) {
  const blob = new Blob([svgStr], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click(); URL.revokeObjectURL(url);
}
function downloadPNG(svgStr, filename) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600; canvas.height = 2560;
  const ctx = canvas.getContext("2d");
  const img = new Image();
  const blob = new Blob([svgStr], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
    const a = Object.assign(document.createElement("a"), { href: canvas.toDataURL("image/png"), download: filename });
    a.click(); URL.revokeObjectURL(url);
  };
  img.src = url;
}

// ─── Cover Data Builder ───────────────────────────────────────────────────────

function buildCoverData(conceptArg, cover, title) {
  const type = typeof conceptArg === "string" ? conceptArg
    : (conceptArg?.type || conceptArg?.id || "authority");
  const def = CONCEPT_DEFAULTS[type] || CONCEPT_DEFAULTS.authority;
  const c = (typeof conceptArg === "object" && conceptArg) ? conceptArg : {};
  return {
    type,
    title:       String(title || "Book Title"),
    subtitle:    String(cover?.subtitle || ""),
    author:      String(cover?.authorLine || "Author Name"),
    tagline:     String(c.tagline || cover?.tagline || ""),
    bg:          c.bg        || def.bg,
    accent:      c.accent    || def.accent,
    text:        c.text      || def.text,
    secondary:   c.secondary || def.secondary,
    cssBg:       c.cssBg     || def.cssBg,
    designNotes: c.designNotes || "",
  };
}

// ─── SVG Builders ─────────────────────────────────────────────────────────────

const SW = 1600, SH = 2560;

function buildAuthoritySVG(cd) {
  const { bg, accent, text, title, subtitle, author, tagline } = cd;
  const PX = 112;
  const tSz = 210, sSz = 82, aSz = 70, tgSz = 58;
  const tLines = wrapText(title.toUpperCase(), tSz, SW - PX * 2);
  const tLH = Math.round(tSz * 0.94);
  const tBot = Math.round(SH * 0.63);
  const tTop = tBot - tLines.length * tLH;
  const bandY = Math.round(SH * 0.66);
  const bandH = Math.round(SH * 0.05);
  const sLines = subtitle ? wrapText(subtitle, sSz, SW - PX * 2) : [];
  const sY0 = bandY + bandH + Math.round(SH * 0.025);
  const tgEl = tagline
    ? `<text x="${PX}" y="${Math.round(SH * 0.055) + tgSz}" font-family="Impact,'Arial Black',sans-serif" font-size="${tgSz}" fill="${accent}" letter-spacing="5" text-anchor="start">${escSvg(tagline.toUpperCase())}</text>`
    : "";
  const titleEl = tLines.map((l, i) =>
    `<text x="${PX}" y="${tTop + i * tLH + tSz}" font-family="Impact,'Arial Black',sans-serif" font-size="${tSz}" font-weight="900" fill="${text}" letter-spacing="-4" text-anchor="start">${escSvg(l)}</text>`
  ).join("\n  ");
  const subEl = sLines.map((l, i) =>
    `<text x="${PX}" y="${sY0 + i * Math.round(sSz * 1.35) + sSz}" font-family="Arial,sans-serif" font-size="${sSz}" fill="${text}" opacity="0.82" text-anchor="start">${escSvg(l)}</text>`
  ).join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <defs><pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="14" stroke="${text}" stroke-width="0.5" opacity="0.04"/></pattern></defs>
  <rect width="${SW}" height="${SH}" fill="${bg}"/>
  <rect width="${SW}" height="${SH}" fill="url(#hatch)"/>
  ${tgEl}
  ${titleEl}
  <rect x="0" y="${bandY}" width="${SW}" height="${bandH}" fill="${accent}"/>
  ${subEl}
  <text x="${PX}" y="${SH - Math.round(SH * 0.045)}" font-family="Impact,'Arial Black',sans-serif" font-size="${aSz}" font-weight="700" fill="${accent}" letter-spacing="6" text-anchor="start">${escSvg(author.toUpperCase())}</text>
</svg>`;
}

function buildPremiumSVG(cd) {
  const { accent, text, secondary, title, subtitle, author, tagline } = cd;
  const bgCol = secondary || "#f5f0e8";
  const PX = 160;
  const tSz = 190, sSz = 82, aSz = 68, tgSz = 52;
  const midY = Math.round(SH * 0.44);
  const tLines = wrapText(title, tSz, SW - PX * 2);
  const tLH = Math.round(tSz * 1.1);
  const tBlockH = tLines.length * tLH;
  const tTop = midY - tBlockH / 2;
  const ruleLen = Math.round(SW * 0.55);
  const ruleX = (SW - ruleLen) / 2;
  const sLines = subtitle ? wrapText(subtitle, sSz, SW - PX * 2.5) : [];
  const sY0 = tTop + tBlockH + Math.round(SH * 0.06);
  const tgEl = tagline
    ? `<text x="${SW/2}" y="${tTop - Math.round(SH * 0.05)}" font-family="Georgia,serif" font-size="${tgSz}" fill="${accent}" letter-spacing="4" text-anchor="middle" font-style="italic">${escSvg(tagline)}</text>`
    : "";
  const titleEl = tLines.map((l, i) =>
    `<text x="${SW/2}" y="${tTop + i * tLH + tSz}" font-family="Georgia,'Times New Roman',serif" font-size="${tSz}" font-weight="700" fill="${text}" letter-spacing="-1" text-anchor="middle">${escSvg(l)}</text>`
  ).join("\n  ");
  const subEl = sLines.map((l, i) =>
    `<text x="${SW/2}" y="${sY0 + i * Math.round(sSz * 1.4) + sSz}" font-family="Georgia,serif" font-size="${sSz}" fill="${text}" opacity="0.7" font-style="italic" text-anchor="middle">${escSvg(l)}</text>`
  ).join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <rect width="${SW}" height="${SH}" fill="${bgCol}"/>
  ${tgEl}
  <line x1="${ruleX}" y1="${tTop - Math.round(SH * 0.024)}" x2="${ruleX + ruleLen}" y2="${tTop - Math.round(SH * 0.024)}" stroke="${accent}" stroke-width="1.5" opacity="0.6"/>
  ${titleEl}
  <line x1="${ruleX}" y1="${tTop + tBlockH + Math.round(SH * 0.022)}" x2="${ruleX + ruleLen}" y2="${tTop + tBlockH + Math.round(SH * 0.022)}" stroke="${accent}" stroke-width="1.5" opacity="0.6"/>
  ${subEl}
  <text x="${SW/2}" y="${SH - Math.round(SH * 0.04)}" font-family="Georgia,serif" font-size="${aSz}" fill="${text}" opacity="0.52" letter-spacing="6" text-anchor="middle">${escSvg(author.toUpperCase())}</text>
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
  const barW = Math.round(SW * 0.22);
  const barH = Math.round(SH * 0.007);
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
  <rect x="${PX}" y="${tBot + Math.round(SH * 0.018)}" width="${barW}" height="${barH}" fill="${accent}"/>
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

function buildBoldTypeSVG(cd) {
  const { bg, accent, text, title, author, tagline } = cd;
  const barW = 28, PX = 80, PY = 120;
  const tSz = 230, aSz = 60, tgSz = 50;
  const lines = wrapText(title.toUpperCase(), tSz, SW - PX * 2 - barW - 20);
  const tLH = Math.round(tSz * 0.88);
  const midY = Math.round(SH * 0.48);
  const tBlockH = lines.length * tLH;
  const tTop = midY - tBlockH / 2;
  const tgEl = tagline
    ? `<text x="${barW + PX}" y="${tTop - tgSz - Math.round(SH * 0.025)}" font-family="Arial,sans-serif" font-size="${tgSz}" fill="${accent}" letter-spacing="4" opacity="0.85">${escSvg(tagline.toUpperCase())}</text>`
    : "";
  const titleEl = lines.map((l, i) =>
    `<text x="${barW + PX}" y="${tTop + i * tLH + tSz}" font-family="Impact,'Arial Black',sans-serif" font-size="${tSz}" font-weight="900" fill="${text}" letter-spacing="-2">${escSvg(l)}</text>`
  ).join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <rect width="${SW}" height="${SH}" fill="${bg}"/>
  <rect x="0" y="0" width="${barW}" height="${SH}" fill="${accent}"/>
  ${tgEl}
  ${titleEl}
  <rect x="${barW + PX}" y="${Math.round(tTop + tBlockH + SH * 0.025)}" width="${Math.round(SW * 0.28)}" height="3" fill="${accent}"/>
  <text x="${barW + PX}" y="${SH - 120}" font-family="Arial,Helvetica,sans-serif" font-size="${aSz}" fill="${text}" letter-spacing="5" opacity="0.6">${escSvg(author.toUpperCase())}</text>
</svg>`;
}

function buildCinematicSVG(cd) {
  const { bg, accent, text, title, subtitle, author, tagline } = cd;
  const tSz = 165, sSz = 72, aSz = 60, tgSz = 48;
  const barH = 40;
  const lines = wrapText(title, tSz, SW - 320);
  const tLH = Math.round(tSz * 1.1);
  const midY = Math.round(SH * 0.44);
  const tBlockH = lines.length * tLH;
  const tTop = midY - tBlockH / 2;
  const ruleLen = 320, ruleX = (SW - ruleLen) / 2;
  const tgEl = tagline
    ? `<text x="${SW/2}" y="${tTop - tgSz - 55}" font-family="Georgia,serif" font-size="${tgSz}" fill="${accent}" letter-spacing="3" text-anchor="middle" font-style="italic" opacity="0.85">${escSvg(tagline)}</text>`
    : "";
  const titleEl = lines.map((l, i) =>
    `<text x="${SW/2}" y="${tTop + i * tLH + tSz}" font-family="Georgia,'Times New Roman',serif" font-size="${tSz}" font-weight="700" fill="${text}" letter-spacing="2" text-anchor="middle">${escSvg(l)}</text>`
  ).join("\n  ");
  const sLines = subtitle ? wrapText(subtitle, sSz, SW - 400) : [];
  const sY0 = tTop + tBlockH + 100;
  const subEl = sLines.map((l, i) =>
    `<text x="${SW/2}" y="${sY0 + i * Math.round(sSz * 1.4) + sSz}" font-family="Georgia,serif" font-size="${sSz}" fill="${text}" opacity="0.6" text-anchor="middle" font-style="italic">${escSvg(l)}</text>`
  ).join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <rect width="${SW}" height="${SH}" fill="${bg}"/>
  <rect x="0" y="0" width="${SW}" height="${barH}" fill="${accent}" opacity="0.55"/>
  <rect x="0" y="${SH - barH}" width="${SW}" height="${barH}" fill="${accent}" opacity="0.55"/>
  ${tgEl}
  <line x1="${ruleX}" y1="${tTop - 75}" x2="${ruleX + ruleLen}" y2="${tTop - 75}" stroke="${accent}" stroke-width="1.5" opacity="0.65"/>
  ${titleEl}
  <line x1="${ruleX}" y1="${tTop + tBlockH + 50}" x2="${ruleX + ruleLen}" y2="${tTop + tBlockH + 50}" stroke="${accent}" stroke-width="1.5" opacity="0.65"/>
  ${subEl}
  <text x="${SW/2}" y="${SH - 185}" font-family="Arial,Helvetica,sans-serif" font-size="${aSz}" fill="${accent}" letter-spacing="8" text-anchor="middle" font-weight="600">${escSvg(author.toUpperCase())}</text>
</svg>`;
}

function buildVibrantSVG(cd) {
  const { bg, accent, text, secondary, title, subtitle, author, tagline } = cd;
  const PX = 128, tSz = 175, sSz = 78, aSz = 60, tgSz = 50;
  const lines = wrapText(title, tSz, SW - PX * 2);
  const tLH = Math.round(tSz * 0.96);
  const tBot = Math.round(SH * 0.7);
  const tTop = tBot - lines.length * tLH;
  const sec = secondary || accent;
  const tgEl = tagline
    ? `<text x="${PX}" y="${128 + tgSz}" font-family="Arial,sans-serif" font-size="${tgSz}" fill="${text}" letter-spacing="4" opacity="0.75">${escSvg(tagline.toUpperCase())}</text>`
    : "";
  const titleEl = lines.map((l, i) =>
    `<text x="${PX}" y="${tTop + i * tLH + tSz}" font-family="'Arial Black',Impact,sans-serif" font-size="${tSz}" font-weight="900" fill="${text}" letter-spacing="-1">${escSvg(l)}</text>`
  ).join("\n  ");
  const sLines = subtitle ? wrapText(subtitle, sSz, SW - PX * 2) : [];
  const sY0 = tBot + Math.round(SH * 0.025);
  const subEl = sLines.map((l, i) =>
    `<text x="${PX}" y="${sY0 + i * Math.round(sSz * 1.35) + sSz}" font-family="Arial,sans-serif" font-size="${sSz}" fill="${text}" opacity="0.9">${escSvg(l)}</text>`
  ).join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <rect width="${SW}" height="${SH}" fill="${bg}"/>
  <polygon points="${Math.round(SW * 0.55)},0 ${SW},0 ${SW},${Math.round(SH * 0.65)} ${Math.round(SW * 0.55)},${Math.round(SH * 0.55)}" fill="${sec}" opacity="0.2"/>
  <polygon points="0,${Math.round(SH * 0.6)} ${Math.round(SW * 0.45)},${Math.round(SH * 0.6)} ${Math.round(SW * 0.45)},${SH} 0,${SH}" fill="${accent}" opacity="0.12"/>
  ${tgEl}
  ${titleEl}
  <line x1="${PX}" y1="${sY0 - 22}" x2="${SW - PX}" y2="${sY0 - 22}" stroke="${text}" stroke-width="1.5" opacity="0.18"/>
  ${subEl}
  <text x="${PX}" y="${SH - 128}" font-family="'Arial Black',Arial,sans-serif" font-size="${aSz}" font-weight="700" fill="${text}" letter-spacing="5" opacity="0.85">${escSvg(author.toUpperCase())}</text>
</svg>`;
}

function buildConceptSVG(cd) {
  switch (cd.type) {
    case "authority": return buildAuthoritySVG(cd);
    case "premium":   return buildPremiumSVG(cd);
    case "minimal":   return buildMinimalSVG(cd);
    case "metaphor":  return buildMetaphorSVG(cd);
    case "dynamic":   return buildDynamicSVG(cd);
    case "boldType":  return buildBoldTypeSVG(cd);
    case "cinematic": return buildCinematicSVG(cd);
    case "vibrant":   return buildVibrantSVG(cd);
    default:          return buildAuthoritySVG(cd);
  }
}

// ─── React Cover Renderers ────────────────────────────────────────────────────

function AuthorityRenderer({ cd, thumb }) {
  const { bg, accent, text, title, subtitle, author, tagline } = cd;
  const TS = thumb ? 8.5 : 27, SS = thumb ? 4 : 11.5, AS = thumb ? 3 : 9, TGS = thumb ? 2.5 : 7.5;
  return (
    <div style={{ background: bg, color: text, width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(255,255,255,0.02) 10px,rgba(255,255,255,0.02) 11px)", pointerEvents: "none" }} />
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: thumb ? "5% 7% 3%" : "6% 8% 3.5%" }}>
        {tagline && <div style={{ fontSize: TGS, fontFamily: "Impact,'Arial Black',sans-serif", fontWeight: 700, color: accent, letterSpacing: thumb ? 0.5 : 2.5, textTransform: "uppercase", marginBottom: thumb ? 1.5 : "2.5%" }}>{tagline}</div>}
        <div style={{ fontSize: TS, fontFamily: "Impact,'Arial Black',sans-serif", fontWeight: 900, lineHeight: 0.95, letterSpacing: -0.5, textTransform: "uppercase", color: text }}>{title}</div>
      </div>
      <div style={{ background: accent, flexShrink: 0, height: thumb ? 2.5 : 7 }} />
      <div style={{ flexShrink: 0, padding: thumb ? "2% 7% 5%" : "2.5% 8% 5.5%" }}>
        {subtitle && <div style={{ fontSize: SS, fontFamily: "Arial,sans-serif", fontWeight: 400, lineHeight: 1.4, color: text, opacity: 0.82, marginBottom: thumb ? 1.5 : "3%" }}>{subtitle}</div>}
        <div style={{ fontSize: AS, fontFamily: "Impact,'Arial Black',sans-serif", fontWeight: 600, letterSpacing: thumb ? 0.5 : 2.5, textTransform: "uppercase", color: accent }}>{author}</div>
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
        {tagline && <div style={{ fontSize: TGS, fontFamily: "Georgia,serif", fontStyle: "italic", color: accent, letterSpacing: thumb ? 0.5 : 3, textTransform: "uppercase", marginBottom: thumb ? 2 : "5%", opacity: 0.9 }}>{tagline}</div>}
        <div style={{ height: thumb ? 0.5 : 1, background: accent, opacity: 0.65, marginBottom: thumb ? 2.5 : "5%" }} />
        <div style={{ fontSize: TS, fontFamily: "Georgia,'Times New Roman',serif", fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.3, color: text }}>{title}</div>
        <div style={{ height: thumb ? 0.5 : 1, background: accent, opacity: 0.65, marginTop: thumb ? 2.5 : "5%", marginBottom: thumb ? 2 : "4%" }} />
        {subtitle && <div style={{ fontSize: SS, fontFamily: "Georgia,serif", fontStyle: "italic", lineHeight: 1.4, color: text, opacity: 0.72 }}>{subtitle}</div>}
      </div>
      <div style={{ position: "absolute", bottom: thumb ? "4%" : "5.5%", textAlign: "center", fontSize: AS, fontFamily: "Georgia,serif", fontWeight: 700, letterSpacing: thumb ? 0.5 : 2.5, textTransform: "uppercase", color: text, opacity: 0.55 }}>{author}</div>
    </div>
  );
}

function MinimalRenderer({ cd, thumb }) {
  const { bg, accent, text, title, author, tagline } = cd;
  const TS = thumb ? 8 : 26, AS = thumb ? 3 : 9, TGS = thumb ? 2 : 6;
  return (
    <div style={{ background: bg, color: text, width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-8%", right: "-12%", width: "55%", paddingTop: "55%", borderRadius: "50%", background: accent, opacity: 0.17 }} />
      <div style={{ position: "absolute", top: "1%", right: "-3%", width: "40%", paddingTop: "40%", borderRadius: "50%", background: accent, opacity: 0.14 }} />
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: thumb ? "5% 7% 3%" : "6% 9% 3%" }}>
        {tagline && <div style={{ fontSize: TGS, fontFamily: "Arial,sans-serif", color: text, opacity: 0.45, letterSpacing: thumb ? 0.5 : 3, textTransform: "uppercase", marginBottom: thumb ? 1 : "2%" }}>{tagline}</div>}
        <div style={{ fontSize: TS, fontFamily: "'Arial Black',Impact,sans-serif", fontWeight: 900, lineHeight: 0.95, letterSpacing: -1, color: text }}>{title}</div>
      </div>
      <div style={{ position: "relative", flexShrink: 0, padding: thumb ? "2% 7% 5%" : "2% 9% 5.5%" }}>
        <div style={{ height: thumb ? 0.5 : 1.5, width: thumb ? "22%" : "25%", background: accent, marginBottom: thumb ? 1.5 : "3%" }} />
        <div style={{ fontSize: AS, fontFamily: "Arial,sans-serif", color: text, opacity: 0.7, letterSpacing: thumb ? 0.3 : 1.5 }}>{author}</div>
      </div>
    </div>
  );
}

function MetaphorRenderer({ cd, thumb }) {
  const { bg, accent, text, secondary, title, subtitle, author, tagline } = cd;
  const gradBg = secondary ? `linear-gradient(180deg, ${bg} 0%, ${bg} 48%, ${secondary} 100%)` : bg;
  const TS = thumb ? 7.5 : 22, SS = thumb ? 3 : 9, AS = thumb ? 2.5 : 8, TGS = thumb ? 2 : 6;
  return (
    <div style={{ background: gradBg, color: text, width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%) rotate(45deg)", width: "66%", height: "41.25%", background: accent, opacity: 0.14 }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%) rotate(45deg)", width: "50%", height: "31.25%", background: accent, opacity: 0.2 }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%) rotate(45deg)", width: "30%", height: "18.75%", background: accent, opacity: 0.55 }} />
      <div style={{ position: "relative", height: "46%", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: thumb ? "5% 7% 2%" : "5% 8% 2%", textAlign: "center" }}>
        {tagline && <div style={{ fontSize: TGS, fontFamily: "Arial,sans-serif", color: accent, letterSpacing: thumb ? 0.3 : 2.5, textTransform: "uppercase", marginBottom: thumb ? 0.5 : "1.5%" }}>{tagline}</div>}
        <div style={{ fontSize: TS, fontFamily: "Georgia,'Times New Roman',serif", fontWeight: 700, lineHeight: 1.1, color: text, textAlign: "center" }}>{title}</div>
      </div>
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: thumb ? "2% 7% 6%" : "2% 8% 6.5%", textAlign: "center" }}>
        {subtitle && <div style={{ fontSize: SS, fontFamily: "Georgia,serif", color: text, opacity: 0.72, marginBottom: thumb ? 1.5 : "3%" }}>{subtitle}</div>}
        <div style={{ fontSize: AS, fontFamily: "Arial,sans-serif", color: text, opacity: 0.6, letterSpacing: thumb ? 0.5 : 2.5, textTransform: "uppercase" }}>{author}</div>
      </div>
    </div>
  );
}

function DynamicRenderer({ cd, thumb }) {
  const { bg, accent, text, title, subtitle, author, tagline } = cd;
  const TS = thumb ? 9 : 27, SS = thumb ? 3.5 : 10, AS = thumb ? 2.5 : 8, TGS = thumb ? 2 : 6;
  return (
    <div style={{ background: bg, color: text, width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "20%", background: accent, clipPath: "polygon(0 10%, 78% 0%, 100% 7.5%, 22% 20%)" }} />
      <div style={{ position: "absolute", top: "24%", right: "13%", width: thumb ? 0.5 : 1.5, height: "61%", background: accent, opacity: 0.28 }} />
      <div style={{ position: "relative", padding: thumb ? "22% 7% 3%" : "23% 8% 3%" }}>
        {tagline && <div style={{ fontSize: TGS, fontFamily: "'Arial Black',Impact,sans-serif", color: text, opacity: 0.45, letterSpacing: thumb ? 0.5 : 2, textTransform: "uppercase", marginBottom: thumb ? 1 : "2%" }}>{tagline}</div>}
        <div style={{ fontSize: TS, fontFamily: "Impact,'Arial Black',sans-serif", fontWeight: 900, lineHeight: 0.92, letterSpacing: -1, textTransform: "uppercase", color: text }}>{title}</div>
        {subtitle && <div style={{ fontSize: SS, fontFamily: "Arial,sans-serif", color: text, opacity: 0.68, marginTop: thumb ? 1.5 : "3%" }}>{subtitle}</div>}
      </div>
      <div style={{ position: "relative", marginTop: "auto", padding: thumb ? "0 7% 5%" : "0 8% 5%" }}>
        <div style={{ fontSize: AS, fontFamily: "Impact,'Arial Black',sans-serif", fontWeight: 700, letterSpacing: thumb ? 0.5 : 3, textTransform: "uppercase", color: accent }}>{author}</div>
      </div>
    </div>
  );
}

function BoldTypeRenderer({ cd, thumb }) {
  const { accent, text, title, author, tagline } = cd;
  const cssBg = cd.cssBg || cd.bg;
  const TS = thumb ? 10 : 30, AS = thumb ? 2.5 : 7.5, TGS = thumb ? 2 : 6;
  return (
    <div style={{ background: cssBg, color: text, width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: thumb ? 2 : 6, background: accent }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: thumb ? "5% 7% 5% 10%" : "8% 9% 8% 12%" }}>
        {tagline && <div style={{ fontSize: TGS, fontFamily: "Arial,sans-serif", color: accent, letterSpacing: thumb ? 0.3 : 2, textTransform: "uppercase", marginBottom: thumb ? 0.5 : "2%", opacity: 0.85 }}>{tagline}</div>}
        <div style={{ fontSize: TS, fontFamily: "Impact,'Arial Black',sans-serif", fontWeight: 900, lineHeight: 0.9, letterSpacing: -1, color: text, textTransform: "uppercase" }}>{title}</div>
        <div style={{ height: thumb ? 1 : 3, width: thumb ? "25%" : "30%", background: accent, marginTop: thumb ? 1.5 : "4%", marginBottom: thumb ? 1 : "3%" }} />
      </div>
      <div style={{ padding: thumb ? "0 7% 4% 10%" : "0 9% 5% 12%", borderTop: `${thumb ? 0.5 : 1}px solid ${accent}33` }}>
        <div style={{ fontSize: AS, fontFamily: "Arial,Helvetica,sans-serif", color: text, opacity: 0.65, letterSpacing: thumb ? 0.3 : 1.5, textTransform: "uppercase" }}>{author}</div>
      </div>
    </div>
  );
}

function CinematicRenderer({ cd, thumb }) {
  const { accent, text, title, subtitle, author, tagline } = cd;
  const cssBg = cd.cssBg || cd.bg;
  const TS = thumb ? 8.5 : 24, SS = thumb ? 3.5 : 9, AS = thumb ? 2.5 : 7, TGS = thumb ? 2 : 5.5;
  const barH = thumb ? "3%" : "2.5%";
  return (
    <div style={{ background: cssBg, color: text, width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: barH, background: accent, opacity: 0.7 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: barH, background: accent, opacity: 0.7 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: thumb ? "8% 7%" : "10% 9%" }}>
        {tagline && <div style={{ fontSize: TGS, fontFamily: "Georgia,serif", fontStyle: "italic", color: accent, letterSpacing: thumb ? 0.3 : 2.5, marginBottom: thumb ? 1 : "2%", opacity: 0.9 }}>{tagline}</div>}
        <div style={{ width: thumb ? "30%" : "35%", height: thumb ? 0.5 : 1.5, background: accent, marginBottom: thumb ? 1 : "3%", opacity: 0.7 }} />
        <div style={{ fontSize: TS, fontFamily: "Georgia,'Times New Roman',serif", fontWeight: 700, lineHeight: 1.08, letterSpacing: thumb ? 0 : 1, color: text }}>{title}</div>
        <div style={{ width: thumb ? "30%" : "35%", height: thumb ? 0.5 : 1.5, background: accent, marginTop: thumb ? 1 : "3%", marginBottom: thumb ? 1 : "3%", opacity: 0.7 }} />
        {subtitle && <div style={{ fontSize: SS, fontFamily: "Georgia,serif", color: text, opacity: 0.65, fontStyle: "italic", lineHeight: 1.4 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: thumb ? "0 7% 5%" : "0 9% 6%", textAlign: "center" }}>
        <div style={{ fontSize: AS, fontFamily: "Arial,Helvetica,sans-serif", color: accent, letterSpacing: thumb ? 0.5 : 4, textTransform: "uppercase", fontWeight: 600 }}>{author}</div>
      </div>
    </div>
  );
}

function VibrantRenderer({ cd, thumb }) {
  const { bg, accent, text, secondary, title, subtitle, author, tagline } = cd;
  const TS = thumb ? 9 : 26, SS = thumb ? 3.5 : 9, AS = thumb ? 2.5 : 7, TGS = thumb ? 2 : 6;
  return (
    <div style={{ background: bg, color: text, width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-10%", right: "-15%", width: "55%", height: "70%", background: secondary || accent, opacity: 0.2, transform: "rotate(15deg)" }} />
      <div style={{ position: "absolute", bottom: "-5%", left: "-10%", width: "40%", height: "40%", background: accent, opacity: 0.12, transform: "rotate(-10deg)" }} />
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: thumb ? "5% 7% 5%" : "7% 9% 5.5%" }}>
        {tagline && <div style={{ fontSize: TGS, fontFamily: "Arial,sans-serif", color: text, opacity: 0.8, letterSpacing: thumb ? 0.3 : 2.5, textTransform: "uppercase", marginBottom: thumb ? 1 : "2%" }}>{tagline}</div>}
        <div style={{ fontSize: TS, fontFamily: "'Arial Black',Impact,sans-serif", fontWeight: 900, lineHeight: 0.95, letterSpacing: -0.5, color: text }}>{title}</div>
        {subtitle && <div style={{ fontSize: SS, fontFamily: "Arial,sans-serif", color: text, opacity: 0.85, lineHeight: 1.4, marginTop: thumb ? 1 : "3%" }}>{subtitle}</div>}
      </div>
      <div style={{ position: "relative", padding: thumb ? "0 7% 5%" : "0 9% 5.5%" }}>
        <div style={{ height: thumb ? 0.5 : 1.5, background: text, opacity: 0.18, marginBottom: thumb ? 1 : "2.5%" }} />
        <div style={{ fontSize: AS, fontFamily: "'Arial Black',Arial,sans-serif", fontWeight: 700, color: text, opacity: 0.9, letterSpacing: thumb ? 0.5 : 2.5, textTransform: "uppercase" }}>{author}</div>
      </div>
    </div>
  );
}

function ConceptRenderer({ cd, thumb }) {
  switch (cd.type) {
    case "authority": return <AuthorityRenderer cd={cd} thumb={thumb} />;
    case "premium":   return <PremiumRenderer   cd={cd} thumb={thumb} />;
    case "minimal":   return <MinimalRenderer   cd={cd} thumb={thumb} />;
    case "metaphor":  return <MetaphorRenderer  cd={cd} thumb={thumb} />;
    case "dynamic":   return <DynamicRenderer   cd={cd} thumb={thumb} />;
    case "boldType":  return <BoldTypeRenderer  cd={cd} thumb={thumb} />;
    case "cinematic": return <CinematicRenderer cd={cd} thumb={thumb} />;
    case "vibrant":   return <VibrantRenderer   cd={cd} thumb={thumb} />;
    default:          return <AuthorityRenderer cd={cd} thumb={thumb} />;
  }
}

// ─── Back Cover & Spine ───────────────────────────────────────────────────────

function BackCoverPreview({ cd, cover }) {
  const { bg, accent, text } = cd;
  return (
    <div style={{ background: bg, color: text, width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "Georgia,serif", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2.5%", background: accent }} />
      <div style={{ flex: 1, padding: "11% 9% 4%", display: "flex", flexDirection: "column", gap: "3.5%", overflow: "hidden" }}>
        {cover.backCoverHook && <div style={{ fontSize: "6.5%", fontWeight: 700, lineHeight: 1.3, color: text }}>{cover.backCoverHook}</div>}
        {cover.backDescription && <div style={{ fontSize: "5.2%", lineHeight: 1.55, color: text, opacity: 0.82, flex: 1, overflow: "hidden" }}>{cover.backDescription.slice(0, 300)}{cover.backDescription.length > 300 ? "…" : ""}</div>}
        {cover.backReviewQuotes && <div style={{ fontSize: "4.8%", fontStyle: "italic", color: accent, lineHeight: 1.4 }}>{cover.backReviewQuotes}</div>}
        {cover.backAuthorBio && <div style={{ fontSize: "4.2%", color: text, opacity: 0.65, lineHeight: 1.5, marginTop: "auto" }}>{cover.backAuthorBio}</div>}
        {cover.backCoverCTA && <div style={{ fontSize: "5%", fontWeight: 700, color: accent }}>{cover.backCoverCTA}</div>}
        {!cover.backCoverHook && !cover.backDescription && !cover.backReviewQuotes && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", fontSize: "5%", color: text, opacity: 0.15, lineHeight: 1.6 }}>Back cover text<br />appears here</div>
          </div>
        )}
      </div>
      <div style={{ position: "absolute", bottom: "4%", right: "5%", width: "22%", height: "12%", border: `1px solid ${text}`, opacity: 0.2, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: "100%", height: "100%", backgroundImage: `repeating-linear-gradient(90deg, ${text} 0px, ${text} 1px, transparent 1px, transparent 3px)`, opacity: 0.35 }} />
      </div>
    </div>
  );
}

function SpinePreview({ cd, spineInches, trimHeight, previewH }) {
  const { bg, accent, text, title, author } = cd;
  const spineW = Math.round((spineInches / trimHeight) * previewH);
  const tooNarrow = spineInches < 0.25;
  const minW = Math.max(spineW, 4);
  return (
    <div style={{ width: minW, height: previewH, background: bg, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, position: "relative" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: Math.min(2, minW * 0.12), background: accent, opacity: 0.6 }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: Math.min(2, minW * 0.12), background: accent, opacity: 0.6 }} />
      {!tooNarrow && (
        <div style={{ transform: "rotate(-90deg)", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.4em" }}>
          <span style={{ fontSize: Math.max(6, minW * 0.35), fontFamily: "Arial,sans-serif", fontWeight: 700, color: text, maxWidth: previewH * 0.6, overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{title}</span>
          <span style={{ fontSize: Math.max(5, minW * 0.25), color: text, opacity: 0.5 }}>·</span>
          <span style={{ fontSize: Math.max(5, minW * 0.25), fontFamily: "Arial,sans-serif", color: text, opacity: 0.7 }}>{author}</span>
        </div>
      )}
    </div>
  );
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreConceptForGallery(concept, wizardGenre) {
  const type = concept?.type || "authority";
  const def = CONCEPT_DEFAULTS[type] || CONCEPT_DEFAULTS.authority;
  const cr = contrastRatio(concept?.text || def.text, concept?.bg || def.bg);
  const thumbVis = cr >= 7 ? 95 : cr >= 4.5 ? 85 : cr >= 3 ? 72 : 58;
  const genreScores = GENRE_CONCEPT_SCORES[wizardGenre] || {};
  const genreMatch = genreScores[type] || 75;
  const professionalism = PROF_SCORES[type] || 80;
  const marketAppeal = Math.round(genreMatch * 0.65 + thumbVis * 0.35);
  const readerAttraction = Math.round(genreMatch * 0.5 + professionalism * 0.5);
  const overall = Math.round(marketAppeal * 0.3 + genreMatch * 0.25 + professionalism * 0.2 + thumbVis * 0.15 + readerAttraction * 0.1);
  return { marketAppeal, genreMatch, professionalism, thumbnailVisibility: thumbVis, readerAttraction, overall };
}

// ─── UI Sub-components ────────────────────────────────────────────────────────

function ScoreBar({ label, value }) {
  const color = value >= 88 ? "bg-emerald-500" : value >= 78 ? "bg-blue-500" : value >= 68 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-bold text-slate-900">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ScoreMiniBar({ label, value }) {
  const color = value >= 88 ? "bg-emerald-400" : value >= 75 ? "bg-blue-400" : "bg-slate-300";
  return (
    <div className="flex items-center gap-1 mt-0.5">
      <div className="w-12 shrink-0 text-[9px] text-slate-400">{label}</div>
      <div className="flex-1 h-1 rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function PhaseNav({ phase, setPhase, hasConcepts }) {
  return (
    <div className="mb-8 flex items-center justify-center">
      {PHASES.map((p, i) => (
        <div key={p.id} className="flex items-center">
          <button type="button"
            onClick={() => (p.id === "concepts" || p.id === "review" ? hasConcepts : true) && setPhase(i)}
            className={`flex flex-col items-center gap-1 ${(p.id === "concepts" || p.id === "review") && !hasConcepts ? "cursor-default opacity-35" : "cursor-pointer"}`}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${phase === i ? "bg-indigo-600 text-white shadow-md" : phase > i ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
              {phase > i ? "✓" : i + 1}
            </div>
            <span className={`text-[10px] font-semibold whitespace-nowrap ${phase === i ? "text-indigo-600" : "text-slate-400"}`}>{p.label}</span>
          </button>
          {i < PHASES.length - 1 && (
            <div className={`mx-2 mb-4 h-px w-10 transition-all ${phase > i ? "bg-indigo-300" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Phase 0: Book Info ───────────────────────────────────────────────────────

function PhaseInfo({ cover, fullProject, patch, onRunStrategy, strategyLoading, setPhase, title }) {
  const autoAudience = resolveAudience(fullProject);
  const autoTone = resolveTone(fullProject);
  const autoGenre = resolveGenre(fullProject);
  const activeGenre = cover.wizardGenre || autoGenre || "";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-0.5">Book Information</h2>
        <p className="text-xs text-slate-500 mb-5">Auto-filled from your project. Edit as needed before generating.</p>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-800">Title</label>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Auto-filled</span>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 border border-slate-200">{title || "—"}</div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-800">Subtitle</label>
              {!cover.subtitle && <span className="text-[10px] text-slate-400">Optional</span>}
            </div>
            <input className="input-light text-sm" value={cover.subtitle || ""} onChange={e => patch({ subtitle: e.target.value })} placeholder="A practical guide to…" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-800">Author Name</label>
              {cover.authorLine && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Auto-filled</span>}
            </div>
            <input className="input-light text-sm" value={cover.authorLine || ""} onChange={e => patch({ authorLine: e.target.value })} placeholder="Your Name" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-800 mb-2 block">Genre</label>
            <div className="flex flex-wrap gap-1.5">
              {WIZARD_GENRES.map(g => (
                <button key={g} type="button" onClick={() => patch({ wizardGenre: g })}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${activeGenre === g ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {g}
                </button>
              ))}
            </div>
            {!cover.wizardGenre && autoGenre && (
              <p className="mt-1.5 text-[10px] text-slate-400">Detected from your research: <strong className="text-slate-600">{autoGenre}</strong></p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                Audience <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Auto</span>
              </label>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 border border-slate-200">{autoAudience || "—"}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                Tone <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Auto</span>
              </label>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 border border-slate-200">{autoTone || "—"}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-2.5">
        <button type="button" onClick={onRunStrategy} disabled={strategyLoading}
          className="w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
          {strategyLoading ? (
            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Analyzing…</>
          ) : "✦ Run AI Cover Strategy Analysis →"}
        </button>
        <button type="button" onClick={() => setPhase(2)}
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
          Skip to Design Wizard →
        </button>
      </div>
    </div>
  );
}

// ─── Phase 1: Strategy ────────────────────────────────────────────────────────

function PhaseStrategy({ cover, strategyLoading, setPhase }) {
  const strategy = cover.coverStrategy;
  if (strategyLoading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-700">Analyzing your book for cover strategy…</p>
        <p className="text-xs text-slate-400 mt-1">Reviewing genre, audience, market positioning & design conventions</p>
      </div>
    </div>
  );
  if (!strategy) return (
    <div className="mx-auto max-w-lg text-center py-16 space-y-4">
      <p className="text-slate-500">No strategy analysis yet. Go back to run the analysis.</p>
      <button type="button" onClick={() => setPhase(0)} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">← Back to Book Info</button>
    </div>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
        <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">AI Cover Strategy</div>
        <h2 className="text-base font-bold text-slate-900 mb-4 leading-snug">{strategy.styleRecommendation}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Typography", value: strategy.typographyStyle },
            { label: "Layout", value: strategy.layoutRecommendation },
            { label: "Imagery", value: strategy.imageryDirection },
            { label: "Emotional Tone", value: strategy.emotionalTone },
          ].map(({ label, value }) => value ? (
            <div key={label}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{label}</div>
              <p className="text-xs text-slate-700 leading-relaxed">{value}</p>
            </div>
          ) : null)}
        </div>
        {strategy.recommendedColors && (
          <div className="mt-4 pt-4 border-t border-indigo-100">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Recommended Palette</div>
            <div className="flex items-center gap-3 flex-wrap">
              {["primary","secondary","accent"].map(k => {
                const hex = strategy.recommendedColors[k];
                if (!hex) return null;
                return (
                  <div key={k} className="flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-full border border-slate-200 shadow-sm" style={{ background: hex }} />
                    <span className="text-[11px] font-mono text-slate-600">{hex}</span>
                  </div>
                );
              })}
            </div>
            {strategy.recommendedColors.rationale && <p className="mt-1.5 text-xs text-slate-500">{strategy.recommendedColors.rationale}</p>}
          </div>
        )}
      </div>
      {Array.isArray(strategy.marketInsights) && strategy.marketInsights.length > 0 && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-3">What Works In This Market</div>
          <div className="space-y-2">
            {strategy.marketInsights.map((ins, i) => (
              <div key={i} className="flex gap-2 text-sm text-emerald-800">
                <span className="shrink-0 text-emerald-500 font-bold">✓</span>
                <span>{ins}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        {Array.isArray(strategy.topConceptTypes) && strategy.topConceptTypes.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">AI Recommends</div>
            <div className="flex gap-2 flex-wrap">
              {strategy.topConceptTypes.map(t => {
                const ct = CONCEPT_TYPES.find(c => c.id === t);
                return ct ? <span key={t} className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">⭐ {ct.label}</span> : null;
              })}
            </div>
          </div>
        )}
        {Array.isArray(strategy.avoidPatterns) && strategy.avoidPatterns.length > 0 && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-2">Patterns to Avoid</div>
            <div className="space-y-1">
              {strategy.avoidPatterns.map((p, i) => (
                <div key={i} className="flex gap-2 text-xs text-red-700">
                  <span className="shrink-0">✗</span><span>{p}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <button type="button" onClick={() => setPhase(2)}
        className="w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700">
        Design Your Cover →
      </button>
    </div>
  );
}

// ─── Phase 2: Design Wizard ───────────────────────────────────────────────────

function PhaseDesign({ cover, patch, generating, onGenerate, setPhase }) {
  const sections = [
    { key: "wizardStyle",    label: "Cover Style",       options: WIZARD_STYLES,  color: "indigo"  },
    { key: "wizardMood",     label: "Mood",              options: WIZARD_MOODS,   color: "purple"  },
    { key: "wizardColorDir", label: "Color Direction",   options: WIZARD_COLORS,  color: "amber"   },
    { key: "wizardImagery",  label: "Imagery Direction", options: WIZARD_IMAGERY, color: "teal"    },
  ];
  const selectedColors = {
    indigo: "bg-indigo-600 text-white",
    purple: "bg-purple-600 text-white",
    amber:  "bg-amber-500 text-white",
    teal:   "bg-teal-600 text-white",
  };
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {sections.map(({ key, label, options, color }) => (
        <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-3">{label}</h3>
          <div className="flex flex-wrap gap-1.5">
            {options.map(opt => (
              <button key={opt} type="button" onClick={() => patch({ [key]: opt })}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${cover[key] === opt ? selectedColors[color] : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="pt-2 space-y-2.5">
        <button type="button" onClick={onGenerate} disabled={generating}
          className="w-full rounded-2xl bg-indigo-600 py-4 text-base font-bold text-white shadow-lg transition hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
          {generating ? (
            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Generating 8 cover concepts…</>
          ) : "✦ Generate 8 Cover Concepts →"}
        </button>
        <button type="button" onClick={() => setPhase(1)}
          className="w-full text-xs text-slate-400 hover:text-slate-600 transition py-1">← Back to Strategy</button>
      </div>
    </div>
  );
}

// ─── Phase 3: Concepts Gallery ────────────────────────────────────────────────

function PhaseGallery({ cover, rawConcepts, title, selectedIdx, onSelect, generating, onRegenerate, setPhase }) {
  const wizardGenre = cover.wizardGenre || "";
  const scores = rawConcepts.map(c => scoreConceptForGallery(c, wizardGenre));
  const bestIdx = scores.reduce((best, s, i) => s.overall > scores[best].overall ? i : best, 0);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">8 AI-Generated Cover Concepts</h2>
          <p className="text-xs text-slate-500 mt-0.5">Click any concept to select it and proceed to the review editor.</p>
        </div>
        <button type="button" onClick={onRegenerate} disabled={generating}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 flex items-center gap-1.5">
          {generating ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />Generating…</> : "↻ Regenerate"}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {rawConcepts.slice(0, 8).map((concept, idx) => {
          const cd = buildCoverData(concept, cover, title);
          const score = scores[idx];
          const ct = CONCEPT_TYPES[idx] || CONCEPT_TYPES[0];
          const isSel = idx === selectedIdx;
          const isBest = idx === bestIdx;
          return (
            <div key={idx} className="space-y-2">
              <div className="relative">
                {isBest && (
                  <div className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold text-white shadow">
                    ⭐ Best Match
                  </div>
                )}
                <button type="button" onClick={() => onSelect(idx)}
                  style={{ aspectRatio: "5/8", display: "block", width: "100%", position: "relative", overflow: "hidden", borderRadius: 10 }}
                  className={`transition-all ${isSel ? "ring-2 ring-indigo-500 ring-offset-2 shadow-xl scale-[1.02]" : "ring-1 ring-slate-200 hover:ring-indigo-300 hover:shadow-lg"}`}>
                  <div style={{ position: "absolute", inset: 0 }}>
                    <ConceptRenderer cd={cd} thumb />
                  </div>
                </button>
              </div>
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="text-[10px] font-bold text-slate-700 truncate pr-1">{ct.label}</div>
                  <div className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black ${score.overall >= 88 ? "bg-emerald-100 text-emerald-700" : score.overall >= 78 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                    {score.overall}
                  </div>
                </div>
                <ScoreMiniBar label="Genre" value={score.genreMatch} />
                <ScoreMiniBar label="Clarity" value={score.thumbnailVisibility} />
              </div>
            </div>
          );
        })}
      </div>
      {wizardGenre && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-500">
          Scores calibrated for <strong className="text-slate-700">{wizardGenre}</strong>. Change genre in Book Info (Step 1) to recalculate.
        </div>
      )}
    </div>
  );
}

// ─── Phase 4: Review ─────────────────────────────────────────────────────────

function PhaseReview({ cover, selectedCD, selectedConcept, selectedIdx, rawConcepts, title, patch, patchConcept, criticLoading, onGetCritique, improving, onImprove, setPhase, trimSize, spineInches, frontW, PREV_H, WRAP_H, wrapFW, slug, onSelectConcept, reviewTab, setReviewTab, copyKDPSpec }) {
  const critic = cover.coverCriticResult;
  const wizardGenre = cover.wizardGenre || "";
  const score = scoreConceptForGallery(selectedConcept, wizardGenre);
  const ct = CONCEPT_TYPES.find(t => t.id === selectedConcept?.type) || CONCEPT_TYPES[0];
  const RTABS = [
    { id: "scores", label: "Scores"    },
    { id: "edit",   label: "Edit"      },
    { id: "critic", label: "AI Critic" },
    { id: "kdp",    label: "KDP Setup" },
    { id: "back",   label: "Back Cover"},
    { id: "export", label: "Export"    },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800">Selected: {ct.label}</h3>
            <button type="button" onClick={() => setPhase(3)} className="text-xs font-semibold text-indigo-600 hover:underline">← All concepts</button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {rawConcepts.slice(0, 8).map((c, i) => {
              const cd = buildCoverData(c, cover, title);
              const cType = CONCEPT_TYPES[i];
              return (
                <button key={i} type="button" onClick={() => onSelectConcept(i)} title={cType?.label}
                  style={{ width: 48, height: 77, flexShrink: 0, borderRadius: 5, overflow: "hidden", position: "relative" }}
                  className={`transition ${i === selectedIdx ? "ring-2 ring-indigo-500 ring-offset-1" : "opacity-55 hover:opacity-90 ring-1 ring-slate-200"}`}>
                  <div style={{ position: "absolute", inset: 0 }}><ConceptRenderer cd={cd} thumb /></div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {RTABS.map(t => (
            <button key={t.id} type="button" onClick={() => setReviewTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${reviewTab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {reviewTab === "scores" && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black ${score.overall >= 88 ? "bg-emerald-100 text-emerald-700" : score.overall >= 78 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                  {score.overall}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Overall Score</div>
                  <div className="text-xs text-slate-500 mt-0.5">{wizardGenre ? `Calibrated for ${wizardGenre} genre` : "Select a genre to calibrate scores"}</div>
                </div>
              </div>
              <div className="space-y-2.5">
                <ScoreBar label="Market Appeal"       value={score.marketAppeal}       />
                <ScoreBar label="Genre Match"         value={score.genreMatch}         />
                <ScoreBar label="Professionalism"     value={score.professionalism}    />
                <ScoreBar label="Thumbnail Clarity"   value={score.thumbnailVisibility}/>
                <ScoreBar label="Reader Attraction"   value={score.readerAttraction}   />
              </div>
              {selectedConcept?.designNotes && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                  <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-1">AI Design Rationale</div>
                  <p className="text-xs text-indigo-700 leading-relaxed">{selectedConcept.designNotes}</p>
                </div>
              )}
              <button type="button" onClick={onImprove} disabled={improving}
                className="w-full rounded-xl border-2 border-indigo-200 bg-indigo-50 py-2.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60 flex items-center justify-center gap-2">
                {improving ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />Generating variants…</> : "✦ Improve This Cover"}
              </button>
            </div>
          )}
          {reviewTab === "edit" && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-800">Color Editor</h4>
              <div className="grid grid-cols-3 gap-3">
                {[{ key:"bg",label:"Background" },{ key:"accent",label:"Accent" },{ key:"text",label:"Text" }].map(({ key, label }) => (
                  <div key={key}>
                    <div className="text-[11px] font-semibold text-slate-700 mb-1">{label}</div>
                    <div className="flex items-center gap-1.5">
                      <input type="color" className="h-8 w-10 cursor-pointer rounded border border-slate-200 p-0.5"
                        value={selectedCD[key] || "#000000"}
                        onChange={e => patchConcept(selectedIdx, { [key]: e.target.value })}
                      />
                      <input className="input-light flex-1 text-[11px] font-mono py-1.5"
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
                    <input type="color" className="h-8 w-10 cursor-pointer rounded border border-slate-200 p-0.5"
                      value={selectedCD.secondary || "#f5f0e8"}
                      onChange={e => patchConcept(selectedIdx, { secondary: e.target.value })}
                    />
                    <input className="input-light flex-1 text-[11px] font-mono py-1.5"
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
                    Contrast {ratio.toFixed(1)}:1 — {ok ? "WCAG AA ✓ — excellent for print" : warn ? "Marginal — may look faded in print" : "Poor — text will be hard to read"}
                  </div>
                );
              })()}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <h4 className="text-sm font-bold text-slate-800">Cover Text</h4>
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Subtitle</label>
                  <input className="input-light text-sm" value={cover.subtitle || ""} onChange={e => patch({ subtitle: e.target.value })} placeholder="A practical guide to…" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Tagline</label>
                  <input className="input-light text-sm" value={cover.tagline || ""}
                    onChange={e => {
                      const val = e.target.value;
                      const updated = rawConcepts.map(c => ({ ...c, tagline: (c.tagline === cover.tagline || !c.tagline) ? val : c.tagline }));
                      patch({ tagline: val, concepts: updated });
                    }}
                    placeholder="4–8 word punchy hook line"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Author Line</label>
                  <input className="input-light text-sm" value={cover.authorLine || ""} onChange={e => patch({ authorLine: e.target.value })} />
                </div>
              </div>
            </div>
          )}
          {reviewTab === "critic" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-slate-800">AI Cover Critic</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Expert review of hierarchy, readability, and bestseller potential</p>
                </div>
                <button type="button" onClick={onGetCritique} disabled={criticLoading}
                  className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60">
                  {criticLoading ? "Analyzing…" : critic ? "Refresh" : "Get Critique"}
                </button>
              </div>
              {critic ? (
                <div className="space-y-3">
                  {critic.scores && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-700">Overall</span>
                        <span className={`text-2xl font-black ${critic.overall >= 8 ? "text-emerald-600" : critic.overall >= 6 ? "text-blue-600" : "text-amber-600"}`}>{critic.overall}/10</span>
                      </div>
                      {Object.entries(critic.scores).map(([dim, val]) => (
                        <div key={dim} className="space-y-0.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="capitalize font-medium text-slate-600">{dim.replace(/([A-Z])/g," $1").trim()}</span>
                            <span className="font-bold text-slate-800">{val}/10</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${val >= 8 ? "bg-emerald-400" : val >= 6 ? "bg-blue-400" : "bg-amber-400"}`} style={{ width: `${val*10}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {critic.topIssue && (
                    <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs">
                      <div className="font-bold text-amber-800 mb-1">Top Issue</div>
                      <div className="text-amber-700">{critic.topIssue}</div>
                    </div>
                  )}
                  {critic.topRecommendation && (
                    <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 text-xs">
                      <div className="font-bold text-indigo-800 mb-1">Best Improvement</div>
                      <div className="text-indigo-700">{critic.topRecommendation}</div>
                    </div>
                  )}
                  {critic.feedback && Object.entries(critic.feedback).map(([dim, fb]) => (
                    <div key={dim} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 capitalize">{dim.replace(/([A-Z])/g," $1").trim()}</div>
                      <div className="text-xs text-slate-700">{String(fb)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 border border-slate-200 py-10 text-center">
                  <p className="text-sm text-slate-400">Click "Get Critique" for an expert AI review of your cover.</p>
                </div>
              )}
            </div>
          )}
          {reviewTab === "kdp" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
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
                  {["white","cream"].map(p => (
                    <button key={p} type="button" onClick={() => patch({ paperType: p })}
                      className={`flex-1 rounded-lg border py-2 text-xs font-semibold capitalize transition ${(cover.paperType||"white")===p ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 space-y-1.5">
                <div className="text-xs font-bold text-sky-800">Calculated Dimensions</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-sky-900">
                  <div>Spine width: <strong>{spineInches.toFixed(3)}"</strong></div>
                  <div>Spine text: <strong>{spineInches >= 0.25 ? "Yes ✓" : "Too narrow"}</strong></div>
                  <div>Full wrap W: <strong>{(trimSize.w * 2 + spineInches + 0.25).toFixed(3)}"</strong></div>
                  <div>Full wrap H: <strong>{(trimSize.h + 0.25).toFixed(3)}"</strong></div>
                </div>
                {spineInches < 0.25 && <div className="text-xs font-semibold text-amber-700">⚠ Spine too narrow for text — increase page count above ~100.</div>}
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">KDP Print Requirements</div>
                <div>· Bleed: 0.125" on all sides</div>
                <div>· Resolution: 300 DPI minimum</div>
                <div>· Color: RGB for digital, CMYK for print PDF</div>
                <div>· Barcode safe zone: bottom-right of back cover, ≥ 2" × 1.2"</div>
              </div>
              <button type="button" onClick={copyKDPSpec}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                📋 Copy KDP Spec to Clipboard
              </button>
            </div>
          )}
          {reviewTab === "back" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">All fields optional — the full wrap preview updates live as you type.</p>
              {[
                { key:"backCoverHook",    label:"Back Cover Hook",     rows:2, ph:"What if everything you believed about X was wrong?" },
                { key:"backDescription",  label:"Description",         rows:4, ph:"In this book, you'll discover…" },
                { key:"backReviewQuotes", label:"Review Quotes",       rows:2, ph:`"A must-read." — Name, Title` },
                { key:"backAuthorBio",    label:"Author Bio",          rows:2, ph:"2–3 sentence bio for the back cover…" },
                { key:"backCoverCTA",     label:"Call to Action",      rows:1, ph:"Start reading today and transform your…" },
              ].map(({ key, label, rows, ph }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">{label}</label>
                  <textarea className="input-light resize-y text-sm" rows={rows} value={cover[key]||""} onChange={e => patch({ [key]: e.target.value })} placeholder={ph} />
                </div>
              ))}
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ⬛ Reserve the bottom-right corner of the back cover for the barcode (≥ 2" × 1.2").
              </div>
            </div>
          )}
          {reviewTab === "export" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Selected — {ct.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => downloadSVG(buildConceptSVG(selectedCD), `${slug}-${selectedCD.type}.svg`)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">↓ SVG (vector)</button>
                  <button type="button" onClick={() => downloadPNG(buildConceptSVG(selectedCD), `${slug}-${selectedCD.type}.png`)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">↓ PNG 1600×2560</button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ebook (no subtitle)</div>
                <button type="button" onClick={() => downloadSVG(buildConceptSVG({ ...selectedCD, subtitle:"" }), `${slug}-ebook.svg`)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">↓ Ebook SVG</button>
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">All 8 Concepts</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {rawConcepts.slice(0, 8).map((concept, idx) => {
                    const cd = buildCoverData(concept, cover, title);
                    const cType = CONCEPT_TYPES[idx];
                    return (
                      <button key={idx} type="button" title={`Download ${cType?.label}`}
                        onClick={() => downloadSVG(buildConceptSVG(cd), `${slug}-${cd.type}.svg`)}
                        className="rounded-lg border border-slate-200 bg-white py-1.5 px-1 text-[9px] font-semibold text-slate-600 hover:bg-slate-50 truncate transition">
                        {(cType?.label||"").split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                <div><strong>SVG:</strong> 1600×2560 — open in Affinity Designer, Illustrator, or Inkscape for print PDF.</div>
                <div><strong>PNG:</strong> 1600×2560px rasterized — ready for digital upload.</div>
                <div><strong>KDP:</strong> Final submission requires PDF + 0.125" bleed. SVG → professional app → PDF.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <div>
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">{ct.label}</p>
          <div className="mx-auto overflow-hidden rounded-lg shadow-xl" style={{ width: frontW, height: PREV_H }}>
            <ConceptRenderer cd={selectedCD} />
          </div>
          <div className="mt-2 flex justify-center gap-2">
            <button type="button" onClick={() => downloadSVG(buildConceptSVG(selectedCD), `${slug}-${selectedCD.type}.svg`)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition">↓ SVG</button>
            <button type="button" onClick={() => downloadPNG(buildConceptSVG(selectedCD), `${slug}-${selectedCD.type}.png`)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition">↓ PNG</button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Amazon Thumbnail Test</p>
          <div className="flex items-end justify-center gap-3">
            {[{w:60,h:96,label:"Mobile"},{w:80,h:128,label:"Search"},{w:110,h:176,label:"Detail"}].map(({ w, h, label }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <div style={{ width: w, height: h, borderRadius: 3, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
                  <ConceptRenderer cd={selectedCD} thumb />
                </div>
                <span className="text-[9px] text-slate-400">{label}</span>
              </div>
            ))}
          </div>
          {(() => {
            const ratio = contrastRatio(selectedCD.text, selectedCD.bg);
            const ok = ratio >= 4.5, warn = ratio >= 3;
            return (
              <div className={`mt-2 rounded-lg px-3 py-1.5 text-center text-[11px] font-medium ${ok ? "bg-emerald-50 text-emerald-700" : warn ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                {ratio.toFixed(1)}:1 contrast — {ok ? "✓ Clear at all sizes" : warn ? "⚠ Marginal at small sizes" : "✗ Low — will look washed out"}
              </div>
            );
          })()}
        </div>

        <div>
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Full Wrap</p>
          <div className="flex justify-center overflow-x-auto">
            <div style={{ display: "flex", height: WRAP_H, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", flexShrink: 0 }}>
              <div style={{ width: wrapFW, flexShrink: 0 }}><BackCoverPreview cd={selectedCD} cover={cover} /></div>
              <SpinePreview cd={selectedCD} spineInches={spineInches} trimHeight={trimSize.h} previewH={WRAP_H} />
              <div style={{ width: wrapFW, flexShrink: 0 }}><ConceptRenderer cd={selectedCD} /></div>
            </div>
          </div>
          <p className="mt-1 text-center text-[9px] text-slate-400">{trimSize.label} · Spine {spineInches.toFixed(3)}" · {Number(cover.pageCount)||200} pages</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookCoverStep({ bookCover, setBookCover, fullProject }) {
  const visitRef = useRef(false);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [criticLoading, setCriticLoading]     = useState(false);
  const [generating, setGenerating]           = useState(false);
  const [improving, setImproving]             = useState(false);
  const [status, setStatus]                   = useState("");
  const [reviewTab, setReviewTab]             = useState("scores");

  const cover = bookCover && typeof bookCover === "object" ? bookCover : {};
  const title = resolveBookTitle(fullProject);
  const trimSize = KDP_TRIM_SIZES[cover.trimSizeIndex ?? 4];
  const spineInches = calcSpineInches(Number(cover.pageCount) || 200, cover.paperType || "white");

  const [phase, setPhase] = useState(() => {
    const bc = bookCover;
    if (Array.isArray(bc?.concepts) && bc.concepts.length >= 8) return 3;
    if (bc?.coverStrategy) return 2;
    return 0;
  });

  const rawConcepts = Array.isArray(cover.concepts) && cover.concepts.length >= 8
    ? cover.concepts
    : CONCEPT_TYPES.map(ct => ({ ...CONCEPT_DEFAULTS[ct.id], type: ct.id, label: ct.label, tagline: cover.tagline || "" }));

  const selectedIdx     = cover.selectedConceptIndex ?? 0;
  const selectedConcept = rawConcepts[selectedIdx] || rawConcepts[0];
  const selectedCD      = buildCoverData(selectedConcept, cover, title);

  useEffect(() => {
    if (visitRef.current) return;
    visitRef.current = true;
    const author = resolveAuthorName(fullProject);
    const genre  = resolveGenre(fullProject);
    const bd     = fullProject?.bookDetails || {};
    setBookCover(prev => {
      const p = prev && typeof prev === "object" ? prev : {};
      return {
        subtitle:             p.subtitle             ?? bd.subtitle ?? "",
        tagline:              p.tagline              ?? "",
        authorLine:           p.authorLine           || author,
        wizardGenre:          p.wizardGenre          || genre || "",
        wizardStyle:          p.wizardStyle          ?? "",
        wizardMood:           p.wizardMood           ?? "",
        wizardColorDir:       p.wizardColorDir       || "Auto",
        wizardImagery:        p.wizardImagery        || "AI decides",
        coverStrategy:        p.coverStrategy        ?? null,
        coverCriticResult:    p.coverCriticResult    ?? null,
        primaryColor:         p.primaryColor         || CONCEPT_DEFAULTS.authority.bg,
        accentColor:          p.accentColor          || CONCEPT_DEFAULTS.authority.accent,
        textColor:            p.textColor            || CONCEPT_DEFAULTS.authority.text,
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
    const def = CONCEPT_DEFAULTS[c.type] || CONCEPT_DEFAULTS.authority;
    patch({ selectedConceptIndex: idx, primaryColor: c.bg || def.bg, accentColor: c.accent || def.accent, textColor: c.text || def.text });
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

  async function generateStrategy() {
    setStrategyLoading(true); setPhase(1);
    try {
      const bd     = fullProject?.bookDetails || {};
      const outline = fullProject?.bookOutline;
      const themes = Array.isArray(outline?.chapters) ? outline.chapters.slice(0,6).map(c => c.title||"").filter(Boolean) : [];
      const data = await aiFetch("/api/ai/cover-strategy", {
        title,
        subtitle:     cover.subtitle || bd.subtitle || "",
        genre:        cover.wizardGenre || resolveGenre(fullProject) || "Nonfiction",
        audience:     resolveAudience(fullProject),
        tone:         resolveTone(fullProject),
        description:  fullProject?.description || bd.corePromise || "",
        themes,
        positioning:  resolveUsp(fullProject),
        authorPersona: fullProject?.authorPersona?.draft?.authorDescription || "",
      });
      patch({ coverStrategy: data });
    } catch (e) {
      setStatus("Strategy analysis failed — " + (e.message || "try again"));
      setPhase(0);
    } finally { setStrategyLoading(false); }
  }

  async function generateConcepts() {
    setGenerating(true); setStatus("");
    try {
      const bd = fullProject?.bookDetails || {};
      const data = await aiFetch("/api/ai/cover-concepts", {
        title,
        subtitle:       cover.subtitle || bd.subtitle || "",
        genre:          cover.wizardGenre || resolveGenre(fullProject),
        audience:       resolveAudience(fullProject),
        tone:           resolveTone(fullProject),
        corePromise:    bd.corePromise || "",
        coreThesis:     bd.coreThesis  || "",
        authorName:     resolveAuthorName(fullProject),
        positioning:    resolveUsp(fullProject),
        wizardStyle:    cover.wizardStyle || "",
        wizardMood:     cover.wizardMood || "",
        wizardColorDir: cover.wizardColorDir || "Auto",
        wizardImagery:  cover.wizardImagery || "AI decides",
      });
      if (Array.isArray(data.concepts) && data.concepts.length > 0) {
        const merged = CONCEPT_TYPES.map((ct, i) => {
          const match = data.concepts.find(c => c.type === ct.id) || data.concepts[i] || {};
          const def = CONCEPT_DEFAULTS[ct.id];
          return { ...def, type: ct.id, label: ct.label, ...match };
        });
        const first = merged[0];
        patch({ concepts: merged, selectedConceptIndex: 0, primaryColor: first.bg, accentColor: first.accent, textColor: first.text, generatedAt: new Date().toISOString() });
        setPhase(3);
      } else {
        setStatus("Generation returned no data — try again.");
      }
    } catch (e) {
      setStatus(e.message || "Generation failed.");
    } finally { setGenerating(false); }
  }

  async function getCritique() {
    setCriticLoading(true);
    try {
      const data = await aiFetch("/api/ai/cover-critic", {
        title,
        layoutStyle:      selectedConcept?.type || "authority",
        styleMode:        selectedConcept?.type || "authority",
        genrePreset:      cover.wizardGenre || "",
        primaryColor:     selectedCD.bg,
        accentColor:      selectedCD.accent,
        textColor:        selectedCD.text,
        fontPairingLabel: selectedConcept?.type || "",
        subtitle:         cover.subtitle || "",
        tagline:          selectedCD.tagline || "",
      });
      patch({ coverCriticResult: data });
    } catch (e) {
      setStatus("Critique failed — " + (e.message || "try again"));
    } finally { setCriticLoading(false); }
  }

  async function improveCover() {
    setImproving(true);
    try {
      const bd = fullProject?.bookDetails || {};
      const data = await aiFetch("/api/ai/cover-variants", {
        title,
        subtitle:  cover.subtitle || bd.subtitle || "",
        audience:  resolveAudience(fullProject),
        genre:     cover.wizardGenre || resolveGenre(fullProject),
        tone:      resolveTone(fullProject),
        usp:       resolveUsp(fullProject),
      });
      if (Array.isArray(data.variants) && data.variants.length > 0) {
        const improved = data.variants.map((v, i) => {
          const type = v.layoutStyle || "authority";
          const def = CONCEPT_DEFAULTS[type] || CONCEPT_DEFAULTS.authority;
          return { ...def, type, label: `Variant ${String.fromCharCode(65 + i)}`, bg: v.primaryColor || def.bg, accent: v.accentColor || def.accent, text: v.textColor || def.text, tagline: v.tagline || selectedCD.tagline, designNotes: v.designNotes || "" };
        });
        const base = rawConcepts.slice(0, 5);
        const newConcepts = [...base, ...improved.slice(0, 3)];
        patch({ concepts: newConcepts });
        setStatus("3 improved variants generated — see the gallery (last 3 slots).");
      }
    } catch (e) {
      setStatus("Improve failed — " + (e.message || "try again"));
    } finally { setImproving(false); }
  }

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
      'KDP bleed: 0.125" on all sides',
      "Resolution: 300 DPI minimum",
      "Color: RGB for digital, CMYK for print-ready PDF",
    ];
    navigator.clipboard.writeText(lines.join("\n"))
      .then(() => setStatus("KDP spec copied!"))
      .catch(() => setStatus("Copy failed — try manually."));
  }

  const slug   = title.slice(0, 30).replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const PREV_H = 320;
  const frontW = Math.round((trimSize.w / trimSize.h) * PREV_H);
  const WRAP_H = Math.round(PREV_H * 0.68);
  const wrapFW = Math.round(frontW * 0.68);
  const hasConcepts = Array.isArray(cover.concepts) && cover.concepts.length >= 8;

  return (
    <section className="mx-auto max-w-7xl">
      <PhaseNav phase={phase} setPhase={setPhase} hasConcepts={hasConcepts} />
      {status && (
        <p className="mb-4 rounded-lg bg-indigo-50 px-4 py-2.5 text-center text-sm font-medium text-indigo-800">{status}</p>
      )}
      {phase === 0 && (
        <PhaseInfo cover={cover} fullProject={fullProject} patch={patch} onRunStrategy={generateStrategy} strategyLoading={strategyLoading} setPhase={setPhase} title={title} />
      )}
      {phase === 1 && (
        <PhaseStrategy cover={cover} strategyLoading={strategyLoading} setPhase={setPhase} />
      )}
      {phase === 2 && (
        <PhaseDesign cover={cover} patch={patch} generating={generating} onGenerate={generateConcepts} setPhase={setPhase} />
      )}
      {phase === 3 && (
        <PhaseGallery
          cover={cover} rawConcepts={rawConcepts} title={title}
          selectedIdx={selectedIdx}
          onSelect={(idx) => { selectConcept(idx); setPhase(4); }}
          generating={generating} onRegenerate={generateConcepts}
          setPhase={setPhase}
        />
      )}
      {phase === 4 && (
        <PhaseReview
          cover={cover} selectedCD={selectedCD} selectedConcept={selectedConcept}
          selectedIdx={selectedIdx} rawConcepts={rawConcepts} title={title}
          patch={patch} patchConcept={patchConcept}
          criticLoading={criticLoading} onGetCritique={getCritique}
          improving={improving} onImprove={improveCover}
          setPhase={setPhase}
          trimSize={trimSize} spineInches={spineInches}
          frontW={frontW} PREV_H={PREV_H} WRAP_H={WRAP_H} wrapFW={wrapFW}
          slug={slug}
          onSelectConcept={(idx) => selectConcept(idx)}
          reviewTab={reviewTab} setReviewTab={setReviewTab}
          copyKDPSpec={copyKDPSpec}
        />
      )}
    </section>
  );
}
