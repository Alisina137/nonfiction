import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  resolveAudience,
  resolveAuthorName,
  resolveBookTitle,
  resolveGenre,
} from "@/lib/projectMeta";

// ─── Constants ────────────────────────────────────────────────────────────────

const BOOK_SIZES = [
  { label: '5" × 8"',            w: 5,   h: 8   },
  { label: '5.06" × 7.81"',      w: 5.06,h: 7.81},
  { label: '5.25" × 8"',         w: 5.25,h: 8   },
  { label: '5.5" × 8.5"',        w: 5.5, h: 8.5 },
  { label: '6" × 9" — Standard', w: 6,   h: 9   },
  { label: '6.14" × 9.21"',      w: 6.14,h: 9.21},
  { label: '7" × 10"',           w: 7,   h: 10  },
  { label: '8" × 10"',           w: 8,   h: 10  },
  { label: '8.5" × 11"',         w: 8.5, h: 11  },
];

const NONFICTION_CATEGORIES = [
  "Biographies & Memoirs",
  "Business & Money",
  "Computers & Technology",
  "Crafts, Hobbies & Home",
  "Education & Teaching",
  "Health, Fitness & Dieting",
  "History",
  "Humor & Entertainment",
  "Parenting & Relationships",
  "Politics & Social Sciences",
  "Professional & Technical",
  "Religion & Spirituality",
  "Science & Math",
  "Self-Help",
  "Sports & Outdoors",
  "Travel",
  "True Crime",
  "Other",
];

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Portuguese",
  "Italian", "Dutch", "Japanese", "Chinese", "Korean", "Other",
];

const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5];

const DEFAULT_CONCEPT = {
  type: "authority",
  bg: "#0f1923",
  accent: "#d4961a",
  text: "#ffffff",
  secondary: "#1a2c3d",
};

