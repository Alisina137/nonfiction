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

const LEFT_SECTIONS = [
  { id: "bookInfo",       label: "Book Information",  icon: "📖", functional: true  },
  { id: "coverStrategy",  label: "Cover Strategy",    icon: "🎯", functional: true  },
  { id: "visualDir",      label: "Visual Direction",  icon: "🎨", functional: false },
  { id: "typography",     label: "Typography",        icon: "Tt", functional: false },
  { id: "layouts",        label: "Layouts",           icon: "⊡",  functional: false },
  { id: "assets",         label: "Assets",            icon: "🖼", functional: false },
  { id: "versions",       label: "Versions",          icon: "⎇",  functional: false },
  { id: "export",         label: "Export",            icon: "⬇",  functional: false },
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

// ─── Studio Sub-Components ────────────────────────────────────────────────────

function SidebarSection({ label, icon, expanded, onToggle, children, functional }) {
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={functional ? onToggle : undefined}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
          functional ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"
        }`}
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 select-none">
          <span className="text-[13px] leading-none">{icon}</span>
          {label}
        </span>
        {functional ? (
          <span className="text-slate-400 text-xs">{expanded ? "▲" : "▼"}</span>
        ) : (
          <span className="text-[9px] font-semibold rounded bg-slate-100 text-slate-400 px-1.5 py-0.5 uppercase tracking-wide">
            Soon
          </span>
        )}
      </button>
      {functional && expanded && (
        <div className="px-4 pb-4">{children}</div>
      )}
      {!functional && expanded && (
        <div className="px-4 pb-3">
          <p className="text-[11px] text-slate-400 italic">
            Coming in upcoming implementation.
          </p>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, source }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      {value ? (
        <div className="text-[11px] text-slate-800 leading-snug font-medium">{value}</div>
      ) : (
        <div className="text-[11px] text-slate-300 italic">Not set</div>
      )}
      {source && value && (
        <div className="text-[9px] text-slate-300">from {source}</div>
      )}
    </div>
  );
}

function BookInformationCard({ fullProject, metadata }) {
  const genre = resolveGenre(fullProject) || "";

  return (
    <div className="space-y-3">
      <InfoRow label="Title"    value={metadata.title}    source="Book Title step"  />
      <InfoRow label="Author"   value={metadata.author}   source="Author Bio step"  />
      <InfoRow label="Subtitle" value={metadata.subtitle}                            />
      <InfoRow label="Audience" value={metadata.audience} source="Book Details step" />
      <InfoRow label="Genre"    value={genre}             source="Research step"    />
      <InfoRow label="Category" value={metadata.primaryCategory}                    />
      <InfoRow label="Language" value={metadata.language}                           />
      <InfoRow label="Size"     value={metadata.bookSize}                           />
      <p className="text-[9px] text-slate-300 pt-1 leading-relaxed">
        Edit these values in the Metadata panel on the right. Changes auto-save and update the cover preview instantly.
      </p>
    </div>
  );
}

function ProjectStatusBadge({ validationErrors, lastSaved }) {
  const hasErrors = Object.keys(validationErrors).length > 0;
  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
        hasErrors
          ? "bg-amber-50 text-amber-700 border border-amber-200"
          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
      }`}>
        <span>{hasErrors ? "●" : "✓"}</span>
        <span>{hasErrors ? "Incomplete" : "Ready"}</span>
      </div>
      {lastSaved && (
        <span className="text-[10px] text-slate-400">
          Saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}

function WorkspaceHeader({ metadata, validationErrors, lastSaved }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
          <h2 className="text-sm font-bold text-slate-900 truncate">
            Book Cover Studio
          </h2>
        </div>
        {metadata.title && (
          <>
            <span className="text-slate-300 text-xs">·</span>
            <span className="text-xs text-slate-500 truncate max-w-[200px]">{metadata.title}</span>
          </>
        )}
      </div>
      <ProjectStatusBadge validationErrors={validationErrors} lastSaved={lastSaved} />
    </div>
  );
}

