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

const CANVAS_BACKGROUNDS = [
  { id: "dark",         label: "Dark Workspace",           shortLabel: "Dark"  },
  { id: "light",        label: "Light Workspace",          shortLabel: "Light" },
  { id: "checkerboard", label: "Transparent Checkerboard", shortLabel: "⊞"     },
];

const DEFAULT_CONCEPT = {
  type: "authority",
  bg: "#0f1923",
  accent: "#d4961a",
  text: "#ffffff",
  secondary: "#1a2c3d",
};

const WORKFLOW_STEPS = [
  { id: "bookInfo",    num: 1,  label: "Book Information",    state: "unlocked" },
  { id: "market",      num: 2,  label: "Market Analysis",     state: "unlocked" },
  { id: "strategy",    num: 3,  label: "Cover Strategy",      state: "unlocked" },
  { id: "visual",      num: 4,  label: "Visual Direction",    state: "locked" },
  { id: "mood",        num: 5,  label: "Mood Board",          state: "unlocked" },
  { id: "color",       num: 6,  label: "Color Palette",       state: "unlocked" },
  { id: "elements",    num: 7,  label: "Design Elements",     state: "unlocked" },
  { id: "typography",  num: 8,  label: "Typography",          state: "locked" },
  { id: "layout",      num: 9,  label: "Layout & Composition",state: "locked" },
  { id: "concepts",    num: 10, label: "Generate Concepts",   state: "unlocked" },
  { id: "review",      num: 11, label: "Review",               state: "unlocked" },
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
  // Normalize: accept stored ID or fall back to "dark" (legacy hex values → dark)
  const rawBg = cs?.background;
  const bg = CANVAS_BACKGROUNDS.some(b => b.id === rawBg) ? rawBg : "dark";
  return {
    background:   bg,
    zoomLevel:    cs?.zoomLevel    ?? "fit",
    safeMargin:   cs?.safeMargin   ?? 0.125,
    bleedMargin:  cs?.bleedMargin  ?? 0.125,
  };
}