const WORKFLOW_STEPS = [
  { id: "bookInfo",    num: 1,  label: "Book Information",    state: "active" },
  { id: "market",      num: 2,  label: "Market Analysis",     state: "locked" },
  { id: "strategy",    num: 3,  label: "Cover Strategy",      state: "locked" },
  { id: "visual",      num: 4,  label: "Visual Direction",    state: "locked" },
  { id: "mood",        num: 5,  label: "Mood Board",          state: "locked" },
  { id: "color",       num: 6,  label: "Color Palette",       state: "locked" },
  { id: "typography",  num: 7,  label: "Typography",          state: "locked" },
  { id: "layout",      num: 8,  label: "Layout & Composition",state: "locked" },
  { id: "concepts",    num: 9,  label: "Generate Concepts",   state: "locked" },
  { id: "review",      num: 10, label: "Review & Refine",     state: "locked" },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

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

function buildCoverData(conceptArg, cover, title) {
  const type = typeof conceptArg === "string"
    ? conceptArg
    : (conceptArg?.type || "authority");
  const def = DEFAULT_CONCEPT;
  const c = (typeof conceptArg === "object" && conceptArg) ? conceptArg : {};
  return {
    type,
    title:    String(title || "Book Title"),
    subtitle: String(cover?.subtitle   || ""),
    author:   String(cover?.authorLine || "Author Name"),
    tagline:  String(c.tagline || cover?.tagline || ""),
    bg:       c.bg        || def.bg,
    accent:   c.accent    || def.accent,
    text:     c.text      || def.text,
    secondary:c.secondary || def.secondary,
  };
}

function createCoverProject(bookCover, fullProject, metadata) {
  const existing = bookCover?.coverStudio;
  return {
    projectId:  existing?.projectId  || `cp-${Date.now()}`,
    bookId:     fullProject?.id      || "unknown",
    createdAt:  existing?.createdAt  || new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    status:     "draft",
    version: {
      current:     1,
      createdAt:   existing?.version?.createdAt  || new Date().toISOString(),
      modifiedAt:  new Date().toISOString(),
      description: "Initial cover setup",
    },
    // Reserved for future prompts
    design:     existing?.design     || null,
    typography: existing?.typography || null,
    images:     existing?.images     || null,
    assets:     existing?.assets     || null,
    versions:   existing?.versions   || [],
    review:     existing?.review     || null,
    export:     existing?.export     || null,
    publishing: existing?.publishing || null,
  };
}

function initMetadata(bookCover, fullProject) {
  const cs = bookCover?.coverStudio?.metadata;
  return {
    title:             cs?.title             ?? resolveBookTitle(fullProject)   ?? "",
    subtitle:          cs?.subtitle          ?? bookCover?.subtitle             ?? "",
    author:            cs?.author            ?? bookCover?.authorLine           ?? resolveAuthorName(fullProject) ?? "",
    series:            cs?.series            ?? bookCover?.series               ?? "",
    edition:           cs?.edition           ?? bookCover?.edition              ?? "",
    primaryCategory:   cs?.primaryCategory   ?? bookCover?.primaryCategory      ?? "",
    secondaryCategory: cs?.secondaryCategory ?? bookCover?.secondaryCategory    ?? "",
    audience:          cs?.audience          ?? resolveAudience(fullProject)    ?? "",
    language:          cs?.language          ?? bookCover?.language             ?? "English",
    bookSize:          cs?.bookSize          ?? BOOK_SIZES[4].label,
    publisher:         cs?.publisher         ?? bookCover?.publisher            ?? "",
  };
}

function initCanvas(bookCover) {
  const cs = bookCover?.coverStudio?.canvas;
  return {
    background:   cs?.background   ?? "#d1d5db",
    zoomLevel:    cs?.zoomLevel    ?? "fit",
    safeMargin:   cs?.safeMargin   ?? 0.125,
    bleedMargin:  cs?.bleedMargin  ?? 0.125,
  };
}

function validateMetadata(meta) {
  const errors = {};
  if (!String(meta.title || "").trim())
    errors.title = "Book title is required";
  else if (meta.title.length > 80)
    errors.title = "Title must be under 80 characters";
  if (!String(meta.author || "").trim())
    errors.author = "Author name is required";
  const size = BOOK_SIZES.find(s => s.label === meta.bookSize);
  if (meta.bookSize && !size)
    errors.bookSize = "Unsupported book size";
  return errors;
}

// ─── SVG Builders (kept for future export) ────────────────────────────────────

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

// ─── React Renderers ──────────────────────────────────────────────────────────

function AuthorityRenderer({ cd, thumb }) {
  const { bg, accent, text, title, subtitle, author, tagline } = cd;
  const TS = thumb ? 8.5 : 27, SS = thumb ? 4 : 11.5, AS = thumb ? 3 : 9, TGS = thumb ? 2.5 : 7.5;
  return (
    <div style={{ background: bg, color: text, width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(255,255,255,0.025) 10px,rgba(255,255,255,0.025) 11px)", pointerEvents: "none" }} />
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
  const TS = thumb ? 9 : 27, AS = thumb ? 3 : 8, TGS = thumb ? 2 : 6.5;
  return (
    <div style={{ background: bg, color: text, width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: thumb ? "-14%" : "-12%", right: thumb ? "-30%" : "-25%", width: "88%", paddingBottom: "88%", borderRadius: "50%", background: accent, opacity: 0.17, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "4%", right: thumb ? "-13%" : "-10%", width: "60%", paddingBottom: "60%", borderRadius: "50%", background: accent, opacity: 0.13, pointerEvents: "none" }} />
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: thumb ? "5% 7% 5%" : "7% 9% 5.5%" }}>
        {tagline && <div style={{ fontSize: TGS, fontFamily: "Arial,sans-serif", color: text, opacity: 0.45, letterSpacing: thumb ? 0.5 : 3.5, textTransform: "uppercase", marginBottom: thumb ? 1 : "2%" }}>{tagline}</div>}
        <div style={{ fontSize: TS, fontFamily: "'Arial Black',Impact,sans-serif", fontWeight: 900, lineHeight: 0.97, letterSpacing: -1, color: text }}>{title}</div>
        <div style={{ height: thumb ? 1.5 : 4, background: accent, width: thumb ? "18%" : "22%", marginTop: thumb ? 1.5 : "3.5%", marginBottom: thumb ? 1.5 : "3.5%" }} />
        <div style={{ fontSize: AS, fontFamily: "Arial,sans-serif", color: text, opacity: 0.7 }}>{author}</div>
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
        {tagline && <div style={{ fontSize: TGS, fontFamily: "Arial,sans-serif", color: accent, letterSpacing: thumb ? 0.5 : 3, textTransform: "uppercase", marginBottom: thumb ? 1 : "2%", opacity: 0.9 }}>{tagline}</div>}
        <div style={{ fontSize: TS, fontFamily: "Georgia,'Times New Roman',serif", fontWeight: 700, lineHeight: 1.1, color: text }}>{title}</div>
      </div>
      <div style={{ position: "relative", flex: "0 0 18%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", textAlign: "center", padding: thumb ? "0 8% 5%" : "0 10% 6%" }}>
        {subtitle && <div style={{ fontSize: SS, fontFamily: "Georgia,serif", fontStyle: "italic", color: text, opacity: 0.75, marginBottom: thumb ? 1 : "2.5%" }}>{subtitle}</div>}
        <div style={{ fontSize: AS, fontFamily: "Arial,sans-serif", color: text, opacity: 0.6, letterSpacing: thumb ? 0.5 : 2.5, textTransform: "uppercase" }}>{author}</div>
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
        {tagline && <div style={{ fontSize: TGS, fontFamily: "'Arial Black',Impact,sans-serif", color: text, opacity: 0.42, letterSpacing: thumb ? 0.5 : 3, textTransform: "uppercase", marginBottom: thumb ? 1 : "2%" }}>{tagline}</div>}
        <div style={{ fontSize: TS, fontFamily: "Impact,'Arial Black',sans-serif", fontWeight: 900, lineHeight: 0.95, letterSpacing: -0.5, textTransform: "uppercase", color: text }}>{title}</div>
        {subtitle && <div style={{ fontSize: SS, fontFamily: "Arial,sans-serif", color: text, opacity: 0.65, lineHeight: 1.4, marginTop: thumb ? 1.5 : "3%", paddingRight: thumb ? "14%" : "13%" }}>{subtitle}</div>}
      </div>
      <div style={{ position: "relative", padding: thumb ? "0 7% 5%" : "0 8% 5.5%" }}>
        <div style={{ fontSize: AS, fontFamily: "Impact,'Arial Black',sans-serif", fontWeight: 700, color: accent, letterSpacing: thumb ? 0.5 : 3, textTransform: "uppercase" }}>{author}</div>
      </div>
    </div>
  );
}

function ConceptRenderer({ cd }) {
  if (!cd) return null;
  switch (cd.type) {
    case "premium":  return <PremiumRenderer  cd={cd} />;
    case "minimal":  return <MinimalRenderer  cd={cd} />;
    case "metaphor": return <MetaphorRenderer cd={cd} />;
    case "dynamic":  return <DynamicRenderer  cd={cd} />;
    default:         return <AuthorityRenderer cd={cd} />;
  }
}

// ─── Cover Strategy ───────────────────────────────────────────────────────────

const CATEGORY_PROFILES = {
  "Business & Money":           { purpose: "Authority",      color: "Dark Professional", image: "Typography First", vis: "business",    complexity: "Professional" },
  "Self-Help":                  { purpose: "Inspirational",  color: "Bright Modern",     image: "Illustration",     vis: "self-help",   complexity: "Accessible"   },
  "Health, Fitness & Dieting":  { purpose: "Trust",          color: "Bright Modern",     image: "Icon Based",       vis: "wellness",    complexity: "Accessible"   },
  "Computers & Technology":     { purpose: "Professional",   color: "High Contrast",     image: "Abstract",         vis: "tech",        complexity: "Advanced"     },
  "Science & Math":             { purpose: "Educational",    color: "Academic",          image: "Vector",           vis: "scientific",  complexity: "Academic"     },
  "Biographies & Memoirs":      { purpose: "Trust",          color: "Calm Neutral",      image: "Photography",      vis: "memoir",      complexity: "Narrative"    },
  "History":                    { purpose: "Authority",      color: "Luxury",            image: "Photography",      vis: "historical",  complexity: "Academic"     },
  "Religion & Spirituality":    { purpose: "Inspirational",  color: "Calm Neutral",      image: "Illustration",     vis: "spiritual",   complexity: "Reflective"   },
  "Politics & Social Sciences": { purpose: "Curiosity",      color: "High Contrast",     image: "Typography First", vis: "political",   complexity: "Advanced"     },
  "Education & Teaching":       { purpose: "Educational",    color: "Academic",          image: "Illustration",     vis: "educational", complexity: "Academic"     },
  "Professional & Technical":   { purpose: "Professional",   color: "Dark Professional", image: "Icon Based",       vis: "technical",   complexity: "Advanced"     },
  "Parenting & Relationships":  { purpose: "Trust",          color: "Calm Neutral",      image: "Illustration",     vis: "personal",    complexity: "Accessible"   },
  "Crafts, Hobbies & Home":     { purpose: "Inspirational",  color: "Bright Modern",     image: "Photography",      vis: "practical",   complexity: "Accessible"   },
  "Sports & Outdoors":          { purpose: "Inspirational",  color: "High Contrast",     image: "Photography",      vis: "active",      complexity: "Accessible"   },
  "Travel":                     { purpose: "Curiosity",      color: "Bright Modern",     image: "Photography",      vis: "adventurous", complexity: "Narrative"    },
  "True Crime":                 { purpose: "Curiosity",      color: "High Contrast",     image: "Typography First", vis: "suspenseful", complexity: "Narrative"    },
  "Humor & Entertainment":      { purpose: "Curiosity",      color: "Bright Modern",     image: "Illustration",     vis: "playful",     complexity: "Accessible"   },
};

function deriveCoverStrategy(fullProject, metadata) {
  const category  = metadata?.primaryCategory   || "";
  const category2 = metadata?.secondaryCategory || "";
  const audience  = metadata?.audience
    || fullProject?.bookDetails?.audience
    || fullProject?.research?.audiencePreset
    || "";
  const rawTone   = fullProject?.bookDetails?.tone
    || (fullProject?.research?.authorTones || []).join(", ");
  const title     = metadata?.title    || "";
  const subtitle  = metadata?.subtitle || "";
  const dna       = fullProject?.proposedBook?.content || {};
  const niche     = fullProject?.research?.mainNicheLabel || "";
  const subNiche  = fullProject?.research?.subNicheLabel  || "";

  const base = CATEGORY_PROFILES[category]
    || CATEGORY_PROFILES[category2]
    || { purpose: "Professional", color: "High Contrast", image: "Typography First", vis: "nonfiction", complexity: "Professional" };

  let { purpose, color, image } = base;
  const tl = rawTone.toLowerCase();
  if (/premium|luxury|prestig/i.test(tl))         color = "Luxury";
  if (/academic|scholarly|rigorous/i.test(tl))    { color = "Academic"; image = "Vector"; }
  if (/bold|energetic|powerful|strong/i.test(tl)) color = "High Contrast";
  if (/calm|gentle|soothing|soft/i.test(tl))      color = "Calm Neutral";
  if (/minimal|clean|simple/i.test(tl))           { color = "Calm Neutral"; image = "Typography First"; }
  if (/dark|serious/i.test(tl) && color !== "Luxury") color = "Dark Professional";

  const genreLabel = category || niche || "Nonfiction";
  const coverGoal  = `${base.complexity} ${base.vis} cover`;

  let confidence = 0;
  if (title)    confidence += 20;
  if (category) confidence += 20;
  if (audience) confidence += 15;
  if (rawTone)  confidence += 15;
  if (subtitle) confidence += 10;
  if (Object.keys(dna).length > 0) confidence += 15;
  if (niche)    confidence += 5;

  return {
    genre:           genreLabel,
    subgenre:        category2 || subNiche || "",
    audience:        audience || "",
    tone:            rawTone  || "",
    complexity:      base.complexity,
    visualStyle:     base.vis,
    coverGoal,
    coverPurpose:    purpose,
    colorDirection:  color,
    imageStyle:      image,
    confidenceScore: Math.min(100, confidence),
    derivedAt:       new Date().toISOString(),
  };
}

const PURPOSE_COLORS = {
  Authority:     "bg-slate-800 text-white",
  Trust:         "bg-emerald-600 text-white",
  Curiosity:     "bg-purple-600 text-white",
  Premium:       "bg-amber-600 text-white",
  Professional:  "bg-sky-700 text-white",
  Educational:   "bg-indigo-600 text-white",
  Inspirational: "bg-rose-600 text-white",
};

function CoverStrategyCard({ strategy }) {
  if (!strategy) return null;

  const confColor = strategy.confidenceScore >= 80
    ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : strategy.confidenceScore >= 50
    ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-rose-600 bg-rose-50 border-rose-200";

  const barColor = strategy.confidenceScore >= 80
    ? "bg-emerald-400" : strategy.confidenceScore >= 50
    ? "bg-amber-400" : "bg-rose-400";

  return (
    <div className="space-y-3">
      {/* Visual Goal */}
      <div className="rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 px-3 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Visual Goal</p>
        <p className="text-[12px] font-bold text-white leading-tight capitalize">{strategy.coverGoal}</p>
      </div>

      {/* Cover Purpose */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Cover Purpose</p>
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${PURPOSE_COLORS[strategy.coverPurpose] || "bg-slate-700 text-white"}`}>
          {strategy.coverPurpose}
        </span>
      </div>

      {/* Color Direction */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Color Direction</p>
        <p className="text-[11px] font-semibold text-slate-800">{strategy.colorDirection}</p>
      </div>

      {/* Image Style */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Image Style</p>
        <p className="text-[11px] font-semibold text-slate-800">{strategy.imageStyle}</p>
      </div>

      {/* Details */}
      <div className="border-t border-slate-100 pt-2 space-y-1.5">
        {strategy.genre && (
          <div className="flex justify-between items-start gap-2">
            <span className="text-[9px] text-slate-400 shrink-0 mt-px">Genre</span>
            <span className="text-[10px] font-medium text-slate-600 text-right leading-tight">{strategy.genre}</span>
          </div>
        )}
        {strategy.subgenre && (
          <div className="flex justify-between items-start gap-2">
            <span className="text-[9px] text-slate-400 shrink-0 mt-px">Subgenre</span>
            <span className="text-[10px] font-medium text-slate-600 text-right leading-tight">{strategy.subgenre}</span>
          </div>
        )}
        {strategy.audience && (
          <div className="flex justify-between items-start gap-2">
            <span className="text-[9px] text-slate-400 shrink-0 mt-px">Audience</span>
            <span className="text-[10px] font-medium text-slate-600 text-right leading-tight max-w-[110px]">{strategy.audience}</span>
          </div>
        )}
        {strategy.complexity && (
          <div className="flex justify-between items-center gap-2">
            <span className="text-[9px] text-slate-400 shrink-0">Complexity</span>
            <span className="text-[10px] font-medium text-slate-600">{strategy.complexity}</span>
          </div>
        )}
      </div>

      {/* Confidence */}
      <div className={`rounded-lg border px-2.5 py-2 ${confColor}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">Confidence</span>
          <span className="text-[11px] font-bold">{strategy.confidenceScore}%</span>
        </div>
        <div className="h-1 rounded-full bg-black/10 overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${strategy.confidenceScore}%` }} />
        </div>
        {strategy.confidenceScore < 60 && (
          <p className="text-[9px] mt-1.5 leading-relaxed opacity-80">
            Complete Book Details, Research, and Proposed Book for a higher confidence strategy.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Visual Direction Engine ──────────────────────────────────────────────────

const STRATEGY_TO_VISUAL_STYLE = {
  "Dark Professional": { style: "Corporate",    mood: "Confident"   },
  "Bright Modern":     { style: "Modern",       mood: "Energetic"   },
  "High Contrast":     { style: "Bold",         mood: "Powerful"    },
  "Calm Neutral":      { style: "Clean",        mood: "Calm"        },
  "Luxury":            { style: "Luxury",       mood: "Elegant"     },
  "Academic":          { style: "Academic",     mood: "Serious"     },
};

const PURPOSE_TO_MOOD = {
  Authority:     "Confident",
  Trust:         "Trustworthy",
  Curiosity:     "Innovative",
  Premium:       "Elegant",
  Professional:  "Serious",
  Educational:   "Trustworthy",
  Inspirational: "Inspirational",
};

const IMAGE_TO_COMPOSITION = {
  "Typography First": "Typography First",
  "Abstract":         "Center Focus",
  "Illustration":     "Object Focus",
  "Photography":      "Full Image",
  "Vector":           "Center Focus",
  "Icon Based":       "Minimal Layout",
  "Mixed":            "Split Layout",
};

const IMAGE_TO_FOCAL = {
  "Typography First": "Typography",
  "Abstract":         "Pattern",
  "Illustration":     "Illustration",
  "Photography":      "Main Object",
  "Vector":           "Symbol",
  "Icon Based":       "Symbol",
  "Mixed":            "Title",
};

const COMPOSITION_TO_HIERARCHY = {
  "Typography First": ["Title", "Subtitle", "Author", "Visual Element"],
  "Full Image":       ["Main Visual", "Title", "Subtitle", "Author"],
  "Center Focus":     ["Title", "Main Visual", "Subtitle", "Author"],
  "Minimal Layout":   ["Title", "Author", "Subtitle"],
  "Object Focus":     ["Main Visual", "Title", "Subtitle", "Author"],
  "Split Layout":     ["Title", "Main Visual", "Author", "Subtitle"],
  "Top Focus":        ["Title", "Subtitle", "Main Visual", "Author"],
};

const COMPLEXITY_TO_LEVEL = {
  Professional: "Balanced",
  Accessible:   "Simple",
  Advanced:     "Detailed",
  Academic:     "Detailed",
  Narrative:    "Balanced",
  Reflective:   "Simple",
};

function deriveVisualDirection(strategy, metadata, fullProject) {
  if (!strategy) return null;

  const tl = (strategy.tone || "").toLowerCase();
  const category = metadata?.primaryCategory || "";

  // Visual Style
  let { style = "Professional", mood = "Confident" } =
    STRATEGY_TO_VISUAL_STYLE[strategy.colorDirection] || {};

  if (PURPOSE_TO_MOOD[strategy.coverPurpose]) mood = PURPOSE_TO_MOOD[strategy.coverPurpose];

  // Tone modifiers for style
  if (/minimal|clean|simple/i.test(tl))           style = "Minimal";
  else if (/premium|prestig/i.test(tl))            style = "Premium";
  else if (/luxury/i.test(tl))                     style = "Luxury";
  else if (/elegant/i.test(tl))                    style = "Elegant";
  else if (/friendly|warm|approachable/i.test(tl)) style = "Friendly";
  else if (/creative|dynamic|fresh/i.test(tl))     style = "Creative";

  // Tone modifiers for mood
  if (/energetic|bold|powerful|dynamic/i.test(tl)) mood = "Energetic";
  else if (/calm|gentle|soothing|peaceful/i.test(tl)) mood = "Calm";
  else if (/serious|rigorous|academic/i.test(tl))  mood = "Serious";
  else if (/inspir/i.test(tl))                     mood = "Inspirational";
  else if (/confident|authorit/i.test(tl))         mood = "Confident";

  // Composition
  let composition = IMAGE_TO_COMPOSITION[strategy.imageStyle] || "Center Focus";
  if (strategy.coverPurpose === "Authority" && composition !== "Typography First")
    composition = "Top Focus";
  if (category === "Business & Money" && composition === "Object Focus")
    composition = "Typography First";

  // Visual Complexity
  const complexity = COMPLEXITY_TO_LEVEL[strategy.complexity] || "Balanced";

  // Focal Point
  let focalPoint = IMAGE_TO_FOCAL[strategy.imageStyle] || "Title";
  if (strategy.coverPurpose === "Authority" || strategy.coverPurpose === "Professional")
    focalPoint = "Title";
  if (style === "Minimal" || style === "Clean") focalPoint = "Typography";

  // Visual Hierarchy
  const hierarchy = COMPOSITION_TO_HIERARCHY[composition] || ["Title", "Main Visual", "Subtitle", "Author"];

  // Style Summary
  const summary = `This cover should feel ${style.toLowerCase()}, ${mood.toLowerCase()} and ${(strategy.coverPurpose || "professional").toLowerCase()} while emphasizing ${focalPoint.toLowerCase()} and ${(strategy.colorDirection || "contrast").toLowerCase().replace(/ /g, " ")}.`;

  return {
    visualStyle:   style,
    designMood:    mood,
    composition,
    complexity,
    focalPoint,
    hierarchy,
    summary,
    derivedAt: new Date().toISOString(),
  };
}

function VisualDirectionCard({ direction }) {
  if (!direction) return null;

  const STYLE_COLORS = {
    Minimal:      "bg-slate-100 text-slate-700",
    Modern:       "bg-sky-100 text-sky-800",
    Premium:      "bg-amber-100 text-amber-800",
    Elegant:      "bg-purple-100 text-purple-800",
    Corporate:    "bg-slate-800 text-white",
    Luxury:       "bg-amber-900 text-amber-100",
    Academic:     "bg-indigo-100 text-indigo-800",
    Bold:         "bg-rose-100 text-rose-800",
    Clean:        "bg-emerald-100 text-emerald-800",
    Creative:     "bg-pink-100 text-pink-800",
    Friendly:     "bg-orange-100 text-orange-800",
    Professional: "bg-sky-800 text-white",
  };

  const MOOD_ICONS = {
    Confident:     "◆",
    Calm:          "◎",
    Energetic:     "▲",
    Serious:       "■",
    Inspirational: "✦",
    Innovative:    "◈",
    Trustworthy:   "●",
    Powerful:      "★",
    Elegant:       "◇",
  };

  const styleCls = STYLE_COLORS[direction.visualStyle] || "bg-slate-100 text-slate-700";
  const moodIcon = MOOD_ICONS[direction.designMood] || "◉";

  return (
    <div className="space-y-3">
      {/* Visual Style */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Visual Style</p>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${styleCls}`}>
          {direction.visualStyle}
        </span>
      </div>

      {/* Design Mood */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Design Mood</p>
        <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
          <span className="text-[10px] text-slate-400">{moodIcon}</span>
          {direction.designMood}
        </span>
      </div>

      {/* Composition */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Composition</p>
        <span className="text-[11px] font-semibold text-slate-700">{direction.composition}</span>
      </div>

      {/* Visual Complexity */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Complexity</p>
        <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
          direction.complexity === "Simple"   ? "bg-emerald-50 text-emerald-700" :
          direction.complexity === "Detailed" ? "bg-purple-50 text-purple-700"  :
          "bg-sky-50 text-sky-700"
        }`}>{direction.complexity}</span>
      </div>

      {/* Focal Point */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Focal Point</p>
        <span className="text-[11px] font-semibold text-slate-700">{direction.focalPoint}</span>
      </div>

      {/* Visual Hierarchy */}
      <div className="border-t border-slate-100 pt-2.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Visual Hierarchy</p>
        <ol className="space-y-1">
          {direction.hierarchy.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-[10px] text-slate-700 font-medium">{item}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Style Summary */}
      <div className="rounded-lg bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-100 px-3 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 mb-1">Style Summary</p>
        <p className="text-[10px] text-indigo-900 leading-relaxed italic">"{direction.summary}"</p>
      </div>
    </div>
  );
}

// ─── AI Cover Prompt Builder ──────────────────────────────────────────────────

const STYLE_MAP = {
  Minimal:      "Minimal geometric artwork",
  Modern:       "Modern digital illustration",
  Premium:      "Premium vector artwork",
  Corporate:    "Professional corporate design",
  Luxury:       "High-end luxury editorial design",
  Academic:     "Clean academic illustration",
  Bold:         "Bold graphic design",
  Clean:        "Clean minimal design",
  Creative:     "Creative dynamic illustration",
  Friendly:     "Warm friendly illustration",
  Elegant:      "Elegant editorial design",
  Professional: "Professional polished design",
};

const LIGHTING_MAP = {
  Minimal:      "Soft",
  Modern:       "Natural",
  Premium:      "Studio",
  Corporate:    "Cinematic",
  Luxury:       "Studio",
  Academic:     "Natural",
  Bold:         "High Contrast",
  Clean:        "Soft",
  Creative:     "Dramatic",
  Friendly:     "Natural",
  Elegant:      "Studio",
  Professional: "Cinematic",
};

const BACKGROUND_MAP = {
  "Typography First": "Minimal",
  "Full Image":       "Nature",
  "Center Focus":     "Gradient",
  "Minimal Layout":   "Solid Color",
  "Object Focus":     "Abstract",
  "Split Layout":     "Gradient",
  "Top Focus":        "Solid Color",
};

const CAMERA_MAP = {
  "Typography First": "Flat, front-facing editorial view",
  "Full Image":       "Wide establishing shot",
  "Center Focus":     "Centered, balanced frame",
  "Minimal Layout":   "Minimal top-down view",
  "Object Focus":     "Close-up focused view",
  "Split Layout":     "Balanced two-column view",
  "Top Focus":        "Strong top-weighted composition",
};

const IMAGE_STYLE_SUBJECT = {
  "Typography First": "Bold typographic layout with professional lettering and strong visual hierarchy",
  "Abstract":         "Abstract geometric shapes and flowing forms evoking the book's core theme",
  "Illustration":     "Custom illustration representing the book's central concept",
  "Photography":      "Professional lifestyle photograph representing the book's subject matter",
  "Vector":           "Clean vector illustration symbolizing the book's core idea",
  "Icon Based":       "Minimal icon-driven composition representing the key concept",
  "Mixed":            "Combined typographic and illustrative design conveying the book's message",
};

const CATEGORY_SUBJECT_MODIFIER = {
  "Business & Money":        "a confident professional in a modern business environment",
  "Self-Help":               "an empowered individual achieving a personal breakthrough",
  "Health, Fitness & Dieting": "a healthy active person in a motivating environment",
  "Computers & Technology":  "a sleek modern technology-inspired abstract composition",
  "Education & Teaching":    "a clear structured learning environment with academic elements",
  "Politics & Social Sciences": "a thought-provoking symbolic composition with depth and gravitas",
  "Parenting & Relationships": "a warm human connection in a welcoming environment",
  "Religion & Spirituality": "a serene transcendent composition with spiritual symbolism",
  "Travel":                  "an inspiring destination scene with a sense of adventure",
  "Crafts, Hobbies & Home":  "a warm creative workspace with craft materials",
  "Humor & Entertainment":   "a playful dynamic composition with lively energy",
  "Biographies & Memoirs":   "a compelling individual portrait with cinematic depth",
};

const COLOR_DIRECTION_PALETTE = {
  "Dark Professional": "Deep navy and charcoal with white and gold accents",
  "Bright Modern":     "Vibrant blues and teals with clean white and bright accents",
  "High Contrast":     "High contrast black and white with a bold accent color",
  "Calm Neutral":      "Warm greys and beige with muted earth tones",
  "Luxury":            "Deep black and rich gold with cream and platinum accents",
  "Academic":          "Deep indigo and slate with ivory and warm amber accents",
};

const NEGATIVE_PROMPT = "No watermarks, no blurry or low-quality image, no distorted anatomy, no extra limbs, no cropped objects, no unreadable text overlaid, no low resolution, no pixelation, no cartoonish style unless intended, no cluttered composition, no amateur design.";

function buildCoverPrompt(strategy, visualDirection, metadata, fullProject) {
  if (!strategy || !visualDirection) return null;

  const category   = metadata?.primaryCategory || "";
  const category2  = metadata?.secondaryCategory || "";
  const imageStyle = strategy.imageStyle || "Typography First";
  const audience   = fullProject?.audience || fullProject?.proposedBook?.targetAudience || "";
  const archetype  = fullProject?.bookDetails?.bookArchetype || "";

  // Subject
  let subjectBase = IMAGE_STYLE_SUBJECT[imageStyle] || "Professional design representing the book's core concept";
  const catMod    = CATEGORY_SUBJECT_MODIFIER[category] || CATEGORY_SUBJECT_MODIFIER[category2] || "";
  if (catMod && imageStyle !== "Typography First") {
    subjectBase = catMod.charAt(0).toUpperCase() + catMod.slice(1);
  }
  if (archetype && imageStyle !== "Typography First") {
    subjectBase += `, with a ${archetype.toLowerCase()} narrative feel`;
  }
  const subject = subjectBase;

  // Style
  const style = STYLE_MAP[visualDirection.visualStyle] || "Professional polished design";

  // Mood
  const mood = visualDirection.designMood || "Professional";

  // Composition
  const composition = visualDirection.composition || "Center Focus";

  // Color Palette
  const colorPalette = COLOR_DIRECTION_PALETTE[strategy.colorDirection]
    || `${strategy.colorDirection || "Professional"} color scheme`;

  // Lighting
  const lighting = LIGHTING_MAP[visualDirection.visualStyle] || "Natural";

  // Background
  const background = BACKGROUND_MAP[composition] || "Gradient";

  // Camera/View
  const cameraView = CAMERA_MAP[composition] || "Centered, balanced frame";

  // Detail Level
  const detailLevel = visualDirection.complexity || "Balanced";

  // Final Prompt
  const finalPrompt =
    `Book cover image. ` +
    `Subject: ${subject}. ` +
    `Style: ${style}. ` +
    `Mood: ${mood}. ` +
    `Composition: ${composition}. ` +
    `Color palette: ${colorPalette}. ` +
    `Lighting: ${lighting}. ` +
    `Background: ${background}. ` +
    `View: ${cameraView}. ` +
    `Detail level: ${detailLevel}. ` +
    `No text, no titles, no words on the image. ` +
    `Ultra high quality, publishing-ready cover art.`;

  return {
    subject,
    style,
    mood,
    composition,
    colorPalette,
    lighting,
    background,
    cameraView,
    detailLevel,
    negativePrompt: NEGATIVE_PROMPT,
    finalPrompt,
    builtAt: new Date().toISOString(),
  };
}

function AiPromptCard({
  prompt,
  concepts,
  selectedConceptIdx,
  generatingAll,
  regeneratingIdx,
  onGenerate,
  onRegenerateConcept,
  onSelectConcept,
}) {
  const [copied, setCopied] = useState(false);
  const [copiedNeg, setCopiedNeg] = useState(false);

  function handleCopy(text, setter) {
    navigator.clipboard?.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 1800);
    });
  }

  if (!prompt) {
    return (
      <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-4 text-center">
        <p className="text-[10px] text-slate-400">Complete Cover Strategy to generate prompt.</p>
      </div>
    );
  }

  const fields = [
    { label: "Subject",       value: prompt.subject      },
    { label: "Style",         value: prompt.style        },
    { label: "Mood",          value: prompt.mood         },
    { label: "Composition",   value: prompt.composition  },
    { label: "Color Palette", value: prompt.colorPalette },
    { label: "Lighting",      value: prompt.lighting     },
    { label: "Background",    value: prompt.background   },
    { label: "Camera / View", value: prompt.cameraView   },
    { label: "Detail Level",  value: prompt.detailLevel  },
  ];

  const CONCEPT_STYLE_COLORS = {
    Professional: "bg-sky-50 border-sky-200 text-sky-800",
    Minimal:      "bg-slate-50 border-slate-200 text-slate-700",
    Bold:         "bg-rose-50 border-rose-200 text-rose-800",
    Creative:     "bg-purple-50 border-purple-200 text-purple-800",
  };

  return (
    <div className="space-y-3">
      {/* Field breakdown */}
      <div className="space-y-2">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
            <p className="text-[10px] text-slate-700 leading-relaxed">{value}</p>
          </div>
        ))}
      </div>

      {/* Final Prompt */}
      <div className="border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Final Prompt</p>
          <button
            onClick={() => handleCopy(prompt.finalPrompt, setCopied)}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
        <div className="rounded-lg bg-slate-900 px-3 py-2.5">
          <p className="text-[10px] text-slate-200 leading-relaxed font-mono break-words whitespace-pre-wrap select-all">
            {prompt.finalPrompt}
          </p>
        </div>
      </div>

      {/* Negative Prompt */}
      <div className="border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Negative Prompt</p>
          <button
            onClick={() => handleCopy(prompt.negativePrompt, setCopiedNeg)}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-semibold bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
          >
            {copiedNeg ? "✓ Copied" : "Copy"}
          </button>
        </div>
        <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2.5">
          <p className="text-[10px] text-rose-800 leading-relaxed font-mono break-words whitespace-pre-wrap select-all">
            {prompt.negativePrompt}
          </p>
        </div>
      </div>

      {/* ── Generate Cover Concepts button ── */}
      <div className="border-t border-slate-100 pt-3">
        <button
          onClick={onGenerate}
          disabled={generatingAll}
          className={`w-full rounded-xl py-2.5 text-[11px] font-bold tracking-wide transition-all flex items-center justify-center gap-2 ${
            generatingAll
              ? "bg-indigo-100 text-indigo-400 cursor-not-allowed"
              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow"
          }`}
        >
          {generatingAll ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
              Generating Cover Concepts...
            </>
          ) : (
            <>✦ Generate Cover Concepts</>
          )}
        </button>
      </div>

      {/* ── Concepts Grid ── */}
      {(concepts && concepts.length > 0) && (
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Cover Concepts</p>
          <div className="grid grid-cols-2 gap-2">
            {concepts.map((concept, idx) => {
              const isSelected   = selectedConceptIdx === idx;
              const isRegenerating = regeneratingIdx === idx;
              const styleCls     = CONCEPT_STYLE_COLORS[concept.name] || "bg-slate-50 border-slate-200 text-slate-700";

              return (
                <div
                  key={idx}
                  className={`relative rounded-xl border-2 overflow-hidden transition-all ${
                    isSelected
                      ? "border-indigo-500 shadow-md shadow-indigo-100"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Image area */}
                  <div className="relative bg-slate-100" style={{ aspectRatio: "9/11" }}>
                    {isRegenerating ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50">
                        <span className="inline-block w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-2" />
                        <span className="text-[9px] text-slate-400">Regenerating…</span>
                      </div>
                    ) : concept.error ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-50 p-2">
                        <span className="text-[10px] text-rose-500 font-medium text-center">Generation failed</span>
                        <span className="text-[9px] text-rose-400 text-center mt-0.5">{concept.error}</span>
                      </div>
                    ) : concept.imageDataUrl ? (
                      <img
                        src={concept.imageDataUrl}
                        alt={`${concept.name} concept`}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                        <span className="text-[9px] text-slate-400">No image</span>
                      </div>
                    )}

                    {/* Selected badge */}
                    {isSelected && !isRegenerating && (
                      <div className="absolute top-1.5 right-1.5 bg-indigo-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold shadow">
                        ✓
                      </div>
                    )}
                  </div>

                  {/* Card footer */}
                  <div className="p-1.5 bg-white space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 border ${styleCls}`}>
                        {concept.name}
                      </span>
                      {concept.resolution && (
                        <span className="text-[8px] text-slate-400">{concept.resolution}</span>
                      )}
                    </div>
                    {concept.generatedAt && (
                      <p className="text-[8px] text-slate-400">
                        {concept.generationMs ? `${(concept.generationMs / 1000).toFixed(1)}s` : ""}
                      </p>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={() => onSelectConcept(idx)}
                        disabled={isRegenerating}
                        className={`flex-1 rounded-md py-0.5 text-[9px] font-semibold transition-colors ${
                          isSelected
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </button>
                      <button
                        onClick={() => onRegenerateConcept(idx)}
                        disabled={isRegenerating || generatingAll}
                        className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-40"
                        title="Regenerate this concept"
                      >
                        ↻
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Typography Intelligence Engine ──────────────────────────────────────────

function TypographyStars({ count }) {
  const n = Math.max(1, Math.min(5, count || 0));
  return (
    <span style={{ letterSpacing: 1 }}>
      <span className="text-amber-400">{"★".repeat(n)}</span>
      <span className="text-slate-200">{"★".repeat(5 - n)}</span>
    </span>
  );
}

function TypographyCard({ profile, generating, onRegenerate }) {
  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-5">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <span className="text-[10px] text-slate-400">Generating typography profile…</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Select a cover concept to automatically generate a typography profile.
        </p>
        <button
          type="button"
          onClick={onRegenerate}
          className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 transition"
        >
          Generate Now ↻
        </button>
      </div>
    );
  }

  const readabilityStyle = {
    Excellent: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Good:      "bg-sky-50 text-sky-700 border-sky-200",
    Fair:      "bg-amber-50 text-amber-700 border-amber-200",
    Poor:      "bg-red-50 text-red-700 border-red-200",
  }[profile.thumbnailReadability] || "bg-slate-50 text-slate-600 border-slate-200";

  const readabilityIcon = { Excellent: "★", Good: "✓", Fair: "~", Poor: "!" }[profile.thumbnailReadability] || "";

  return (
    <div className="space-y-3 text-[10px]">

      {/* Font Categories */}
      <div className="space-y-1.5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Font Categories</p>
        {[
          { label: "Title",    value: profile.titleFontCategory    },
          { label: "Subtitle", value: profile.subtitleFontCategory },
          { label: "Author",   value: profile.authorFontCategory   },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-start justify-between gap-2">
            <span className="text-slate-400 shrink-0">{label}</span>
            <span className="font-semibold text-slate-800 text-right leading-tight">{value}</span>
          </div>
        ))}
      </div>

      {/* Font Pairing */}
      {profile.fontPairing && (
        <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2 space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Font Pairing</p>
          <p className="text-slate-700 leading-relaxed">{profile.fontPairing}</p>
        </div>
      )}

      {/* Text Hierarchy */}
      {profile.textHierarchy && (
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Text Hierarchy</p>
          {[
            { label: "Title",    n: profile.textHierarchy.title    },
            { label: "Subtitle", n: profile.textHierarchy.subtitle },
            { label: "Author",   n: profile.textHierarchy.author   },
            { label: "Series",   n: profile.textHierarchy.series   },
          ].map(({ label, n }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-slate-500">{label}</span>
              <TypographyStars count={n} />
            </div>
          ))}
        </div>
      )}

      {/* Alignment + Position */}
      <div className="flex flex-wrap gap-1.5">
        {profile.titleAlignment && (
          <div className="rounded-md bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 capitalize">
            {profile.titleAlignment} aligned
          </div>
        )}
        {profile.textPosition && (
          <div className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {profile.textPosition}
          </div>
        )}
      </div>

      {/* Relative Text Sizes */}
      {profile.textSizes && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Relative Sizes</p>
          {[
            { label: "Title",    pct: 100 },
            { label: "Subtitle", pct: profile.textSizes.subtitle },
            { label: "Author",   pct: profile.textSizes.author   },
            { label: "Series",   pct: profile.textSizes.series   },
          ].filter(x => x.pct).map(({ label, pct }) => (
            <div key={label} className="space-y-0.5">
              <div className="flex justify-between">
                <span className="text-slate-500">{label}</span>
                <span className="font-semibold text-slate-700">{pct}%</span>
              </div>
              <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Color Recommendation */}
      {profile.textColor && (
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Recommended Text Color</p>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded border border-slate-200 shrink-0 shadow-sm"
              style={{ background: profile.textColor }} />
            <span className="font-mono font-semibold text-slate-700">{profile.textColor}</span>
          </div>
          {profile.textContrast && (
            <p className="text-slate-500 leading-relaxed">{profile.textContrast}</p>
          )}
          {profile.colorReason && (
            <p className="text-[9px] text-slate-400 leading-relaxed">{profile.colorReason}</p>
          )}
        </div>
      )}

      {/* Thumbnail Readability */}
      <div className="space-y-1">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Thumbnail Readability</p>
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${readabilityStyle}`}>
          <span>{readabilityIcon}</span>
          {profile.thumbnailReadability}
        </div>
        {profile.thumbnailReason && (
          <p className="text-[9px] text-slate-400 leading-relaxed mt-0.5">{profile.thumbnailReason}</p>
        )}
      </div>

      {/* Regenerate */}
      <button
        type="button"
        onClick={onRegenerate}
        className="w-full text-center text-[9px] font-semibold text-indigo-400 hover:text-indigo-600 py-1 transition"
      >
        ↻ Regenerate Profile
      </button>
    </div>
  );
}

// ─── Layout & Composition Engine ─────────────────────────────────────────────

function LayoutCard({ profile, generating, onRegenerate }) {
  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-5">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <span className="text-[10px] text-slate-400">Generating layout profile…</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Select a cover concept to automatically generate a layout profile.
        </p>
        <button
          type="button"
          onClick={onRegenerate}
          className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 transition"
        >
          Generate Now ↻
        </button>
      </div>
    );
  }

  const overlapColor = {
    None:   "bg-emerald-50 text-emerald-700 border-emerald-200",
    Low:    "bg-sky-50 text-sky-700 border-sky-200",
    Medium: "bg-amber-50 text-amber-700 border-amber-200",
    High:   "bg-red-50 text-red-700 border-red-200",
  }[profile.textOverlapRisk] || "bg-slate-50 text-slate-600 border-slate-200";

  const balanceDot = {
    "Balanced":       "◉",
    "Left Weighted":  "◧",
    "Right Weighted": "◨",
    "Top Weighted":   "⬒",
    "Bottom Weighted":"⬓",
  }[profile.visualBalance] || "◉";

  const focalIcon = {
    "Upper Third": "▲",
    "Center":      "●",
    "Lower Third": "▼",
  }[profile.focalArea] || "●";

  return (
    <div className="space-y-3 text-[10px]">

      {/* Layout Type */}
      <div className="space-y-1">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Layout Type</p>
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 font-bold text-indigo-800">
          {profile.layoutType}
        </div>
      </div>

      {/* Visual Balance + Focal Area side by side */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Balance</p>
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-100 px-2 py-1.5">
            <span className="text-slate-500">{balanceDot}</span>
            <span className="font-semibold text-slate-700 leading-tight">{profile.visualBalance}</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Focal Area</p>
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-100 px-2 py-1.5">
            <span className="text-slate-400 text-[8px]">{focalIcon}</span>
            <span className="font-semibold text-slate-700 leading-tight">{profile.focalArea}</span>
          </div>
        </div>
      </div>

      {/* Alignment + Safe Margin side by side */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Alignment</p>
          <div className="rounded-md bg-indigo-50 border border-indigo-100 px-2 py-1 text-center font-semibold text-indigo-700">
            {profile.alignment}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Safe Margin</p>
          <div className="rounded-md bg-slate-100 border border-slate-200 px-2 py-1 text-center font-semibold text-slate-600">
            {profile.safeMargin}
          </div>
        </div>
      </div>

      {/* Text Position */}
      {profile.textPosition && (
        <div className="space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Text Position</p>
          <p className="text-slate-700 leading-relaxed">{profile.textPosition}</p>
        </div>
      )}

      {/* Image Position */}
      {profile.imagePosition && (
        <div className="space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Image Position</p>
          <p className="text-slate-700 leading-relaxed">{profile.imagePosition}</p>
        </div>
      )}

      {/* White Space */}
      {profile.whiteSpace && (
        <div className="space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">White Space</p>
          <p className="text-slate-600 leading-relaxed">{profile.whiteSpace}</p>
        </div>
      )}

      {/* Text Overlap Check */}
      <div className="space-y-1">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Text Overlap Risk</p>
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-bold ${overlapColor}`}>
          <span>{ { None:"✓", Low:"~", Medium:"!", High:"⚠" }[profile.textOverlapRisk] }</span>
          {profile.textOverlapRisk}
        </div>
        {(profile.textOverlapRisk === "Medium" || profile.textOverlapRisk === "High") &&
          profile.repositionSuggestion && (
          <p className="text-[9px] text-amber-600 leading-relaxed mt-0.5">
            → {profile.repositionSuggestion}
          </p>
        )}
      </div>

      {/* Composition Notes */}
      {profile.compositionNotes && (
        <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2 space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Composition Notes</p>
          <p className="text-slate-700 leading-relaxed">{profile.compositionNotes}</p>
        </div>
      )}

      {/* Regenerate */}
      <button
        type="button"
        onClick={onRegenerate}
        className="w-full text-center text-[9px] font-semibold text-indigo-400 hover:text-indigo-600 py-1 transition"
      >
        ↻ Regenerate Layout
      </button>
    </div>
  );
}

// ─── Workflow Navigator ───────────────────────────────────────────────────────

function WorkflowNavigator() {
  return (
    <div className="flex-1 overflow-y-auto py-4 px-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 px-2 mb-3">
        Workflow
      </p>
      <div className="space-y-0.5">
        {WORKFLOW_STEPS.map((step) => {
          const isActive   = step.state === "active";
          const isComplete = step.state === "complete";
          const isLocked   = step.state === "locked";
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                isActive
                  ? "bg-indigo-600/15 border border-indigo-500/25"
                  : "hover:bg-gray-800/40"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                  isActive
                    ? "bg-indigo-500 text-white shadow-sm shadow-indigo-500/40"
                    : isComplete
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-800 text-gray-600 border border-gray-700"
                }`}
              >
                {isComplete ? "✓" : step.num}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-semibold truncate ${
                  isActive   ? "text-indigo-300"  :
                  isComplete ? "text-emerald-400" :
                               "text-gray-500"
                }`}>
                  {step.label}
                </p>
                {isLocked && (
                  <p className="text-[9px] text-gray-700 truncate leading-tight">
                    Available in upcoming implementation.
                  </p>
                )}
              </div>
              {isLocked && (
                <svg className="w-3 h-3 text-gray-700 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Project Status Card ──────────────────────────────────────────────────────

function ProjectStatusCard({ metadata, lastSaved, validationErrors }) {
  const hasErrors = Object.keys(validationErrors).length > 0;
  const filled    = [metadata.title, metadata.author, metadata.subtitle, metadata.primaryCategory, metadata.language, metadata.bookSize].filter(Boolean).length;
  const pct       = Math.round((filled / 6) * 100);
  const statusLabel = hasErrors ? "Draft" : pct === 100 ? "Ready" : "Draft";
  const statusColor = hasErrors
    ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
    : pct === 100
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
    : "bg-blue-500/15 text-blue-400 border-blue-500/25";

  return (
    <div className="shrink-0 border-t border-gray-800 px-3 py-4 space-y-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600">Project Status</p>
      <div className="rounded-xl bg-gray-800/50 border border-gray-700/40 px-3 py-3 space-y-2.5">
        <div>
          <p className="text-[8px] uppercase tracking-widest text-gray-600 mb-0.5">Project</p>
          <p className="text-[11px] font-semibold text-gray-200 truncate">
            {metadata.title || "Untitled Book"}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-gray-500">Last Saved</p>
          <p className="text-[9px] text-gray-400">
            {lastSaved
              ? lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Not yet saved"}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-gray-500">Current Step</p>
          <p className="text-[9px] text-indigo-400 font-medium">Book Information</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-gray-500">Completion</p>
            <p className="text-[9px] font-semibold text-gray-300">{pct}%</p>
          </div>
          <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

function WorkspaceHeader({ metadata, lastSaved }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
          <h2 className="text-sm font-bold text-gray-100 truncate">Book Cover Studio</h2>
        </div>
        {metadata.title && (
          <>
            <span className="text-gray-700 text-xs">·</span>
            <span className="text-xs text-gray-400 truncate max-w-[220px]">{metadata.title}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {lastSaved && (
          <span className="text-[10px] text-gray-600 hidden sm:block">
            Saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <button
          type="button"
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-[11px] font-semibold text-gray-300 hover:bg-gray-700 hover:text-white transition"
        >
          Preview
        </button>
        <button
          type="button"
          disabled
          className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5 text-[11px] font-semibold text-gray-700 cursor-not-allowed select-none"
        >
          Export
        </button>
      </div>
    </div>
  );
}

function CanvasToolbar({ zoom, onZoom, onFitToScreen, bookSizeLabel }) {
  function handleZoomIn() {
    if (zoom === "fit") { onZoom(1.0); return; }
    const idx = ZOOM_STEPS.indexOf(zoom);
    if (idx < ZOOM_STEPS.length - 1) onZoom(ZOOM_STEPS[idx + 1]);
  }
  function handleZoomOut() {
    if (zoom === "fit") { onZoom(0.75); return; }
    const idx = ZOOM_STEPS.indexOf(zoom);
    if (idx > 0) onZoom(ZOOM_STEPS[idx - 1]);
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/90 shrink-0 gap-4">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onFitToScreen}
          className={`rounded px-2.5 py-1 text-[10px] font-semibold transition ${
            zoom === "fit"
              ? "bg-indigo-600 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          }`}
        >
          Fit
        </button>
        {ZOOM_STEPS.map(z => (
          <button
            key={z}
            type="button"
            onClick={() => onZoom(z)}
            className={`rounded px-2.5 py-1 text-[10px] font-semibold transition ${
              zoom === z
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`}
          >
            {Math.round(z * 100)}%
          </button>
        ))}
        <div className="w-px h-4 bg-gray-700 mx-1.5" />
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom out"
          className="rounded px-2 py-1 text-[13px] font-bold text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition leading-none"
        >
          −
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom in"
          className="rounded px-2 py-1 text-[13px] font-bold text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition leading-none"
        >
          +
        </button>
        <button
          type="button"
          title="Fullscreen"
          className="rounded px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition leading-none"
          onClick={() => {
            const el = document.documentElement;
            if (!document.fullscreenElement) el.requestFullscreen?.();
            else document.exitFullscreen?.();
          }}
        >
          ⛶
        </button>
      </div>
      {bookSizeLabel && (
        <span className="text-[10px] text-gray-600 hidden sm:block">{bookSizeLabel}</span>
      )}
    </div>
  );
}

function CoverPreviewCanvas({ metadata, bookCover, zoom, canvasBg, bookSize }) {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 600, h: 500 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const aspectRatio = bookSize.w / bookSize.h;
  const padding = 48;

  const maxH = Math.max(200, containerSize.h - padding * 2);
  const maxW = Math.max(100, containerSize.w - padding * 2);
  const fitByH = { h: maxH, w: maxH * aspectRatio };
  const fitByW = { w: maxW, h: maxW / aspectRatio };
  const fitSize = fitByH.w <= maxW ? fitByH : fitByW;

  let coverW, coverH;
  if (zoom === "fit") {
    coverH = fitSize.h;
    coverW = fitSize.w;
  } else {
    const baseH = Math.min(fitSize.h, maxH);
    coverH = baseH * (zoom / 1.0);
    coverW = coverH * aspectRatio;
  }

  const rawConcept = Array.isArray(bookCover?.concepts) && bookCover.concepts.length > 0
    ? bookCover.concepts[bookCover.selectedConceptIndex ?? 0]
    : DEFAULT_CONCEPT;

  const cd = buildCoverData(rawConcept, {
    subtitle:   metadata.subtitle,
    authorLine: metadata.author,
    tagline:    "",
  }, metadata.title || "Your Book Title");

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center overflow-auto"
      style={{ background: canvasBg, minHeight: 0 }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          style={{
            width:     Math.round(coverW),
            height:    Math.round(coverH),
            position:  "relative",
            overflow:  "hidden",
            boxShadow: "0 24px 64px rgba(0,0,0,0.45), 0 6px 16px rgba(0,0,0,0.25)",
            borderRadius: 2,
          }}
        >
          <ConceptRenderer cd={cd} />
        </div>
        <div className="text-center mt-3 text-[9px] text-slate-400 font-medium tracking-wide select-none">
          {bookSize.label} · {zoom === "fit" ? "Fit" : `${Math.round((typeof zoom === "number" ? zoom : 1) * 100)}%`}
        </div>
      </div>
    </div>
  );
}

function FormField({ label, required, error, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-300">
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      {hint && <p className="text-[9px] text-gray-500">{hint}</p>}
      {children}
      {error && (
        <p className="text-[10px] text-red-400 font-medium">{error}</p>
      )}
    </div>
  );
}

function MetadataPanel({ metadata, onChange, errors }) {
  function field(key, e) {
    onChange(key, typeof e === "string" ? e : e.target.value);
  }

  const inputCls = (key) =>
    `w-full rounded-lg border px-2.5 py-1.5 text-[11px] text-gray-200 bg-gray-800 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition ${
      errors[key]
        ? "border-red-500/50 bg-red-900/10"
        : "border-gray-700 hover:border-gray-600"
    }`;

  const selectCls = (key) =>
    `w-full rounded-lg border px-2.5 py-1.5 text-[11px] text-gray-200 bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition appearance-none ${
      errors[key] ? "border-red-500/50" : "border-gray-700 hover:border-gray-600"
    }`;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 shrink-0">
        <h3 className="text-[10px] font-bold text-gray-100 uppercase tracking-wider">
          Book Metadata
        </h3>
        <p className="text-[9px] text-gray-500 mt-0.5 leading-relaxed">
          Drives the live preview and future AI generation.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">

        <FormField label="Book Title" required error={errors.title}
          hint="Appears on the front cover. Keep under 80 characters.">
          <input
            className={inputCls("title")}
            value={metadata.title}
            onChange={e => field("title", e)}
            placeholder="Your Book Title"
            maxLength={120}
          />
          {!errors.title && metadata.title && (
            <p className="text-[9px] text-gray-600">{metadata.title.length}/80 chars</p>
          )}
        </FormField>

        <FormField label="Subtitle"
          hint="The cover promise — appears below the title.">
          <input
            className={inputCls("subtitle")}
            value={metadata.subtitle}
            onChange={e => field("subtitle", e)}
            placeholder="A practical guide to…"
          />
        </FormField>

        <FormField label="Author Name" required error={errors.author}
          hint="As it will appear on the cover.">
          <input
            className={inputCls("author")}
            value={metadata.author}
            onChange={e => field("author", e)}
            placeholder="Your Name"
          />
        </FormField>

        <div className="border-t border-gray-800 pt-3.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-600 mb-3">
            Optional Details
          </p>
          <div className="space-y-3.5">
            <FormField label="Series Name">
              <input
                className={inputCls("series")}
                value={metadata.series}
                onChange={e => field("series", e)}
                placeholder="Series title (if applicable)"
              />
            </FormField>

            <FormField label="Edition">
              <input
                className={inputCls("edition")}
                value={metadata.edition}
                onChange={e => field("edition", e)}
                placeholder="e.g. 2nd Edition"
              />
            </FormField>

            <FormField label="Publisher">
              <input
                className={inputCls("publisher")}
                value={metadata.publisher}
                onChange={e => field("publisher", e)}
                placeholder="Publisher or imprint name"
              />
            </FormField>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-3.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-600 mb-3">
            Classification
          </p>
          <div className="space-y-3.5">
            <FormField label="Primary Category">
              <select
                className={selectCls("primaryCategory")}
                value={metadata.primaryCategory}
                onChange={e => field("primaryCategory", e)}
              >
                <option value="">Select category…</option>
                {NONFICTION_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Secondary Category">
              <select
                className={selectCls("secondaryCategory")}
                value={metadata.secondaryCategory}
                onChange={e => field("secondaryCategory", e)}
              >
                <option value="">Select category…</option>
                {NONFICTION_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Language">
              <select
                className={selectCls("language")}
                value={metadata.language}
                onChange={e => field("language", e)}
              >
                {LANGUAGES.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </FormField>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-3.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-600 mb-3">
            Print Specifications
          </p>
          <FormField label="Book Size" required error={errors.bookSize}
            hint="KDP trim size for print-on-demand.">
            <select
              className={selectCls("bookSize")}
              value={metadata.bookSize}
              onChange={e => field("bookSize", e)}
            >
              {BOOK_SIZES.map(s => (
                <option key={s.label} value={s.label}>{s.label}</option>
              ))}
            </select>
          </FormField>
        </div>

      </div>
    </div>
  );
}

// ─── Filmstrip Bar ────────────────────────────────────────────────────────────

function FilmstripBar() {
  return (
    <div
      className="shrink-0 border-t border-gray-800 bg-gray-950/80 px-4 py-3 flex items-center gap-3 overflow-x-auto"
      style={{ height: 84 }}
    >
      <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-800/40 px-6 h-full min-w-[140px]">
        <p className="text-[9px] text-gray-600 text-center leading-snug select-none">
          Cover Concepts<br />will appear here.
        </p>
      </div>
    </div>
  );
}

// ─── Right Panel (tabbed) ─────────────────────────────────────────────────────

const RIGHT_TABS = [
  { id: "design",     label: "Design"     },
  { id: "typography", label: "Typography" },
  { id: "layout",     label: "Layout"     },
  { id: "effects",    label: "Effects"    },
];

function RightPanel({ metadata, onChange, errors }) {
  const [activeTab, setActiveTab] = useState("design");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-gray-800">
        {RIGHT_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-[10px] font-semibold tracking-wide transition-colors ${
              activeTab === tab.id
                ? "text-indigo-400 border-b-2 border-indigo-500"
                : "text-gray-600 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "design" ? (
          <MetadataPanel metadata={metadata} onChange={onChange} errors={errors} />
        ) : (
          <div className="flex items-start justify-center pt-10 px-4">
            <p className="text-[11px] text-gray-600 text-center italic">
              Coming in upcoming implementation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookCoverStep({ bookCover, setBookCover, fullProject, errors: stepErrors }) {
  const initRef = useRef(false);

  const [metadata, setMetadataState] = useState(() => initMetadata(bookCover, fullProject));
  const [canvas, setCanvasState] = useState(() => initCanvas(bookCover));
  const [validationErrors, setValidationErrors] = useState({});
  const [lastSaved, setLastSaved] = useState(null);

  // Cover concepts generation state
  const [concepts, setConceptsState] = useState(() =>
    Array.isArray(bookCover?.concepts) ? bookCover.concepts : []
  );
  const [selectedConceptIdx, setSelectedConceptIdx] = useState(() =>
    typeof bookCover?.selectedConceptIndex === "number" ? bookCover.selectedConceptIndex : null
  );
  const [generatingAll, setGeneratingAll] = useState(false);
  const [regeneratingIdx, setRegeneratingIdx] = useState(null);

  // Typography Intelligence Engine state
  const [typographyProfile, setTypographyProfile] = useState(() =>
    bookCover?.typographyProfile || bookCover?.coverStudio?.typography || null
  );
  const [typographyGenerating, setTypographyGenerating] = useState(false);
  const typoDebounceRef = useRef(null);
  const typoKeyRef = useRef("");

  // Layout & Composition Engine state
  const [layoutProfile, setLayoutProfile] = useState(() =>
    bookCover?.layoutProfile || bookCover?.coverStudio?.layout || null
  );
  const [layoutGenerating, setLayoutGenerating] = useState(false);
  const layoutDebounceRef = useRef(null);
  const layoutKeyRef = useRef("");

  const strategy = useMemo(
    () => deriveCoverStrategy(fullProject, metadata),
    [fullProject, metadata] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const visualDirection = useMemo(
    () => deriveVisualDirection(strategy, metadata, fullProject),
    [strategy, metadata, fullProject] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const coverPrompt = useMemo(
    () => buildCoverPrompt(strategy, visualDirection, metadata, fullProject),
    [strategy, visualDirection, metadata, fullProject] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const bookSize = useMemo(
    () => BOOK_SIZES.find(s => s.label === metadata.bookSize) || BOOK_SIZES[4],
    [metadata.bookSize]
  );

  function setMetadata(key, value) {
    setMetadataState(prev => ({ ...prev, [key]: value }));
  }

  function setCanvas(key, value) {
    setCanvasState(prev => ({ ...prev, [key]: value }));
  }

  function handleZoom(value) {
    setCanvas("zoomLevel", value);
  }

  function handleFitToScreen() {
    setCanvas("zoomLevel", "fit");
  }

  async function handleGenerateConcepts() {
    if (!coverPrompt || generatingAll) return;
    setGeneratingAll(true);
    try {
      const res = await fetch("/api/book/generate-cover-concepts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          finalPrompt:    coverPrompt.finalPrompt,
          negativePrompt: coverPrompt.negativePrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Generation failed");
      if (Array.isArray(data.concepts)) setConceptsState(data.concepts);
    } catch (err) {
      console.error("[CoverConcepts] generation error:", err);
      setConceptsState(prev => prev.length > 0 ? prev : []);
    } finally {
      setGeneratingAll(false);
    }
  }

  async function handleRegenerateConcept(idx) {
    if (!coverPrompt || regeneratingIdx !== null || generatingAll) return;
    setRegeneratingIdx(idx);
    try {
      const res = await fetch("/api/book/generate-cover-concepts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          finalPrompt:    coverPrompt.finalPrompt,
          negativePrompt: coverPrompt.negativePrompt,
          conceptIndex:   idx,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Regeneration failed");
      if (data.concept) {
        setConceptsState(prev => {
          const next = [...prev];
          next[idx]  = data.concept;
          return next;
        });
      }
    } catch (err) {
      console.error("[CoverConcepts] regen error:", err);
      setConceptsState(prev => {
        const next = [...prev];
        if (next[idx]) next[idx] = { ...next[idx], error: err.message };
        return next;
      });
    } finally {
      setRegeneratingIdx(null);
    }
  }

  // ── Layout & Composition Engine ───────────────────────────────────────────
  async function generateLayout(force = false) {
    if (layoutGenerating) return;

    const concept = Array.isArray(concepts) && concepts.length > 0 && selectedConceptIdx !== null
      ? concepts[selectedConceptIdx]
      : DEFAULT_CONCEPT;
    const conceptType  = concept?.type  || "authority";
    const conceptLabel = concept?.label || conceptType;
    const key = `${metadata.title}|${metadata.subtitle}|${conceptType}|${metadata.bookSize}|${typographyProfile?.titleAlignment || ""}`;

    if (!force && key === layoutKeyRef.current && layoutProfile?.generatedForKey === key) return;
    if (!metadata.title?.trim()) return;

    layoutKeyRef.current = key;
    setLayoutGenerating(true);
    try {
      const res = await fetch("/api/ai/layout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:               metadata.title,
          subtitle:            metadata.subtitle || "",
          author:              metadata.author   || "",
          series:              metadata.series   || "",
          conceptType,
          conceptLabel,
          bg:                  concept?.bg     || DEFAULT_CONCEPT.bg,
          accent:              concept?.accent || DEFAULT_CONCEPT.accent,
          typographyAlignment: typographyProfile?.titleAlignment || "",
          typographyPosition:  typographyProfile?.textPosition   || "",
          strategy:            strategy?.coverPurpose  || "",
          visualDirection:     visualDirection?.imageStyle || "",
          bookSize:            metadata.bookSize || '6" × 9"',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Layout generation failed");
      const profile = { ...data, generatedForKey: key };
      setLayoutProfile(profile);
    } catch (err) {
      console.error("[Layout] generation error:", err);
    } finally {
      setLayoutGenerating(false);
    }
  }

  // Auto-generate layout when concept, typography, metadata, or canvas size changes
  useEffect(() => {
    const concept = Array.isArray(concepts) && concepts.length > 0 && selectedConceptIdx !== null
      ? concepts[selectedConceptIdx]
      : null;
    const conceptType = concept?.type || "";
    const key = `${metadata.title}|${metadata.subtitle}|${conceptType}|${metadata.bookSize}|${typographyProfile?.titleAlignment || ""}`;

    if (!metadata.title?.trim()) return;
    if (key === layoutKeyRef.current && layoutProfile?.generatedForKey === key) return;

    if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
    layoutDebounceRef.current = setTimeout(() => {
      generateLayout(false);
    }, 1800);
    return () => { if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current); };
  }, [metadata.title, metadata.subtitle, metadata.bookSize, selectedConceptIdx, typographyProfile?.titleAlignment]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Typography Intelligence Engine ────────────────────────────────────────
  async function generateTypography(force = false) {
    if (typographyGenerating) return;

    const concept = Array.isArray(concepts) && concepts.length > 0 && selectedConceptIdx !== null
      ? concepts[selectedConceptIdx]
      : DEFAULT_CONCEPT;
    const conceptType  = concept?.type  || "authority";
    const conceptLabel = concept?.label || conceptType;
    const key = `${metadata.title}|${metadata.subtitle}|${conceptType}`;

    // Skip if nothing changed (unless forced)
    if (!force && key === typoKeyRef.current && typographyProfile?.generatedForKey === key) return;
    if (!metadata.title?.trim()) return;

    typoKeyRef.current = key;
    setTypographyGenerating(true);
    try {
      const res = await fetch("/api/ai/typography", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:          metadata.title,
          subtitle:       metadata.subtitle || "",
          author:         metadata.author   || "",
          series:         metadata.series   || "",
          conceptType,
          conceptLabel,
          bg:             concept?.bg     || DEFAULT_CONCEPT.bg,
          accent:         concept?.accent || DEFAULT_CONCEPT.accent,
          strategy:       strategy?.coverPurpose || "",
          visualDirection: visualDirection?.imageStyle || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Typography generation failed");
      const profile = { ...data, generatedForKey: key };
      setTypographyProfile(profile);
    } catch (err) {
      console.error("[Typography] generation error:", err);
    } finally {
      setTypographyGenerating(false);
    }
  }

  // Auto-generate typography when title, subtitle, or selected concept changes
  useEffect(() => {
    const concept = Array.isArray(concepts) && concepts.length > 0 && selectedConceptIdx !== null
      ? concepts[selectedConceptIdx]
      : null;
    const conceptType = concept?.type || "";
    const key = `${metadata.title}|${metadata.subtitle}|${conceptType}`;

    if (!metadata.title?.trim()) return;
    if (key === typoKeyRef.current && typographyProfile?.generatedForKey === key) return;

    if (typoDebounceRef.current) clearTimeout(typoDebounceRef.current);
    typoDebounceRef.current = setTimeout(() => {
      generateTypography(false);
    }, 1200);
    return () => { if (typoDebounceRef.current) clearTimeout(typoDebounceRef.current); };
  }, [metadata.title, metadata.subtitle, selectedConceptIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Validate on every metadata change
  useEffect(() => {
    setValidationErrors(validateMetadata(metadata));
  }, [metadata]);

  // Auto-save: debounced 600ms after any metadata/canvas/strategy change
  useEffect(() => {
    if (!initRef.current) return;
    const timer = setTimeout(() => {
      const project = createCoverProject(bookCover, fullProject, metadata);
      setBookCover(prev => {
        const p = (prev && typeof prev === "object") ? prev : {};
        return {
          ...p,
          // Backward-compatible fields (DashboardPage reads these)
          subtitle:        metadata.subtitle,
          authorLine:      metadata.author,
          coverStrategy:   { ...strategy },
          visualDirection: visualDirection ? { ...visualDirection } : null,
          aiPrompt:             coverPrompt ? { ...coverPrompt } : null,
          concepts:             concepts.length > 0 ? concepts : [],
          selectedConceptIndex: selectedConceptIdx,
          typographyProfile:    typographyProfile || null,
          layoutProfile:        layoutProfile     || null,
          // Extended cover studio state
          coverStudio: {
            ...project,
            metadata:   { ...metadata },
            canvas:     { ...canvas },
            typography: typographyProfile || null,
            layout:     layoutProfile     || null,
          },
        };
      });
      setLastSaved(new Date());
    }, 600);
    return () => clearTimeout(timer);
  }, [metadata, canvas, strategy, visualDirection, coverPrompt, concepts, selectedConceptIdx, typographyProfile, layoutProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed from project on first mount only
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const m = initMetadata(bookCover, fullProject);
    setMetadataState(m);
    setCanvasState(initCanvas(bookCover));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ minHeight: "calc(100vh - 12rem)", minWidth: 0, background: "#0d1117" }}
    >
      {/* ── Header ── */}
      <WorkspaceHeader
        metadata={metadata}
        lastSaved={lastSaved}
      />

      {/* ── Three-panel layout ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT PANEL (~300px) — Workflow Navigator + Project Status ── */}
        <div
          className="shrink-0 border-r border-gray-800 flex flex-col overflow-hidden"
          style={{ width: 300, background: "#111827" }}
        >
          <WorkflowNavigator />
          <ProjectStatusCard
            metadata={metadata}
            lastSaved={lastSaved}
            validationErrors={validationErrors}
          />
        </div>

        {/* ── CENTER WORKSPACE — Toolbar + Canvas + Filmstrip ── */}
        <div
          className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden"
          style={{ background: "#1a1f2e" }}
        >
          <CanvasToolbar
            zoom={canvas.zoomLevel}
            onZoom={handleZoom}
            onFitToScreen={handleFitToScreen}
            bookSizeLabel={bookSize.label}
          />

          {/* Canvas occupies ~70% of remaining height via flex */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <CoverPreviewCanvas
              metadata={metadata}
              bookCover={bookCover}
              zoom={canvas.zoomLevel}
              canvasBg={canvas.background}
              bookSize={bookSize}
            />
          </div>

          <FilmstripBar />
        </div>

        {/* ── RIGHT PANEL (~360px) — Tabbed Design Properties ── */}
        <div
          className="shrink-0 border-l border-gray-800 flex flex-col overflow-hidden"
          style={{ width: 360, background: "#111827" }}
        >
          <RightPanel
            metadata={metadata}
            onChange={setMetadata}
            errors={validationErrors}
          />
        </div>

      </div>

      {/* ── Step errors from parent ── */}
      {stepErrors?.form && (
        <div className="px-5 py-3 border-t border-red-900/40 bg-red-950/60 shrink-0">
          <p className="text-xs text-red-400 font-medium">⚠ {stepErrors.form}</p>
        </div>
      )}
    </div>
  );
}