function CanvasToolbar({ zoom, onZoom, onFitToScreen, canvasBg, onCanvasBg, bookSizeLabel }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white shrink-0 gap-4">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onFitToScreen}
          className={`rounded px-2.5 py-1 text-[10px] font-semibold transition ${
            zoom === "fit"
              ? "bg-slate-900 text-white"
              : "text-slate-500 hover:bg-slate-100"
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
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {Math.round(z * 100)}%
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {bookSizeLabel && (
          <span className="text-[10px] text-slate-400 hidden sm:block">{bookSizeLabel}</span>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400">Canvas</span>
          <input
            type="color"
            value={canvasBg}
            onChange={e => onCanvasBg(e.target.value)}
            className="h-5 w-6 cursor-pointer rounded border border-slate-200 p-0"
            title="Workspace background color"
          />
        </div>
      </div>
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
      <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      {hint && <p className="text-[9px] text-slate-400">{hint}</p>}
      {children}
      {error && (
        <p className="text-[10px] text-red-500 font-medium">{error}</p>
      )}
    </div>
  );
}

function MetadataPanel({ metadata, onChange, errors }) {
  function field(key, e) {
    onChange(key, typeof e === "string" ? e : e.target.value);
  }

  const inputCls = (key) =>
    `w-full rounded-lg border px-2.5 py-1.5 text-[11px] text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition ${
      errors[key]
        ? "border-red-300 bg-red-50"
        : "border-slate-200 bg-white hover:border-slate-300"
    }`;

  const selectCls = (key) =>
    `w-full rounded-lg border px-2.5 py-1.5 text-[11px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition appearance-none ${
      errors[key] ? "border-red-300" : "border-slate-200 hover:border-slate-300"
    }`;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">
          Book Metadata
        </h3>
        <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed">
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
            <p className="text-[9px] text-slate-300">{metadata.title.length}/80 chars</p>
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

        <div className="border-t border-slate-100 pt-3.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
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

        <div className="border-t border-slate-100 pt-3.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Classification
          </p>
          <div className="space-y-3.5">
            <FormField label="Primary Category">
              <div className="relative">
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
              </div>
            </FormField>

            <FormField label="Secondary Category">
              <div className="relative">
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
              </div>
            </FormField>

            <FormField label="Target Audience">
              <input
                className={inputCls("audience")}
                value={metadata.audience}
                onChange={e => field("audience", e)}
                placeholder="Who is this book for?"
              />
            </FormField>

            <FormField label="Language">
              <div className="relative">
                <select
                  className={selectCls("language")}
                  value={metadata.language}
                  onChange={e => field("language", e)}
                >
                  {LANGUAGES.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </FormField>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Print Specifications
          </p>
          <FormField label="Book Size" required error={errors.bookSize}
            hint="KDP trim size for print-on-demand.">
            <div className="relative">
              <select
                className={selectCls("bookSize")}
                value={metadata.bookSize}
                onChange={e => field("bookSize", e)}
              >
                {BOOK_SIZES.map(s => (
                  <option key={s.label} value={s.label}>{s.label}</option>
                ))}
              </select>
            </div>
          </FormField>
        </div>

      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookCoverStep({ bookCover, setBookCover, fullProject, errors: stepErrors }) {
  const initRef = useRef(false);

  const [metadata, setMetadataState] = useState(() => initMetadata(bookCover, fullProject));
  const [canvas, setCanvasState] = useState(() => initCanvas(bookCover));
  const [openSections, setOpenSections] = useState({ bookInfo: true, coverStrategy: true });
  const [validationErrors, setValidationErrors] = useState({});
  const [lastSaved, setLastSaved] = useState(null);

  const strategy = useMemo(
    () => deriveCoverStrategy(fullProject, metadata),
    [fullProject, metadata] // eslint-disable-line react-hooks/exhaustive-deps
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

  function toggleSection(id) {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  }

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
          subtitle:      metadata.subtitle,
          authorLine:    metadata.author,
          coverStrategy: { ...strategy },
          // Extended cover studio state
          coverStudio: {
            ...project,
            metadata: { ...metadata },
            canvas:   { ...canvas },
          },
        };
      });
      setLastSaved(new Date());
    }, 600);
    return () => clearTimeout(timer);
  }, [metadata, canvas, strategy]); // eslint-disable-line react-hooks/exhaustive-deps

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
      className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      style={{ minHeight: "calc(100vh - 12rem)", minWidth: 0 }}
    >
      {/* ── Header ── */}
      <WorkspaceHeader
        metadata={metadata}
        validationErrors={validationErrors}
        lastSaved={lastSaved}
      />

      {/* ── Three-panel layout ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT SIDEBAR ── */}
        <div className="w-52 shrink-0 border-r border-slate-100 bg-slate-50 overflow-y-auto flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 shrink-0">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Cover Controls
            </p>
          </div>

          {LEFT_SECTIONS.map(section => (
            <SidebarSection
              key={section.id}
              label={section.label}
              icon={section.icon}
              expanded={!!openSections[section.id]}
              onToggle={() => toggleSection(section.id)}
              functional={section.functional}
            >
              {section.id === "bookInfo" && (
                <BookInformationCard fullProject={fullProject} metadata={metadata} />
              )}
              {section.id === "coverStrategy" && (
                <CoverStrategyCard strategy={strategy} />
              )}
            </SidebarSection>
          ))}
        </div>

        {/* ── CENTER WORKSPACE ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-slate-100 overflow-hidden">
          <CanvasToolbar
            zoom={canvas.zoomLevel}
            onZoom={handleZoom}
            onFitToScreen={handleFitToScreen}
            canvasBg={canvas.background}
            onCanvasBg={v => setCanvas("background", v)}
            bookSizeLabel={bookSize.label}
          />

          <CoverPreviewCanvas
            metadata={metadata}
            bookCover={bookCover}
            zoom={canvas.zoomLevel}
            canvasBg={canvas.background}
            bookSize={bookSize}
          />
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="w-64 shrink-0 border-l border-slate-100 bg-white overflow-hidden flex flex-col">
          <MetadataPanel
            metadata={metadata}
            onChange={setMetadata}
            errors={validationErrors}
          />
        </div>

      </div>

      {/* ── Validation summary (from DashboardPage step errors) ── */}
      {stepErrors?.form && (
        <div className="px-5 py-3 border-t border-red-100 bg-red-50 shrink-0">
          <p className="text-xs text-red-600 font-medium">⚠ {stepErrors.form}</p>
        </div>
      )}
    </div>
  );
}