// Returns a CSS style object for the canvas wrapper background
function resolveCanvasBgStyle(bgId) {
  if (bgId === "checkerboard") {
    return {
      backgroundImage: [
        "linear-gradient(45deg, #b0b0b0 25%, transparent 25%)",
        "linear-gradient(-45deg, #b0b0b0 25%, transparent 25%)",
        "linear-gradient(45deg, transparent 75%, #b0b0b0 75%)",
        "linear-gradient(-45deg, transparent 75%, #b0b0b0 75%)",
      ].join(", "),
      backgroundSize:     "20px 20px",
      backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
      backgroundColor:    "#f8f8f8",
    };
  }
  if (bgId === "light") return { background: "#e5e7eb" };
  return { background: "#111827" }; // "dark" (default)
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

function WorkflowNavigator({ currentStep, onStepChange }) {
  return (
    <div className="flex-1 overflow-y-auto py-4 px-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 px-2 mb-3">
        Workflow
      </p>
      <div className="space-y-0.5">
        {WORKFLOW_STEPS.map((step) => {
          const isActive   = step.id === currentStep;
          const isComplete = step.state === "complete";
          const isLocked   = step.state === "locked";
          const isUnlocked = step.state === "unlocked";
          const isClickable = isUnlocked || isComplete;
          return (
            <button
              key={step.id}
              type="button"
              disabled={!isClickable}
              onClick={isClickable ? () => onStepChange(step.id) : undefined}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors text-left ${
                isActive
                  ? "bg-indigo-600/15 border border-indigo-500/25"
                  : isClickable
                  ? "hover:bg-gray-800/40 cursor-pointer"
                  : "cursor-default"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                  isActive
                    ? "bg-indigo-500 text-white shadow-sm shadow-indigo-500/40"
                    : isComplete
                    ? "bg-emerald-500 text-white"
                    : isUnlocked
                    ? "bg-gray-700 text-gray-400 border border-gray-600"
                    : "bg-gray-800 text-gray-600 border border-gray-700"
                }`}
              >
                {isComplete ? "✓" : step.num}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-semibold truncate ${
                  isActive   ? "text-indigo-300"  :
                  isComplete ? "text-emerald-400" :
                  isUnlocked ? "text-gray-400"    :
                               "text-gray-600"
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
            </button>
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

function WorkspaceHeader({ metadata, lastSaved, saveStatus }) {
  const statusMap = {
    saved:   { dot: "bg-emerald-500", text: "text-emerald-500", label: lastSaved ? `Saved ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Saved" },
    saving:  { dot: "bg-amber-400 animate-pulse", text: "text-amber-400", label: "Saving…" },
    unsaved: { dot: "bg-amber-400", text: "text-amber-400", label: "Unsaved changes" },
  };
  const st = statusMap[saveStatus] || statusMap.saved;

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
        {/* Auto-save status indicator */}
        <div className="hidden sm:flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />
          <span className={`text-[10px] font-medium ${st.text}`}>{st.label}</span>
        </div>
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

function CanvasToolbar({ zoom, onZoom, onFitToScreen, bookSizeLabel, canvasBg, onBgChange }) {
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
      {/* Left: zoom controls */}
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

      {/* Right: canvas background + book size label */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Background switcher */}
        <div className="flex items-center gap-0.5 rounded-lg bg-gray-800/60 border border-gray-700/50 p-0.5">
          {CANVAS_BACKGROUNDS.map(bg => (
            <button
              key={bg.id}
              type="button"
              onClick={() => onBgChange(bg.id)}
              title={bg.label}
              className={`rounded px-2.5 py-1 text-[10px] font-semibold transition ${
                canvasBg === bg.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-200"
              }`}
            >
              {bg.shortLabel}
            </button>
          ))}
        </div>
        {bookSizeLabel && (
          <span className="text-[10px] text-gray-600 hidden sm:block">{bookSizeLabel}</span>
        )}
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
      style={{ ...resolveCanvasBgStyle(canvasBg), minHeight: 0 }}
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

// ─── Design Elements Panel ────────────────────────────────────────────────────

const COMPLEXITY_STYLE = {
  Minimal:  { bar: "w-1/3",  color: "bg-sky-500",     text: "text-sky-400"     },
  Balanced: { bar: "w-2/3",  color: "bg-indigo-500",  text: "text-indigo-400"  },
  Detailed: { bar: "w-full", color: "bg-violet-500",  text: "text-violet-400"  },
};

const FOCAL_ICON = { Title: "T", "Main Object": "◉", Illustration: "🖼", Symbol: "◆", Icon: "⬡" };

function DesignElementsPanel({ designElements: de, generating, onRegenerate, onRemoveSupportingElement }) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Step 7</p>
        </div>
        <h2 className="text-lg font-bold text-gray-100">Design Elements</h2>
        <p className="text-[12px] text-gray-500 leading-relaxed">
          Visual elements that will guide AI cover generation — auto-updated as you refine strategy and palette.
        </p>
      </div>

      {/* Loading */}
      {generating && !de ? (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-10 flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />
            ))}
          </div>
          <p className="text-[11px] text-cyan-400 font-medium">Analysing design elements…</p>
        </div>
      ) : !de ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/20 p-10 flex flex-col items-center gap-3 text-center">
          <p className="text-[12px] text-gray-500">Set a book title to generate design elements.</p>
          <button type="button" onClick={onRegenerate}
            className="rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-[11px] font-semibold px-4 py-2 transition">
            Generate Elements
          </button>
        </div>
      ) : (
        <>
          {/* 1 — Main Subject (highlighted) */}
          <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-900/40 via-cyan-900/20 to-cyan-800/10 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">🎯</span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Main Subject</p>
            </div>
            <p className="text-[17px] font-bold text-white leading-tight">{de.mainSubject}</p>
            <p className="text-[11px] text-cyan-300/70 leading-snug italic">{de.mainSubjectReason}</p>
          </div>

          {/* 2 — Supporting Elements */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">✦</span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Supporting Elements</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(de.supportingElements || []).map((el, i) => (
                <span key={i}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-700/60 border border-gray-600 text-gray-300 text-[11px] font-semibold px-3 py-1">
                  {el}
                  <button type="button" onClick={() => onRemoveSupportingElement(i)}
                    className="text-gray-500 hover:text-gray-200 leading-none transition text-[10px]">×</button>
                </span>
              ))}
            </div>
          </div>

          {/* 3+4 — Background Style + Image Style row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">🖼</span>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Background</p>
              </div>
              <p className="text-[13px] font-bold text-gray-200">{de.backgroundStyle}</p>
            </div>
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">🎨</span>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Image Style</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold px-3 py-1">
                {de.imageStyle}
              </span>
            </div>
          </div>

          {/* 5 — Visual Complexity */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">⚖</span>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Visual Complexity</p>
              </div>
              <span className={`text-[11px] font-bold ${(COMPLEXITY_STYLE[de.visualComplexity] || COMPLEXITY_STYLE.Balanced).text}`}>
                {de.visualComplexity}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
              <div className={`h-full rounded-full ${(COMPLEXITY_STYLE[de.visualComplexity] || COMPLEXITY_STYLE.Balanced).color} ${(COMPLEXITY_STYLE[de.visualComplexity] || COMPLEXITY_STYLE.Balanced).bar}`} />
            </div>
            <div className="flex justify-between text-[9px] text-gray-700 font-semibold uppercase tracking-wide">
              <span>Minimal</span><span>Balanced</span><span>Detailed</span>
            </div>
          </div>

          {/* 6 — Focal Point */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">👁</span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Focal Point</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-700 border border-gray-600 flex items-center justify-center text-lg shrink-0">
                {FOCAL_ICON[de.focalPoint] ?? "◉"}
              </div>
              <p className="text-[14px] font-bold text-gray-200">{de.focalPoint}</p>
            </div>
          </div>

          {/* 7 — Avoid Elements */}
          <div className="rounded-xl border border-red-900/30 bg-red-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">🚫</span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-400/70">Avoid</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(de.avoidElements || []).map((el, i) => (
                <span key={i} className="rounded-full bg-red-950/40 border border-red-800/40 text-red-400/80 text-[10px] font-semibold px-3 py-1">
                  {el}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Regenerate */}
      <div className="pt-1">
        <button type="button" onClick={onRegenerate} disabled={generating}
          className="w-full rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-200 text-[11px] font-semibold py-2.5 transition disabled:opacity-40 disabled:cursor-not-allowed">
          {generating ? "Analysing…" : "↻ Regenerate Design Elements"}
        </button>
      </div>
    </div>
  );
}

// ─── Color Palette Panel ──────────────────────────────────────────────────────

const READABILITY_STYLE = {
  Excellent: { bar: "bg-emerald-500", text: "text-emerald-400", label: "Excellent" },
  Good:      { bar: "bg-sky-500",     text: "text-sky-400",     label: "Good"      },
  Fair:      { bar: "bg-amber-500",   text: "text-amber-400",   label: "Fair"      },
};

function ColorSwatch({ color, role, size = "md" }) {
  const sz = size === "lg" ? "h-10 flex-1" : "h-8 w-8 shrink-0";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${sz} rounded-lg border border-black/20 shadow-sm`}
        style={{ background: color }}
        title={`${role}: ${color}`}
      />
      <p className="text-[8px] text-gray-600 font-mono uppercase leading-none">{color}</p>
    </div>
  );
}

function ColorPaletteCard({ palette, index, isSelected, isRegenerating, onSelect, onRegenerate }) {
  const rd = READABILITY_STYLE[palette.readability] || READABILITY_STYLE.Good;

  return (
    <div
      className={`relative rounded-xl border overflow-hidden flex flex-col transition-all duration-200 cursor-pointer group ${
        isSelected
          ? "border-indigo-500 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500/40"
          : "border-gray-700/60 hover:border-gray-600 hover:shadow-md hover:shadow-black/30 hover:-translate-y-0.5"
      }`}
      style={{ background: "#1a2035" }}
      onClick={() => !isSelected && onSelect(index)}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 z-10 rounded-full bg-indigo-500 text-white text-[9px] font-bold px-2 py-0.5 shadow">
          ✓ Selected
        </div>
      )}

      {/* Color bar preview — top strip */}
      {isRegenerating ? (
        <div className="h-10 flex items-center justify-center bg-gray-800/60">
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex h-10 shrink-0">
          {[palette.primary, palette.secondary, palette.accent, palette.background, palette.text].map((c, i) => (
            <div key={i} className="flex-1" style={{ background: c }} />
          ))}
        </div>
      )}

      <div className="flex flex-col flex-1 p-3 gap-3">
        {/* Name + description */}
        <div>
          <p className="text-[13px] font-bold text-gray-100 leading-tight">{palette.paletteName}</p>
          <p className="text-[11px] text-gray-500 leading-snug mt-1 line-clamp-2">{palette.description}</p>
        </div>

        {/* Five swatches with role labels */}
        {!isRegenerating && (
          <div className="space-y-1.5">
            {[
              { role: "Primary",    color: palette.primary    },
              { role: "Secondary",  color: palette.secondary  },
              { role: "Accent",     color: palette.accent     },
              { role: "Background", color: palette.background },
              { role: "Text",       color: palette.text       },
            ].map(({ role, color }) => (
              <div key={role} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md border border-black/20 shrink-0 shadow-sm" style={{ background: color }} />
                <p className="text-[10px] text-gray-500 w-16 shrink-0">{role}</p>
                <p className="text-[10px] font-mono text-gray-600">{color}</p>
              </div>
            ))}
          </div>
        )}

        {/* Readability indicator */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[9px] uppercase tracking-wider text-gray-600">Readability</p>
            <span className={`text-[10px] font-bold ${rd.text}`}>{rd.label}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className={`h-full rounded-full ${rd.bar}`}
              style={{ width: palette.readability === "Excellent" ? "100%" : palette.readability === "Good" ? "67%" : "33%" }} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onSelect(index); }}
            disabled={isSelected}
            className={`flex-1 rounded-lg text-[11px] font-bold py-2 transition ${
              isSelected
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 cursor-default"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            {isSelected ? "✓ Selected" : "Select"}
          </button>
          <button
            type="button"
            title="Regenerate this palette"
            onClick={e => { e.stopPropagation(); onRegenerate(index); }}
            disabled={isRegenerating}
            className="w-8 h-8 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-700 text-gray-500 hover:text-gray-200 flex items-center justify-center transition text-sm disabled:opacity-40"
          >
            ↻
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorPalettePanel({ metadata, palettes, selectedPaletteIdx, generating, regeneratingIdx, onSelect, onRegenerate, onGenerateAll }) {
  const selected = selectedPaletteIdx !== null ? palettes[selectedPaletteIdx] : null;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Step 6</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-100">Color Palette</h2>
            <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">
              Four curated color systems matched to your cover strategy and mood.
            </p>
          </div>
          {palettes.length > 0 && (
            <button
              type="button"
              onClick={onGenerateAll}
              disabled={generating}
              className="shrink-0 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-[10px] font-bold px-3 py-1.5 transition disabled:opacity-40"
            >
              ↻ Regenerate All
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {generating && palettes.length === 0 ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-10 flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />
            ))}
          </div>
          <p className="text-[11px] text-rose-400 font-medium">Generating color palettes…</p>
        </div>
      ) : palettes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/20 p-10 flex flex-col items-center gap-3 text-center">
          <p className="text-[12px] text-gray-500">Set a book title to generate color palettes.</p>
          <button type="button" onClick={onGenerateAll}
            className="rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold px-4 py-2 transition">
            Generate Palettes
          </button>
        </div>
      ) : (
        <>
          {/* 2×2 grid */}
          <div className="grid grid-cols-2 gap-4">
            {palettes.map((palette, idx) => (
              <ColorPaletteCard
                key={idx}
                palette={palette}
                index={idx}
                isSelected={selectedPaletteIdx === idx}
                isRegenerating={regeneratingIdx === idx}
                onSelect={onSelect}
                onRegenerate={onRegenerate}
              />
            ))}
          </div>

          {/* Selected palette preview bar */}
          {selected && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">✓</span>
                <p className="text-[11px] text-indigo-300 font-semibold">{selected.paletteName} selected</p>
              </div>
              <div className="flex h-6 rounded-lg overflow-hidden">
                {[selected.primary, selected.secondary, selected.accent, selected.background, selected.text].map((c, i) => (
                  <div key={i} className="flex-1" style={{ background: c }} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Mood Board Helpers ───────────────────────────────────────────────────────

const COLOR_DIRECTION_PALETTES = {
  "Light & Airy":       { bg: "#f8f9fa", primary: "#e9ecef", accent: "#6c757d", text: "#212529", shape: "#dee2e6" },
  "Dark & Dramatic":    { bg: "#0d1117", primary: "#161b22", accent: "#d4a017", text: "#f0f6fc", shape: "#21262d" },
  "Warm Professional":  { bg: "#fef3e2", primary: "#f5deb3", accent: "#c0392b", text: "#2c1810", shape: "#f0c080" },
  "Cool Minimal":       { bg: "#eef2f7", primary: "#dbe7f3", accent: "#2c6fad", text: "#1a2b3c", shape: "#b8d4ea" },
  "Bold & Vibrant":     { bg: "#1a0533", primary: "#2d1264", accent: "#f72585", text: "#ffffff", shape: "#7b2ff7" },
  "Earthy & Natural":   { bg: "#f4ede3", primary: "#ddd0b3", accent: "#6b5344", text: "#2c1e10", shape: "#c4a882" },
  "Monochrome":         { bg: "#ffffff", primary: "#e0e0e0", accent: "#1a1a1a", text: "#1a1a1a", shape: "#9e9e9e" },
  "Soft Pastels":       { bg: "#fdf4fb", primary: "#f8d7f5", accent: "#9b59b6", text: "#3d1a4a", shape: "#e8b4e3" },
};

const DESIGN_STYLE_SHAPES = {
  Minimal:       "rect",
  Editorial:     "lines",
  Bold:          "block",
  Classic:       "border",
  Geometric:     "triangle",
  Organic:       "circles",
  Typographic:   "text",
  Photographic:  "frame",
};

function MoodBoardPreviewSVG({ colorDirection, designStyle, styleName }) {
  const pal = COLOR_DIRECTION_PALETTES[colorDirection] || COLOR_DIRECTION_PALETTES["Light & Airy"];
  const shapeType = DESIGN_STYLE_SHAPES[designStyle] || "rect";
  const w = 280, h = 160;

  const shapes = () => {
    switch (shapeType) {
      case "block":
        return <>
          <rect x="0" y="0" width={w} height={h} fill={pal.primary} />
          <rect x="0" y="0" width={w} height="8" fill={pal.accent} />
          <rect x="20" y="30" width="180" height="28" rx="2" fill={pal.accent} opacity="0.9" />
          <rect x="20" y="70" width="120" height="12" rx="2" fill={pal.text} opacity="0.5" />
          <rect x="20" y="90" width="80"  height="8"  rx="2" fill={pal.text} opacity="0.3" />
          <rect x={w - 40} y={h - 40} width="30" height="30" rx="2" fill={pal.accent} opacity="0.6" />
        </>;
      case "lines":
        return <>
          <rect x="0" y="0" width={w} height={h} fill={pal.bg} />
          <rect x="20" y="20" width="200" height="3" fill={pal.accent} />
          <rect x="20" y="35" width="150" height="22" rx="1" fill={pal.text} opacity="0.85" />
          <rect x="20" y="65" width="180" height="2" fill={pal.shape} />
          <rect x="20" y="75" width="130" height="10" rx="1" fill={pal.text} opacity="0.35" />
          <rect x="20" y="92" width="100" height="10" rx="1" fill={pal.text} opacity="0.25" />
          <rect x="20" y={h - 25} width="200" height="2" fill={pal.accent} opacity="0.4" />
        </>;
      case "triangle":
        return <>
          <rect x="0" y="0" width={w} height={h} fill={pal.primary} />
          <polygon points={`${w - 20},20 ${w - 20},${h - 20} 60,${h / 2}`} fill={pal.accent} opacity="0.25" />
          <polygon points={`${w},0 ${w},${h} ${w / 2},0`} fill={pal.shape} opacity="0.3" />
          <rect x="20" y="40" width="160" height="22" rx="3" fill={pal.text} opacity="0.8" />
          <rect x="20" y="72" width="100" height="10" rx="2" fill={pal.text} opacity="0.4" />
        </>;
      case "circles":
        return <>
          <rect x="0" y="0" width={w} height={h} fill={pal.bg} />
          <circle cx={w - 30} cy="30" r="55" fill={pal.accent} opacity="0.15" />
          <circle cx="30" cy={h - 30} r="40" fill={pal.shape} opacity="0.2" />
          <circle cx={w / 2} cy={h / 2} r="20" fill={pal.accent} opacity="0.1" />
          <rect x="20" y="38" width="170" height="22" rx="3" fill={pal.text} opacity="0.8" />
          <rect x="20" y="68" width="100" height="10" rx="2" fill={pal.text} opacity="0.4" />
        </>;
      case "frame":
        return <>
          <rect x="0" y="0" width={w} height={h} fill={pal.primary} />
          <rect x="12" y="12" width={w - 24} height={h - 24} fill="none" stroke={pal.accent} strokeWidth="2" rx="2" />
          <rect x="24" y="24" width={w - 48} height={h - 48} fill={pal.shape} opacity="0.2" />
          <rect x="30" y="50" width="160" height="20" rx="2" fill={pal.text} opacity="0.75" />
          <rect x="30" y="78" width="100" height="8"  rx="2" fill={pal.text} opacity="0.4" />
        </>;
      case "text":
        return <>
          <rect x="0" y="0" width={w} height={h} fill={pal.bg} />
          <rect x="20" y="20" width="220" height="36" rx="2" fill={pal.accent} opacity="0.9" />
          <rect x="20" y="64" width="200" height="18" rx="2" fill={pal.text} opacity="0.5" />
          <rect x="20" y="90" width="160" height="14" rx="2" fill={pal.text} opacity="0.3" />
          <rect x="20" y="112" width="80" height="14" rx="2" fill={pal.text} opacity="0.2" />
          <rect x="20" y={h - 18} width="220" height="2" fill={pal.accent} opacity="0.5" />
        </>;
      case "border":
        return <>
          <rect x="0" y="0" width={w} height={h} fill={pal.bg} />
          <rect x="0" y="0" width="6" height={h} fill={pal.accent} />
          <rect x="0" y="0" width={w} height="6" fill={pal.accent} />
          <rect x={w - 6} y="0" width="6" height={h} fill={pal.accent} />
          <rect x="0" y={h - 6} width={w} height="6" fill={pal.accent} />
          <rect x="20" y="30" width="180" height="24" rx="2" fill={pal.text} opacity="0.8" />
          <rect x="20" y="62" width="120" height="10" rx="2" fill={pal.text} opacity="0.4" />
          <rect x="20" y="80" width="80"  height="10" rx="2" fill={pal.text} opacity="0.25" />
        </>;
      default: // rect / Minimal
        return <>
          <rect x="0" y="0" width={w} height={h} fill={pal.bg} />
          <rect x="20" y="30" width="180" height="26" rx="3" fill={pal.accent} opacity="0.85" />
          <rect x="20" y="66" width="220" height="2"  fill={pal.shape} />
          <rect x="20" y="76" width="120" height="10" rx="2" fill={pal.text} opacity="0.4" />
          <rect x="20" y="94" width="80"  height="10" rx="2" fill={pal.text} opacity="0.25" />
        </>;
    }
  };

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      xmlns="http://www.w3.org/2000/svg"
      className="w-full rounded-t-xl"
      style={{ display: "block", aspectRatio: `${w}/${h}` }}
    >
      {shapes()}
      {/* Subtle label */}
      <rect x="8" y={h - 22} width={Math.min(styleName.length * 6.2 + 10, w - 16)} height="16" rx="8" fill="rgba(0,0,0,0.45)" />
      <text x="13" y={h - 11} fill="#ffffff" fontSize="8.5" fontFamily="system-ui, sans-serif" fontWeight="600" opacity="0.9">
        {styleName}
      </text>
    </svg>
  );
}

function MoodBoardCard({ board, index, isSelected, isRegenerating, onSelect, onRegenerate }) {
  const tagColor = {
    Minimal:           "bg-gray-700/50 text-gray-400 border-gray-600",
    Editorial:         "bg-slate-700/50 text-slate-300 border-slate-600",
    Bold:              "bg-rose-900/40 text-rose-300 border-rose-700",
    Classic:           "bg-amber-900/40 text-amber-300 border-amber-700",
    Geometric:         "bg-blue-900/40 text-blue-300 border-blue-700",
    Organic:           "bg-emerald-900/40 text-emerald-300 border-emerald-700",
    Typographic:       "bg-violet-900/40 text-violet-300 border-violet-700",
    Photographic:      "bg-cyan-900/40 text-cyan-300 border-cyan-700",
  };

  return (
    <div
      className={`relative rounded-xl border overflow-hidden flex flex-col transition-all duration-200 cursor-pointer group ${
        isSelected
          ? "border-indigo-500 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500/40"
          : "border-gray-700/60 hover:border-gray-600 hover:shadow-md hover:shadow-black/30 hover:-translate-y-0.5"
      }`}
      style={{ background: "#1a2035" }}
      onClick={() => !isSelected && onSelect(index)}
    >
      {/* Selected badge */}
      {isSelected && (
        <div className="absolute top-2 right-2 z-10 rounded-full bg-indigo-500 text-white text-[9px] font-bold px-2 py-0.5 shadow">
          ✓ Selected
        </div>
      )}

      {/* Preview SVG */}
      <div className="shrink-0 overflow-hidden rounded-t-xl">
        {isRegenerating ? (
          <div className="w-full flex items-center justify-center bg-gray-800/60" style={{ aspectRatio: "280/160" }}>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        ) : (
          <MoodBoardPreviewSVG
            colorDirection={board.colorDirection}
            designStyle={board.designStyle}
            styleName={board.styleName}
          />
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <div>
          <p className="text-[13px] font-bold text-gray-100 leading-tight">{board.styleName}</p>
          <p className="text-[11px] text-gray-500 leading-snug mt-1 line-clamp-3">{board.description}</p>
        </div>

        {/* Attribute tags */}
        <div className="flex flex-wrap gap-1">
          {[
            { label: board.designStyle,      base: tagColor[board.designStyle] || "bg-gray-700/50 text-gray-400 border-gray-600" },
            { label: board.mood,             base: "bg-gray-800/60 text-gray-400 border-gray-700" },
            { label: board.colorDirection,   base: "bg-gray-800/60 text-gray-400 border-gray-700" },
            { label: board.typographyStyle,  base: "bg-gray-800/60 text-gray-400 border-gray-700" },
            { label: board.visualComplexity, base: "bg-gray-800/60 text-gray-400 border-gray-700" },
          ].map(({ label, base }) => (
            <span key={label} className={`rounded-full border text-[9px] font-semibold px-2 py-0.5 ${base}`}>
              {label}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-1">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onSelect(index); }}
            disabled={isSelected}
            className={`flex-1 rounded-lg text-[11px] font-bold py-2 transition ${
              isSelected
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 cursor-default"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            {isSelected ? "✓ Selected" : "Select"}
          </button>
          <button
            type="button"
            title="Regenerate this card"
            onClick={e => { e.stopPropagation(); onRegenerate(index); }}
            disabled={isRegenerating}
            className="w-8 h-8 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-700 text-gray-500 hover:text-gray-200 flex items-center justify-center transition text-sm disabled:opacity-40"
          >
            ↻
          </button>
        </div>
      </div>
    </div>
  );
}

function MoodBoardPanel({ metadata, moodBoards, selectedMoodBoardIdx, generating, regeneratingIdx, onSelect, onRegenerate, onGenerateAll }) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Step 5</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-100">Mood Board</h2>
            <p className="text-[12px] text-gray-500 leading-relaxed mt-0.5">
              Four visual directions for your cover. Select one to guide AI generation.
            </p>
          </div>
          {moodBoards.length > 0 && (
            <button
              type="button"
              onClick={onGenerateAll}
              disabled={generating}
              className="shrink-0 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-[10px] font-bold px-3 py-1.5 transition disabled:opacity-40"
            >
              ↻ Regenerate All
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {generating && moodBoards.length === 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-10 flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <p className="text-[11px] text-amber-400 font-medium">Generating mood boards…</p>
        </div>
      ) : moodBoards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/20 p-10 flex flex-col items-center gap-3 text-center">
          <p className="text-[12px] text-gray-500">Set a book title to generate mood boards.</p>
          <button
            type="button"
            onClick={onGenerateAll}
            className="rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold px-4 py-2 transition"
          >
            Generate Mood Boards
          </button>
        </div>
      ) : (
        <>
          {/* 2×2 grid */}
          <div className="grid grid-cols-2 gap-4">
            {moodBoards.map((board, idx) => (
              <MoodBoardCard
                key={idx}
                board={board}
                index={idx}
                isSelected={selectedMoodBoardIdx === idx}
                isRegenerating={regeneratingIdx === idx}
                onSelect={onSelect}
                onRegenerate={onRegenerate}
              />
            ))}
          </div>

          {selectedMoodBoardIdx !== null && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 flex items-center gap-3">
              <span className="text-sm">✓</span>
              <p className="text-[11px] text-indigo-300">
                <span className="font-bold">{moodBoards[selectedMoodBoardIdx]?.styleName}</span>
                {" "}selected — canvas preview updated.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Cover Strategy Panel ────────────────────────────────────────────────────

function CoverStrategyPanel({ metadata, strategy: coverStrategy, generating, onRegenerate }) {
  const [summaryOpen, setSummaryOpen] = useState(true);

  const toneColor = {
    Professional: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    Calm:         "bg-teal-500/15 text-teal-300 border-teal-500/30",
    Bold:         "bg-rose-500/15 text-rose-300 border-rose-500/30",
    Inspirational:"bg-amber-500/15 text-amber-300 border-amber-500/30",
    Friendly:     "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    Serious:      "bg-slate-500/15 text-slate-300 border-slate-500/30",
    Premium:      "bg-purple-500/15 text-purple-300 border-purple-500/30",
    Elegant:      "bg-pink-500/15 text-pink-300 border-pink-500/30",
  };

  const focusIcon = {
    Typography:      "T",
    Illustration:    "🎨",
    Photography:     "📷",
    "Abstract Shapes":"◆",
    "Icon Based":    "⬡",
    Mixed:           "⊞",
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* ── Step header ── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Step 3</p>
        </div>
        <h2 className="text-lg font-bold text-gray-100">Cover Strategy</h2>
        <p className="text-[12px] text-gray-500 leading-relaxed">
          Converts market analysis into a precise design blueprint for all AI cover generation.
        </p>
      </div>

      {/* ── Loading state ── */}
      {generating ? (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-8 flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <p className="text-[11px] text-violet-400 font-medium">Building cover strategy…</p>
        </div>
      ) : !coverStrategy ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/20 p-8 flex flex-col items-center gap-3 text-center">
          <p className="text-[12px] text-gray-500 leading-relaxed">
            Complete Book Information to generate your cover strategy.
          </p>
          <button
            type="button"
            onClick={onRegenerate}
            className="rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-semibold px-4 py-2 transition"
          >
            Generate Strategy
          </button>
        </div>
      ) : (
        <>
          {/* 1 ── Primary Message — highlighted card */}
          <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-900/40 via-violet-900/20 to-violet-800/10 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">💡</span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Primary Message</p>
            </div>
            <p className="text-[15px] font-semibold text-white leading-snug">
              {coverStrategy.primaryMessage}
            </p>
          </div>

          {/* 2 ── Emotional Tone */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">🎭</span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Emotional Tone</p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-4 py-1.5 text-[12px] font-bold ${toneColor[coverStrategy.emotionalTone] || "bg-gray-700/50 text-gray-300 border-gray-600"}`}>
              {coverStrategy.emotionalTone}
            </span>
          </div>

          {/* 3 ── Visual Focus */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">👁</span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Visual Focus</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-700 border border-gray-600 flex items-center justify-center text-lg font-bold text-gray-300 shrink-0">
                {focusIcon[coverStrategy.visualFocus] ?? "◻"}
              </div>
              <div>
                <p className="text-[13px] font-bold text-gray-200">{coverStrategy.visualFocus}</p>
                <p className="text-[11px] text-gray-500 leading-snug">{coverStrategy.visualFocusExplanation}</p>
              </div>
            </div>
          </div>

          {/* 4 ── Cover Personality */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">✦</span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Cover Personality</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(coverStrategy.coverPersonality || []).map((kw, i) => (
                <span key={i} className="rounded-full bg-gray-700/60 border border-gray-600 text-gray-300 text-[11px] font-semibold px-3 py-1">
                  {kw}
                </span>
              ))}
            </div>
          </div>

          {/* 5 ── Reader First Impression */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">🧠</span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Reader First Impression</p>
            </div>
            <p className="text-[12px] text-gray-300 leading-relaxed italic">
              "{coverStrategy.readerFirstImpression}"
            </p>
          </div>

          {/* 6 ── Strategy Summary — collapsible */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setSummaryOpen(o => !o)}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-700/30 transition text-left"
            >
              <span className="text-sm">📋</span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex-1">Strategy Summary</p>
              <svg
                className={`w-3.5 h-3.5 text-gray-600 transition-transform ${summaryOpen ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {summaryOpen && (
              <div className="px-4 pb-4">
                <p className="text-[12px] text-gray-400 leading-relaxed">
                  {coverStrategy.strategySummary}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Regenerate */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={generating}
          className="w-full rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-200 text-[11px] font-semibold py-2.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {generating ? "Building strategy…" : "↻ Regenerate Strategy"}
        </button>
      </div>
    </div>
  );
}

// ─── Market Analysis Panel ────────────────────────────────────────────────────

function MarketAnalysisPanel({ metadata, analysis, generating, onRegenerate }) {
  const coverGoalColor = {
    "Build Trust":       "bg-sky-500/15 text-sky-300 border-sky-500/30",
    "Create Curiosity":  "bg-violet-500/15 text-violet-300 border-violet-500/30",
    "Look Premium":      "bg-amber-500/15 text-amber-300 border-amber-500/30",
    "Show Authority":    "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    "Feel Friendly":     "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    "Feel Educational":  "bg-teal-500/15 text-teal-300 border-teal-500/30",
    "Inspire Action":    "bg-orange-500/15 text-orange-300 border-orange-500/30",
  };

  const directionIcon = {
    "Professional Business": "💼",
    "Modern Self-Help":      "🚀",
    "Academic":              "🎓",
    "Luxury":                "✦",
    "Minimal":               "◻",
    "Bold":                  "⬛",
    "Inspirational":         "✨",
    "Corporate":             "🏢",
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* ── Step header ── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Step 2</p>
        </div>
        <h2 className="text-lg font-bold text-gray-100">Market Analysis</h2>
        <p className="text-[12px] text-gray-500 leading-relaxed">
          AI-powered design direction based on your book's category and audience.
        </p>
      </div>

      {/* ── Genre section ── */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">📚</span>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Genre</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-gray-600">Primary</p>
            <p className={`text-[12px] font-semibold ${metadata.primaryCategory ? "text-gray-200" : "text-gray-600 italic"}`}>
              {metadata.primaryCategory || "Not set"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-gray-600">Secondary</p>
            <p className={`text-[12px] font-semibold ${metadata.secondaryCategory ? "text-gray-200" : "text-gray-600 italic"}`}>
              {metadata.secondaryCategory || "Not set"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Target Audience ── */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">🎯</span>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Target Audience</p>
        </div>
        <p className={`text-[12px] font-medium ${metadata.audience ? "text-gray-200" : "text-gray-600 italic"}`}>
          {metadata.audience || "Not available."}
        </p>
      </div>

      {/* ── AI Analysis results ── */}
      {generating ? (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-6 flex flex-col items-center justify-center gap-3">
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <p className="text-[11px] text-indigo-400 font-medium">Analyzing market signals…</p>
        </div>
      ) : !analysis ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/20 p-6 flex flex-col items-center gap-3 text-center">
          <p className="text-[12px] text-gray-500 leading-relaxed">
            Set a category and audience to generate the market analysis.
          </p>
          <button
            type="button"
            onClick={onRegenerate}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold px-4 py-2 transition"
          >
            Analyze Now
          </button>
        </div>
      ) : (
        <>
          {/* Design Direction — highlighted card */}
          <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 via-indigo-900/20 to-indigo-800/10 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">🎨</span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Design Direction</p>
              <div className="ml-auto">
                <p className="text-[9px] text-indigo-600 font-semibold uppercase tracking-wide">Recommended</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl leading-none">
                {directionIcon[analysis.designDirection] || "🎨"}
              </span>
              <p className="text-xl font-bold text-white">{analysis.designDirection}</p>
            </div>
            {Array.isArray(analysis.keySignals) && analysis.keySignals.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {analysis.keySignals.map((sig, i) => (
                  <span key={i} className="rounded-full bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 text-[9px] font-medium px-2 py-0.5">
                    {sig}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Reader Expectation */}
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">👁</span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Reader Expectation</p>
            </div>
            <p className="text-[12px] text-gray-300 leading-relaxed">{analysis.readerExpectation}</p>
          </div>

          {/* Cover Goal + Confidence row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">🎯</span>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Cover Goal</p>
              </div>
              <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-bold ${coverGoalColor[analysis.coverGoal] || "bg-gray-700/50 text-gray-300 border-gray-600"}`}>
                {analysis.coverGoal}
              </span>
            </div>

            <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">📊</span>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Confidence</p>
              </div>
              <p className="text-2xl font-bold text-white">{analysis.confidence}%</p>
              <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${analysis.confidence}%`,
                    background: analysis.confidence >= 80
                      ? "rgb(52 211 153)"
                      : analysis.confidence >= 60
                      ? "rgb(99 102 241)"
                      : "rgb(251 191 36)",
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Regenerate button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={generating}
          className="w-full rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-200 text-[11px] font-semibold py-2.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {generating ? "Analyzing…" : "↻ Regenerate Analysis"}
        </button>
      </div>
    </div>
  );
}

// ─── Review Panel ────────────────────────────────────────────────────────────

const SCORE_DIMS = [
  { key: "readability",           label: "Readability"           },
  { key: "visualHierarchy",       label: "Visual Hierarchy"      },
  { key: "colorHarmony",          label: "Color Harmony"         },
  { key: "contrast",              label: "Contrast"              },
  { key: "genreMatch",            label: "Genre Match"           },
  { key: "professionalAppearance",label: "Professional"          },
  { key: "thumbnailVisibility",   label: "Thumbnail Visibility"  },
];

const SORT_OPTIONS = [
  { value: "highest",            label: "Highest Score"    },
  { value: "readability",        label: "Readability"      },
  { value: "genreMatch",         label: "Genre Match"      },
  { value: "thumbnailVisibility",label: "Thumbnail Score"  },
];

function scoreColor(n) {
  if (n >= 75) return { bar: "bg-emerald-500", text: "text-emerald-400", ring: "ring-emerald-500/30" };
  if (n >= 50) return { bar: "bg-amber-500",   text: "text-amber-400",   ring: "ring-amber-500/30"   };
  return             { bar: "bg-rose-500",     text: "text-rose-400",    ring: "ring-rose-500/30"    };
}

function OverallRing({ score }) {
  const { text } = scoreColor(score);
  const grade = score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : "D";
  return (
    <div className="flex flex-col items-center justify-center gap-0.5">
      <span className={`text-3xl font-black tabular-nums ${text}`}>{score}</span>
      <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-widest">/ 100</span>
      <span className={`text-[10px] font-bold ${text}`}>{grade}</span>
    </div>
  );
}

function ScoreBar({ label, value }) {
  const { bar, text } = scoreColor(value);
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-gray-500">{label}</span>
        <span className={`text-[9px] font-bold tabular-nums ${text}`}>{value}</span>
      </div>
      <div className="h-1 rounded-full bg-gray-700/60 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${bar}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function ReviewConceptCard({ concept, review, isRecommended }) {
  if (!review) return null;
  const { text: oText } = scoreColor(review.overallScore);
  return (
    <div
      className={`rounded-2xl border overflow-hidden flex flex-col ${
        isRecommended
          ? "border-amber-500/60 shadow-lg shadow-amber-500/10"
          : "border-gray-700/50"
      }`}
      style={{ background: "#1a2235" }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-gray-700/40">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
            style={{ background: concept.bg || "#1a2235", color: concept.accent || "#d4961a", border: `2px solid ${concept.accent || "#d4961a"}40` }}
          >
            {concept.conceptLabel}
          </div>
          <div>
            <p className="text-[12px] font-bold text-gray-100 leading-tight">{concept.conceptName}</p>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider">{concept.primaryStyle}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <OverallRing score={review.overallScore} />
        </div>
      </div>

      {/* AI Recommended badge */}
      {isRecommended && (
        <div className="px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-1.5">
          <span className="text-amber-400 text-[10px]">★</span>
          <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">AI Recommended</span>
        </div>
      )}

      {/* Score bars */}
      <div className="px-4 py-3 space-y-1.5 border-b border-gray-700/30">
        {SCORE_DIMS.map(({ key, label }) => (
          <ScoreBar key={key} label={label} value={review.scores?.[key] ?? 50} />
        ))}
      </div>

      {/* Strengths */}
      {review.strengths?.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-700/30">
          <p className="text-[8px] font-bold uppercase tracking-widest text-emerald-500/70 mb-1.5">Strengths</p>
          <ul className="space-y-1">
            {review.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-emerald-500 text-[9px] mt-0.5 shrink-0">✓</span>
                <span className="text-[10px] text-gray-300 leading-tight">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {review.improvements?.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-700/30">
          <p className="text-[8px] font-bold uppercase tracking-widest text-amber-500/70 mb-1.5">Improvements</p>
          <ul className="space-y-1">
            {review.improvements.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-amber-400 text-[9px] mt-0.5 shrink-0">→</span>
                <span className="text-[10px] text-gray-300 leading-tight">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Best use case */}
      {review.bestUseCase && (
        <div className="px-4 py-3">
          <p className="text-[8px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Best For</p>
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
            {review.bestUseCase}
          </span>
        </div>
      )}
    </div>
  );
}

function ReviewCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-700/50 overflow-hidden bg-gray-800/40 animate-pulse">
      <div className="px-4 pt-4 pb-3 border-b border-gray-700/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gray-700/60" />
          <div className="space-y-1">
            <div className="h-3 w-24 rounded bg-gray-700/60" />
            <div className="h-2 w-16 rounded bg-gray-700/40" />
          </div>
        </div>
        <div className="space-y-1 text-right">
          <div className="h-8 w-12 rounded bg-gray-700/60 ml-auto" />
          <div className="h-2 w-10 rounded bg-gray-700/40 ml-auto" />
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="space-y-0.5">
            <div className="h-2 w-20 rounded bg-gray-700/40" />
            <div className="h-1 rounded-full bg-gray-700/50" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewPanel({ concepts, conceptReviews, recommendedConceptLabel, reviewGenerating, onReview }) {
  const [sortBy, setSortBy] = useState("highest");

  const hasReviews = Array.isArray(conceptReviews) && conceptReviews.length > 0;
  const hasConcepts = Array.isArray(concepts) && concepts.length > 0;

  // Build a map: conceptLabel → review
  const reviewMap = {};
  (conceptReviews || []).forEach(r => { reviewMap[r.conceptLabel] = r; });

  // Merge concepts with their reviews and sort
  const items = (concepts || []).map((concept, idx) => ({
    concept,
    review: reviewMap[concept.conceptLabel] || null,
    idx,
  }));

  const sorted = [...items].sort((a, b) => {
    if (!a.review) return 1;
    if (!b.review) return -1;
    if (sortBy === "highest")             return (b.review.overallScore               ?? 0) - (a.review.overallScore               ?? 0);
    if (sortBy === "readability")         return (b.review.scores?.readability         ?? 0) - (a.review.scores?.readability         ?? 0);
    if (sortBy === "genreMatch")          return (b.review.scores?.genreMatch          ?? 0) - (a.review.scores?.genreMatch          ?? 0);
    if (sortBy === "thumbnailVisibility") return (b.review.scores?.thumbnailVisibility ?? 0) - (a.review.scores?.thumbnailVisibility ?? 0);
    return 0;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: "#0d1117" }}>
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800 flex items-center justify-between" style={{ background: "#111827" }}>
        <div>
          <h2 className="text-[13px] font-bold text-gray-100 tracking-wide">AI Review</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {hasReviews
              ? `${conceptReviews.length} concept${conceptReviews.length !== 1 ? "s" : ""} analyzed · Recommended: Concept ${recommendedConceptLabel || "–"}`
              : reviewGenerating
              ? "Analyzing concepts…"
              : "Generate concepts first, then review"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasReviews && (
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="text-[10px] rounded-lg border border-gray-700 bg-gray-800 text-gray-300 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => onReview()}
            disabled={reviewGenerating || !hasConcepts}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold tracking-wide transition-all ${
              reviewGenerating
                ? "bg-indigo-500/30 text-indigo-400 cursor-not-allowed"
                : !hasConcepts
                ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-500"
            }`}
          >
            {reviewGenerating ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                Analyzing…
              </>
            ) : (
              <>★ {hasReviews ? "Re-analyze" : "Analyze Concepts"}</>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {reviewGenerating ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-[11px] text-gray-500">Evaluating each concept against professional design criteria…</span>
            </div>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {[0, 1, 2, 3].map(i => <ReviewCardSkeleton key={i} />)}
            </div>
          </div>
        ) : hasReviews ? (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {sorted.map(({ concept, review }) => (
              <ReviewConceptCard
                key={concept.conceptLabel}
                concept={concept}
                review={review}
                isRecommended={concept.conceptLabel === recommendedConceptLabel}
              />
            ))}
          </div>
        ) : hasConcepts ? (
          <div className="flex flex-col items-center justify-center h-full min-h-64 text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700/50 flex items-center justify-center">
              <span className="text-3xl">★</span>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-300 mb-1.5">Ready to review</p>
              <p className="text-[11px] text-gray-600 max-w-xs leading-relaxed">
                {concepts.length} concept{concepts.length !== 1 ? "s" : ""} ready to be evaluated. Click <strong className="text-gray-400">Analyze Concepts</strong> to score each one against professional design criteria.
              </p>
            </div>
            <button
              onClick={() => onReview()}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-500 transition-colors"
            >
              ★ Analyze Concepts
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-64 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700/50 flex items-center justify-center">
              <span className="text-3xl text-gray-700">★</span>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-400 mb-1.5">No concepts yet</p>
              <p className="text-[11px] text-gray-600 max-w-xs leading-relaxed">
                Go to <strong className="text-gray-500">Generate Concepts</strong> first, then come back to analyze them.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Generate Concepts Panel ─────────────────────────────────────────────────

const STYLE_TO_RENDERER_TYPE = {
  Minimal:   "minimal",
  Bold:      "dynamic",
  Elegant:   "premium",
  Corporate: "authority",
  Creative:  "metaphor",
  Modern:    "dynamic",
};

const TAG_COLORS = {
  Professional:  "bg-sky-900/60 text-sky-300 border-sky-700/50",
  Minimal:       "bg-slate-800/60 text-slate-300 border-slate-600/50",
  Bold:          "bg-rose-900/60 text-rose-300 border-rose-700/50",
  Corporate:     "bg-blue-900/60 text-blue-300 border-blue-700/50",
  Modern:        "bg-indigo-900/60 text-indigo-300 border-indigo-700/50",
  Elegant:       "bg-purple-900/60 text-purple-300 border-purple-700/50",
  Creative:      "bg-violet-900/60 text-violet-300 border-violet-700/50",
  Dynamic:       "bg-orange-900/60 text-orange-300 border-orange-700/50",
  Classic:       "bg-amber-900/60 text-amber-300 border-amber-700/50",
  Premium:       "bg-yellow-900/60 text-yellow-300 border-yellow-700/50",
  Authoritative: "bg-emerald-900/60 text-emerald-300 border-emerald-700/50",
  Vibrant:       "bg-pink-900/60 text-pink-300 border-pink-700/50",
};

function ConceptCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-700/50 overflow-hidden bg-gray-800/40 animate-pulse">
      <div className="bg-gray-700/50" style={{ aspectRatio: "9/11" }} />
      <div className="p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-700/60" />
          <div className="h-3 rounded bg-gray-700/60 flex-1" />
        </div>
        <div className="space-y-1.5">
          <div className="h-2.5 rounded bg-gray-700/50 w-full" />
          <div className="h-2.5 rounded bg-gray-700/50 w-4/5" />
          <div className="h-2.5 rounded bg-gray-700/50 w-3/5" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-5 w-16 rounded-full bg-gray-700/50" />
          <div className="h-5 w-14 rounded-full bg-gray-700/50" />
        </div>
        <div className="flex gap-2 pt-1">
          <div className="flex-1 h-7 rounded-lg bg-gray-700/50" />
          <div className="w-8 h-7 rounded-lg bg-gray-700/50" />
        </div>
      </div>
    </div>
  );
}

function ConceptCard({ concept, idx, isSelected, isRegenerating, generatingAll, onSelect, onRegenerate, metadata }) {
  const rendererType = STYLE_TO_RENDERER_TYPE[concept.primaryStyle] || "authority";
  const cd = buildCoverData(
    { ...concept, type: rendererType },
    { subtitle: metadata?.subtitle || "", authorLine: metadata?.author || "", tagline: "" },
    metadata?.title || "Book Title"
  );

  return (
    <div
      className={`rounded-2xl border-2 overflow-hidden transition-all duration-200 hover:scale-[1.01] flex flex-col ${
        isSelected
          ? "border-indigo-500 shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-400/30"
          : "border-gray-700/60 hover:border-gray-500/70"
      }`}
      style={{ background: "#1a2235" }}
    >
      {/* Mini Cover Preview */}
      <div className="relative flex-shrink-0" style={{ aspectRatio: "9/11" }}>
        {isRegenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/80">
            <div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-2.5" />
            <span className="text-[10px] text-gray-400">Regenerating…</span>
          </div>
        ) : (
          <div className="absolute inset-0">
            <ConceptRenderer cd={cd} />
          </div>
        )}

        {/* Concept letter badge */}
        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-md ${
          isSelected ? "bg-indigo-500 text-white" : "bg-black/60 text-gray-300"
        }`}>
          {concept.conceptLabel}
        </div>

        {/* Selected checkmark */}
        {isSelected && !isRegenerating && (
          <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow-md">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
              <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Concept name */}
        <div>
          <p className="text-[12px] font-bold text-gray-100 leading-tight">{concept.conceptName}</p>
          <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{concept.primaryStyle}</p>
        </div>

        {/* Description */}
        {concept.description && (
          <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-3 flex-1">
            {concept.description}
          </p>
        )}

        {/* Style tags */}
        {concept.styleTags && concept.styleTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {concept.styleTags.map((tag, tagIdx) => (
              <span
                key={`${tag}-${tagIdx}`}
                className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full border ${TAG_COLORS[tag] || "bg-gray-800 text-gray-400 border-gray-700"}`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Primary color swatch */}
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full border border-white/20 shadow-sm flex-shrink-0"
            style={{ background: concept.bg }}
            title={`Background: ${concept.bg}`}
          />
          <div
            className="w-4 h-4 rounded-full border border-white/20 shadow-sm flex-shrink-0"
            style={{ background: concept.accent }}
            title={`Accent: ${concept.accent}`}
          />
          <span className="text-[9px] text-gray-600 font-mono">{concept.bg}</span>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={() => onSelect(idx)}
            disabled={isRegenerating}
            className={`flex-1 rounded-lg py-1.5 text-[10px] font-semibold transition-all ${
              isSelected
                ? "bg-indigo-600 text-white"
                : "bg-gray-700/70 text-gray-300 hover:bg-gray-600/70 hover:text-white"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isSelected ? "✓ Selected" : "Select"}
          </button>
          <button
            onClick={() => onRegenerate(idx)}
            disabled={isRegenerating || generatingAll}
            title="Regenerate this concept"
            className="w-8 rounded-lg bg-gray-700/70 text-gray-400 hover:bg-gray-600/70 hover:text-gray-200 text-[12px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            ↻
          </button>
        </div>
      </div>
    </div>
  );
}

function GenerateConceptsPanel({
  metadata,
  concepts,
  selectedConceptIdx,
  generatingAll,
  regeneratingIdx,
  onGenerate,
  onRegenerate,
  onSelect,
}) {
  const hasContext = !!(metadata?.title?.trim());
  const hasConcepts = Array.isArray(concepts) && concepts.length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: "#0d1117" }}>
      {/* Panel header */}
      <div
        className="shrink-0 px-6 py-4 border-b border-gray-800 flex items-center justify-between"
        style={{ background: "#111827" }}
      >
        <div>
          <h2 className="text-[13px] font-bold text-gray-100 tracking-wide">Generate Concepts</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {hasConcepts
              ? `${concepts.length} concept${concepts.length !== 1 ? "s" : ""} generated · Click to select`
              : "Generate four unique cover design directions"}
          </p>
        </div>

        <button
          onClick={onGenerate}
          disabled={generatingAll || !hasContext}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-bold tracking-wide transition-all shadow-sm ${
            generatingAll
              ? "bg-indigo-500/30 text-indigo-400 cursor-not-allowed"
              : !hasContext
              ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
              : "bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-indigo-500/25 hover:shadow-md"
          }`}
        >
          {generatingAll ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
              Generating…
            </>
          ) : (
            <>✦ Generate Concepts</>
          )}
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {generatingAll ? (
          /* Loading state: 4 skeleton cards */
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-[11px] text-gray-500">Generating four unique cover concepts…</span>
            </div>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {[0, 1, 2, 3].map(i => (
                <ConceptCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : hasConcepts ? (
          /* Concepts grid */
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {concepts.map((concept, idx) => (
              <ConceptCard
                key={idx}
                concept={concept}
                idx={idx}
                isSelected={selectedConceptIdx === idx}
                isRegenerating={regeneratingIdx === idx}
                generatingAll={generatingAll}
                onSelect={onSelect}
                onRegenerate={onRegenerate}
                metadata={metadata}
              />
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full min-h-64 text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-gray-700/50 flex items-center justify-center">
              <span className="text-3xl">✦</span>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-300 mb-1.5">No concepts yet</p>
              <p className="text-[11px] text-gray-600 max-w-xs leading-relaxed">
                Click <strong className="text-gray-400">Generate Concepts</strong> to create four unique cover design directions based on your Market Analysis, Cover Strategy, Mood Board, Color Palette and Design Elements.
              </p>
            </div>
            <button
              onClick={onGenerate}
              disabled={generatingAll || !hasContext}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-500 transition-colors disabled:opacity-40"
            >
              ✦ Generate Concepts
            </button>
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
  const [saveStatus, setSaveStatus] = useState("saved"); // "saved" | "saving" | "unsaved"
  const [currentStep, setCurrentStep] = useState("bookInfo");

  // Cover concepts generation state
  const [concepts, setConceptsState] = useState(() =>
    Array.isArray(bookCover?.concepts) ? bookCover.concepts : []
  );
  const [selectedConceptIdx, setSelectedConceptIdx] = useState(() =>
    typeof bookCover?.selectedConceptIndex === "number" ? bookCover.selectedConceptIndex : null
  );
  const [generatingAll, setGeneratingAll] = useState(false);
  const [regeneratingIdx, setRegeneratingIdx] = useState(null);

  // Concept Review Engine state
  const [conceptReviews, setConceptReviews] = useState(() =>
    Array.isArray(bookCover?.conceptReviews) ? bookCover.conceptReviews :
    Array.isArray(bookCover?.coverStudio?.conceptReviews) ? bookCover.coverStudio.conceptReviews : []
  );
  const [reviewGenerating, setReviewGenerating] = useState(false);
  const [recommendedConceptLabel, setRecommendedConceptLabel] = useState(() =>
    bookCover?.recommendedConceptLabel || bookCover?.coverStudio?.recommendedConceptLabel || null
  );

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

  // Market Analysis Engine state
  const [marketAnalysis, setMarketAnalysis] = useState(() =>
    bookCover?.marketAnalysis || bookCover?.coverStudio?.marketAnalysis || null
  );
  const [marketGenerating, setMarketGenerating] = useState(false);
  const marketDebounceRef = useRef(null);
  const marketKeyRef = useRef("");

  // Cover Strategy Engine state
  const [coverStrategyProfile, setCoverStrategyProfile] = useState(() =>
    bookCover?.coverStrategyProfile || bookCover?.coverStudio?.coverStrategy || null
  );
  const [strategyGenerating, setStrategyGenerating] = useState(false);
  const strategyDebounceRef = useRef(null);
  const strategyKeyRef = useRef("");

  // Mood Board Engine state
  const [moodBoards, setMoodBoards] = useState(() =>
    Array.isArray(bookCover?.moodBoards) ? bookCover.moodBoards :
    Array.isArray(bookCover?.coverStudio?.moodBoards) ? bookCover.coverStudio.moodBoards : []
  );
  const [selectedMoodBoardIdx, setSelectedMoodBoardIdx] = useState(() =>
    typeof bookCover?.selectedMoodBoardIdx === "number" ? bookCover.selectedMoodBoardIdx :
    typeof bookCover?.coverStudio?.selectedMoodBoardIdx === "number" ? bookCover.coverStudio.selectedMoodBoardIdx : null
  );
  const [moodBoardsGenerating, setMoodBoardsGenerating] = useState(false);
  const [moodBoardRegeneratingIdx, setMoodBoardRegeneratingIdx] = useState(null);
  const moodBoardDebounceRef = useRef(null);
  const moodBoardKeyRef = useRef("");

  // Color Palette Engine state
  const [colorPalettes, setColorPalettes] = useState(() =>
    Array.isArray(bookCover?.colorPalettes) ? bookCover.colorPalettes :
    Array.isArray(bookCover?.coverStudio?.colorPalettes) ? bookCover.coverStudio.colorPalettes : []
  );
  const [selectedPaletteIdx, setSelectedPaletteIdx] = useState(() =>
    typeof bookCover?.selectedPaletteIdx === "number" ? bookCover.selectedPaletteIdx :
    typeof bookCover?.coverStudio?.selectedPaletteIdx === "number" ? bookCover.coverStudio.selectedPaletteIdx : null
  );
  const [paletteGenerating, setPaletteGenerating] = useState(false);
  const [paletteRegeneratingIdx, setPaletteRegeneratingIdx] = useState(null);
  const paletteDebounceRef = useRef(null);
  const paletteKeyRef = useRef("");

  // Design Elements Engine state
  const [designElements, setDesignElements] = useState(() =>
    bookCover?.designElements || bookCover?.coverStudio?.designElements || null
  );
  const [designElementsGenerating, setDesignElementsGenerating] = useState(false);
  const designElementsDebounceRef = useRef(null);
  const designElementsKeyRef = useRef("");

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

  function buildConceptProfilePayload() {
    const selectedMoodBoard   = (Array.isArray(moodBoards) && selectedMoodBoardIdx !== null)
      ? moodBoards[selectedMoodBoardIdx] : null;
    const selectedPalette     = (Array.isArray(colorPalettes) && selectedPaletteIdx !== null)
      ? colorPalettes[selectedPaletteIdx] : null;
    const paletteColorsStr    = selectedPalette
      ? [selectedPalette.primary, selectedPalette.secondary, selectedPalette.accent, selectedPalette.background].filter(Boolean).join(", ")
      : "";

    return {
      title:                  metadata.title       || "",
      subtitle:               metadata.subtitle    || "",
      author:                 metadata.author      || "",
      primaryCategory:        metadata.primaryCategory || "",
      audience:               metadata.audience    || "",
      // Market Analysis
      marketDesignDirection:  marketAnalysis?.designDirection      || "",
      marketCompetitiveStyle: marketAnalysis?.coverGoal            || "",
      // Cover Strategy
      strategyTone:           coverStrategyProfile?.emotionalTone  || "",
      strategyVisualFocus:    coverStrategyProfile?.visualFocus    || "",
      strategyPrimaryMessage: coverStrategyProfile?.primaryMessage || "",
      strategyUniqueHook:     (coverStrategyProfile?.coverPersonality || []).join(", "),
      // Mood Board
      moodStyle:              selectedMoodBoard?.styleName         || "",
      moodDesignStyle:        selectedMoodBoard?.designStyle       || "",
      moodMood:               selectedMoodBoard?.mood              || "",
      moodColorStory:         selectedMoodBoard?.colorDirection    || "",
      // Color Palette
      paletteName:            selectedPalette?.paletteName         || "",
      paletteColors:          paletteColorsStr,
      // Design Elements
      deMainSubject:          designElements?.mainSubject          || "",
      deBackground:           designElements?.backgroundStyle      || "",
      deImageStyle:           designElements?.imageStyle           || "",
      deVisualComplexity:     designElements?.visualComplexity     || "",
      deFocalPoint:           designElements?.focalPoint           || "",
    };
  }

  async function handleReviewConcepts(conceptsToReview) {
    const toReview = conceptsToReview || concepts;
    if (!toReview?.length || reviewGenerating) return;
    setReviewGenerating(true);
    try {
      const res = await fetch("/api/ai/concept-review", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title:           metadata.title       || "",
          subtitle:        metadata.subtitle    || "",
          primaryCategory: metadata.primaryCategory || "",
          audience:        metadata.audience    || "",
          concepts:        toReview,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Review failed");
      if (Array.isArray(data.reviews)) {
        setConceptReviews(data.reviews);
        if (data.recommendedConceptLabel) setRecommendedConceptLabel(data.recommendedConceptLabel);
      }
    } catch (err) {
      console.error("[ConceptReview] error:", err);
    } finally {
      setReviewGenerating(false);
    }
  }

  async function handleGenerateConcepts() {
    if (generatingAll) return;
    setGeneratingAll(true);
    try {
      const payload = buildConceptProfilePayload();
      if (!payload.title.trim()) {
        console.warn("[CoverConcepts] No book title — skipping generation.");
        return;
      }
      const res = await fetch("/api/ai/concept-profiles", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Generation failed");
      if (Array.isArray(data.concepts)) {
        setConceptsState(data.concepts);
        // Auto-select first concept if none selected
        setSelectedConceptIdx(prev => prev !== null ? prev : 0);
        // Auto-trigger review for the newly generated concepts
        handleReviewConcepts(data.concepts).catch(err =>
          console.warn("[CoverConcepts] auto-review failed:", err)
        );
      }
    } catch (err) {
      console.error("[CoverConcepts] generation error:", err);
    } finally {
      setGeneratingAll(false);
    }
  }

  async function handleRegenerateConcept(idx) {
    if (regeneratingIdx !== null || generatingAll) return;
    setRegeneratingIdx(idx);
    try {
      const payload = buildConceptProfilePayload();
      const res = await fetch("/api/ai/concept-profiles", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...payload,
          singleIndex:      idx,
          existingConcepts: concepts,
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
        if (next[idx]) next[idx] = { ...next[idx], _error: err.message };
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

  // ── Market Analysis Engine ────────────────────────────────────────────────
  async function generateMarketAnalysis(force = false) {
    if (marketGenerating) return;

    const key = `${metadata.primaryCategory}|${metadata.secondaryCategory}|${metadata.audience}|${metadata.language}`;
    if (!force && key === marketKeyRef.current && marketAnalysis?.generatedForKey === key) return;
    if (!metadata.title?.trim()) return;

    marketKeyRef.current = key;
    setMarketGenerating(true);
    try {
      const res = await fetch("/api/ai/market-analysis", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:             metadata.title,
          subtitle:          metadata.subtitle          || "",
          author:            metadata.author            || "",
          primaryCategory:   metadata.primaryCategory   || "",
          secondaryCategory: metadata.secondaryCategory || "",
          audience:          metadata.audience          || "",
          language:          metadata.language          || "English",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Market analysis failed");
      setMarketAnalysis({ ...data, generatedForKey: key });
    } catch (err) {
      console.error("[MarketAnalysis] generation error:", err);
    } finally {
      setMarketGenerating(false);
    }
  }

  // Auto-regenerate when category, audience, or language changes
  useEffect(() => {
    const key = `${metadata.primaryCategory}|${metadata.secondaryCategory}|${metadata.audience}|${metadata.language}`;
    if (!metadata.title?.trim()) return;
    if (key === marketKeyRef.current && marketAnalysis?.generatedForKey === key) return;

    if (marketDebounceRef.current) clearTimeout(marketDebounceRef.current);
    marketDebounceRef.current = setTimeout(() => generateMarketAnalysis(false), 1400);
    return () => { if (marketDebounceRef.current) clearTimeout(marketDebounceRef.current); };
  }, [metadata.primaryCategory, metadata.secondaryCategory, metadata.audience, metadata.language, metadata.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Design Elements Engine ────────────────────────────────────────────────
  async function generateDesignElements(force = false) {
    if (designElementsGenerating) return;
    const selectedBoard   = moodBoards.length > 0 && selectedMoodBoardIdx !== null ? moodBoards[selectedMoodBoardIdx] : null;
    const selectedPalette = colorPalettes.length > 0 && selectedPaletteIdx !== null ? colorPalettes[selectedPaletteIdx] : null;
    const key = `${metadata.title}|${selectedBoard?.styleName}|${selectedPalette?.paletteName}|${coverStrategyProfile?.emotionalTone}`;
    if (!force && key === designElementsKeyRef.current && designElements?.generatedForKey === key) return;
    if (!metadata.title?.trim()) return;

    designElementsKeyRef.current = key;
    setDesignElementsGenerating(true);
    try {
      const res = await fetch("/api/ai/design-elements", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:                       metadata.title,
          subtitle:                    metadata.subtitle        || "",
          primaryCategory:             metadata.primaryCategory || "",
          audience:                    metadata.audience        || "",
          moodBoardStyle:              selectedBoard?.styleName          || "",
          moodBoardDesignStyle:        selectedBoard?.designStyle        || "",
          moodBoardMood:               selectedBoard?.mood               || "",
          coverStrategyTone:           coverStrategyProfile?.emotionalTone    || "",
          coverStrategyVisualFocus:    coverStrategyProfile?.visualFocus      || "",
          coverStrategyPrimaryMessage: coverStrategyProfile?.primaryMessage   || "",
          selectedPaletteName:         selectedPalette?.paletteName           || "",
          marketDesignDirection:       marketAnalysis?.designDirection        || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Design elements generation failed");
      setDesignElements({ ...data, generatedForKey: key });
    } catch (err) {
      console.error("[DesignElements] generation error:", err);
    } finally {
      setDesignElementsGenerating(false);
    }
  }

  function removeDesignSupportingElement(idx) {
    setDesignElements(prev => prev
      ? { ...prev, supportingElements: prev.supportingElements.filter((_, i) => i !== idx) }
      : prev
    );
  }

  // Auto-regenerate when mood board, palette, or strategy changes
  useEffect(() => {
    const selectedBoard   = moodBoards.length > 0 && selectedMoodBoardIdx !== null ? moodBoards[selectedMoodBoardIdx] : null;
    const selectedPalette = colorPalettes.length > 0 && selectedPaletteIdx !== null ? colorPalettes[selectedPaletteIdx] : null;
    const key = `${metadata.title}|${selectedBoard?.styleName}|${selectedPalette?.paletteName}|${coverStrategyProfile?.emotionalTone}`;
    if (!metadata.title?.trim()) return;
    if (key === designElementsKeyRef.current && designElements?.generatedForKey === key) return;

    if (designElementsDebounceRef.current) clearTimeout(designElementsDebounceRef.current);
    designElementsDebounceRef.current = setTimeout(() => generateDesignElements(false), 2400);
    return () => { if (designElementsDebounceRef.current) clearTimeout(designElementsDebounceRef.current); };
  }, [metadata.title, selectedMoodBoardIdx, selectedPaletteIdx, coverStrategyProfile?.emotionalTone]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Color Palette Engine ──────────────────────────────────────────────────
  async function generateColorPalettes(force = false) {
    if (paletteGenerating) return;
    const selectedBoard = moodBoards.length > 0 && selectedMoodBoardIdx !== null ? moodBoards[selectedMoodBoardIdx] : null;
    const key = `${metadata.title}|${metadata.primaryCategory}|${selectedBoard?.colorDirection}|${coverStrategyProfile?.emotionalTone}`;
    if (!force && key === paletteKeyRef.current && colorPalettes.length === 4) return;
    if (!metadata.title?.trim()) return;

    paletteKeyRef.current = key;
    setPaletteGenerating(true);
    try {
      const res = await fetch("/api/ai/color-palette", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:                   metadata.title,
          subtitle:                metadata.subtitle        || "",
          primaryCategory:         metadata.primaryCategory || "",
          audience:                metadata.audience        || "",
          moodBoardStyle:          selectedBoard?.styleName          || "",
          moodBoardColorDirection: selectedBoard?.colorDirection     || "",
          moodBoardMood:           selectedBoard?.mood               || "",
          coverStrategyTone:       coverStrategyProfile?.emotionalTone   || "",
          coverStrategyVisualFocus: coverStrategyProfile?.visualFocus    || "",
          marketDesignDirection:   marketAnalysis?.designDirection    || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Color palette generation failed");
      if (Array.isArray(data.palettes)) setColorPalettes(data.palettes);
    } catch (err) {
      console.error("[ColorPalette] generation error:", err);
    } finally {
      setPaletteGenerating(false);
    }
  }

  async function regenerateSinglePalette(idx) {
    if (paletteRegeneratingIdx !== null) return;
    setPaletteRegeneratingIdx(idx);
    try {
      const selectedBoard = moodBoards.length > 0 && selectedMoodBoardIdx !== null ? moodBoards[selectedMoodBoardIdx] : null;
      const res = await fetch("/api/ai/color-palette", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:                   metadata.title,
          subtitle:                metadata.subtitle        || "",
          primaryCategory:         metadata.primaryCategory || "",
          audience:                metadata.audience        || "",
          moodBoardStyle:          selectedBoard?.styleName          || "",
          moodBoardColorDirection: selectedBoard?.colorDirection     || "",
          moodBoardMood:           selectedBoard?.mood               || "",
          coverStrategyTone:       coverStrategyProfile?.emotionalTone   || "",
          coverStrategyVisualFocus: coverStrategyProfile?.visualFocus    || "",
          marketDesignDirection:   marketAnalysis?.designDirection    || "",
          regenerateIndex:         idx,
          existingPalettes:        colorPalettes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Palette regeneration failed");
      if (data.palette) {
        setColorPalettes(prev => { const next = [...prev]; next[idx] = data.palette; return next; });
        if (selectedPaletteIdx === idx) setSelectedPaletteIdx(null);
      }
    } catch (err) {
      console.error("[ColorPalette] single regeneration error:", err);
    } finally {
      setPaletteRegeneratingIdx(null);
    }
  }

  // Auto-generate palettes when title, category, mood board selection, or strategy tone changes
  useEffect(() => {
    const selectedBoard = moodBoards.length > 0 && selectedMoodBoardIdx !== null ? moodBoards[selectedMoodBoardIdx] : null;
    const key = `${metadata.title}|${metadata.primaryCategory}|${selectedBoard?.colorDirection}|${coverStrategyProfile?.emotionalTone}`;
    if (!metadata.title?.trim()) return;
    if (key === paletteKeyRef.current && colorPalettes.length === 4) return;

    if (paletteDebounceRef.current) clearTimeout(paletteDebounceRef.current);
    paletteDebounceRef.current = setTimeout(() => generateColorPalettes(false), 2200);
    return () => { if (paletteDebounceRef.current) clearTimeout(paletteDebounceRef.current); };
  }, [metadata.title, metadata.primaryCategory, selectedMoodBoardIdx, coverStrategyProfile?.emotionalTone]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mood Board Engine ─────────────────────────────────────────────────────
  async function generateMoodBoards(force = false) {
    if (moodBoardsGenerating) return;
    const key = `${metadata.title}|${metadata.primaryCategory}|${metadata.audience}|${coverStrategyProfile?.emotionalTone}`;
    if (!force && key === moodBoardKeyRef.current && moodBoards.length === 4) return;
    if (!metadata.title?.trim()) return;

    moodBoardKeyRef.current = key;
    setMoodBoardsGenerating(true);
    try {
      const res = await fetch("/api/ai/mood-board", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:               metadata.title,
          subtitle:            metadata.subtitle          || "",
          author:              metadata.author            || "",
          primaryCategory:     metadata.primaryCategory   || "",
          secondaryCategory:   metadata.secondaryCategory || "",
          audience:            metadata.audience          || "",
          marketDesignDirection: marketAnalysis?.designDirection || "",
          coverStrategy:       coverStrategyProfile || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Mood board generation failed");
      if (Array.isArray(data.boards)) setMoodBoards(data.boards);
    } catch (err) {
      console.error("[MoodBoard] generation error:", err);
    } finally {
      setMoodBoardsGenerating(false);
    }
  }

  async function regenerateSingleMoodBoard(idx) {
    if (moodBoardRegeneratingIdx !== null) return;
    setMoodBoardRegeneratingIdx(idx);
    try {
      const res = await fetch("/api/ai/mood-board", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:               metadata.title,
          subtitle:            metadata.subtitle          || "",
          author:              metadata.author            || "",
          primaryCategory:     metadata.primaryCategory   || "",
          secondaryCategory:   metadata.secondaryCategory || "",
          audience:            metadata.audience          || "",
          marketDesignDirection: marketAnalysis?.designDirection || "",
          coverStrategy:       coverStrategyProfile || null,
          regenerateIndex:     idx,
          existingBoards:      moodBoards,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Regeneration failed");
      if (data.board) {
        setMoodBoards(prev => {
          const next = [...prev];
          next[idx] = data.board;
          return next;
        });
        // If the regenerated card was selected, deselect it
        if (selectedMoodBoardIdx === idx) setSelectedMoodBoardIdx(null);
      }
    } catch (err) {
      console.error("[MoodBoard] single regeneration error:", err);
    } finally {
      setMoodBoardRegeneratingIdx(null);
    }
  }

  // Auto-generate mood boards when title, category, or cover strategy changes
  useEffect(() => {
    const key = `${metadata.title}|${metadata.primaryCategory}|${metadata.audience}|${coverStrategyProfile?.emotionalTone}`;
    if (!metadata.title?.trim()) return;
    if (key === moodBoardKeyRef.current && moodBoards.length === 4) return;

    if (moodBoardDebounceRef.current) clearTimeout(moodBoardDebounceRef.current);
    moodBoardDebounceRef.current = setTimeout(() => generateMoodBoards(false), 2000);
    return () => { if (moodBoardDebounceRef.current) clearTimeout(moodBoardDebounceRef.current); };
  }, [metadata.title, metadata.primaryCategory, metadata.audience, coverStrategyProfile?.emotionalTone]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cover Strategy Engine ─────────────────────────────────────────────────
  async function generateCoverStrategy(force = false) {
    if (strategyGenerating) return;

    const marketKey = `${metadata.title}|${metadata.subtitle}|${metadata.primaryCategory}|${metadata.secondaryCategory}|${metadata.audience}|${JSON.stringify(marketAnalysis?.designDirection)}`;
    if (!force && marketKey === strategyKeyRef.current && coverStrategyProfile?.generatedForKey === marketKey) return;
    if (!metadata.title?.trim()) return;

    strategyKeyRef.current = marketKey;
    setStrategyGenerating(true);
    try {
      const res = await fetch("/api/ai/cover-strategy", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:                   metadata.title,
          subtitle:                metadata.subtitle          || "",
          author:                  metadata.author            || "",
          primaryCategory:         metadata.primaryCategory   || "",
          secondaryCategory:       metadata.secondaryCategory || "",
          audience:                metadata.audience          || "",
          language:                metadata.language          || "English",
          marketDesignDirection:   marketAnalysis?.designDirection    || "",
          marketCoverGoal:         marketAnalysis?.coverGoal          || "",
          marketReaderExpectation: marketAnalysis?.readerExpectation  || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Cover strategy failed");
      setCoverStrategyProfile({ ...data, generatedForKey: marketKey });
    } catch (err) {
      console.error("[CoverStrategy] generation error:", err);
    } finally {
      setStrategyGenerating(false);
    }
  }

  // Auto-regenerate when title, subtitle, category, audience, or market analysis changes
  useEffect(() => {
    const marketKey = `${metadata.title}|${metadata.subtitle}|${metadata.primaryCategory}|${metadata.secondaryCategory}|${metadata.audience}|${JSON.stringify(marketAnalysis?.designDirection)}`;
    if (!metadata.title?.trim()) return;
    if (marketKey === strategyKeyRef.current && coverStrategyProfile?.generatedForKey === marketKey) return;

    if (strategyDebounceRef.current) clearTimeout(strategyDebounceRef.current);
    strategyDebounceRef.current = setTimeout(() => generateCoverStrategy(false), 1600);
    return () => { if (strategyDebounceRef.current) clearTimeout(strategyDebounceRef.current); };
  }, [metadata.title, metadata.subtitle, metadata.primaryCategory, metadata.secondaryCategory, metadata.audience, marketAnalysis?.designDirection]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setSaveStatus("unsaved");
    const timer = setTimeout(() => {
      setSaveStatus("saving");
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
          conceptReviews:       conceptReviews.length > 0 ? conceptReviews : [],
          recommendedConceptLabel: recommendedConceptLabel || null,
          typographyProfile:    typographyProfile || null,
          layoutProfile:        layoutProfile     || null,
          marketAnalysis:       marketAnalysis        || null,
          coverStrategyProfile:   coverStrategyProfile   || null,
          moodBoards:             moodBoards.length > 0     ? moodBoards     : [],
          selectedMoodBoardIdx:   selectedMoodBoardIdx      ?? null,
          colorPalettes:          colorPalettes.length > 0  ? colorPalettes  : [],
          selectedPaletteIdx:     selectedPaletteIdx         ?? null,
          designElements:         designElements             || null,
          // Extended cover studio state
          coverStudio: {
            ...project,
            metadata:             { ...metadata },
            canvas:               { ...canvas },
            typography:           typographyProfile    || null,
            layout:               layoutProfile        || null,
            marketAnalysis:       marketAnalysis       || null,
            coverStrategy:        coverStrategyProfile || null,
            moodBoards:           moodBoards.length > 0    ? moodBoards    : [],
            selectedMoodBoardIdx: selectedMoodBoardIdx     ?? null,
            colorPalettes:        colorPalettes.length > 0 ? colorPalettes : [],
            selectedPaletteIdx:   selectedPaletteIdx        ?? null,
            designElements:       designElements            || null,
            conceptReviews:       conceptReviews.length > 0 ? conceptReviews : [],
            recommendedConceptLabel: recommendedConceptLabel || null,
          },
        };
      });
      setLastSaved(new Date());
      setSaveStatus("saved");
    }, 600);
    return () => clearTimeout(timer);
  }, [metadata, canvas, strategy, visualDirection, coverPrompt, concepts, selectedConceptIdx, conceptReviews, recommendedConceptLabel, typographyProfile, layoutProfile, marketAnalysis, coverStrategyProfile, moodBoards, selectedMoodBoardIdx, colorPalettes, selectedPaletteIdx, designElements]); // eslint-disable-line react-hooks/exhaustive-deps

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
        saveStatus={saveStatus}
      />

      {/* ── Three-panel layout ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT PANEL (~300px) — Workflow Navigator + Project Status ── */}
        <div
          className="shrink-0 border-r border-gray-800 flex flex-col overflow-hidden"
          style={{ width: 300, background: "#111827" }}
        >
          <WorkflowNavigator currentStep={currentStep} onStepChange={setCurrentStep} />
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
          {currentStep === "review" ? (
            <ReviewPanel
              concepts={concepts}
              conceptReviews={conceptReviews}
              recommendedConceptLabel={recommendedConceptLabel}
              reviewGenerating={reviewGenerating}
              onReview={() => handleReviewConcepts()}
            />
          ) : currentStep === "concepts" ? (
            <GenerateConceptsPanel
              metadata={metadata}
              concepts={concepts}
              selectedConceptIdx={selectedConceptIdx}
              generatingAll={generatingAll}
              regeneratingIdx={regeneratingIdx}
              onGenerate={handleGenerateConcepts}
              onRegenerate={handleRegenerateConcept}
              onSelect={setSelectedConceptIdx}
            />
          ) : currentStep === "elements" ? (
            <DesignElementsPanel
              designElements={designElements}
              generating={designElementsGenerating}
              onRegenerate={() => generateDesignElements(true)}
              onRemoveSupportingElement={removeDesignSupportingElement}
            />
          ) : currentStep === "color" ? (
            <ColorPalettePanel
              metadata={metadata}
              palettes={colorPalettes}
              selectedPaletteIdx={selectedPaletteIdx}
              generating={paletteGenerating}
              regeneratingIdx={paletteRegeneratingIdx}
              onSelect={setSelectedPaletteIdx}
              onRegenerate={regenerateSinglePalette}
              onGenerateAll={() => generateColorPalettes(true)}
            />
          ) : currentStep === "mood" ? (
            <MoodBoardPanel
              metadata={metadata}
              moodBoards={moodBoards}
              selectedMoodBoardIdx={selectedMoodBoardIdx}
              generating={moodBoardsGenerating}
              regeneratingIdx={moodBoardRegeneratingIdx}
              onSelect={setSelectedMoodBoardIdx}
              onRegenerate={regenerateSingleMoodBoard}
              onGenerateAll={() => generateMoodBoards(true)}
            />
          ) : currentStep === "strategy" ? (
            <CoverStrategyPanel
              metadata={metadata}
              strategy={coverStrategyProfile}
              generating={strategyGenerating}
              onRegenerate={() => generateCoverStrategy(true)}
            />
          ) : currentStep === "market" ? (
            <MarketAnalysisPanel
              metadata={metadata}
              analysis={marketAnalysis}
              generating={marketGenerating}
              onRegenerate={() => generateMarketAnalysis(true)}
            />
          ) : (
            <>
              <CanvasToolbar
                zoom={canvas.zoomLevel}
                onZoom={handleZoom}
                onFitToScreen={handleFitToScreen}
                bookSizeLabel={bookSize.label}
                canvasBg={canvas.background}
                onBgChange={bg => setCanvas("background", bg)}
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
            </>
          )}
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
