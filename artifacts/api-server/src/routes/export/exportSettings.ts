// ─── KDP Export Settings Engine ─────────────────────────────────────────────
// Central source of truth for trim size, margins, typography, and page rules
// used by both the PDF and DOCX builders so the two outputs stay visually
// identical. Add new trim sizes / fonts here — builders read from this module.

export interface TrimSize {
  id: string;
  label: string;
  widthIn: number;
  heightIn: number;
}

export const TRIM_SIZES: TrimSize[] = [
  { id: "5x8",       label: `5" x 8"`,       widthIn: 5,   heightIn: 8 },
  { id: "5.5x8.5",   label: `5.5" x 8.5"`,   widthIn: 5.5, heightIn: 8.5 },
  { id: "6x9",       label: `6" x 9"`,       widthIn: 6,   heightIn: 9 },
  { id: "8x10",      label: `8" x 10"`,      widthIn: 8,   heightIn: 10 },
  { id: "8.5x11",    label: `8.5" x 11"`,    widthIn: 8.5, heightIn: 11 },
];

export const DEFAULT_TRIM_SIZE = "6x9";

export type FontChoice = "Garamond" | "Georgia" | "Times New Roman";
export const FONT_CHOICES: FontChoice[] = ["Garamond", "Georgia", "Times New Roman"];

// Line spacing is fixed per KDP typography rules — always 1.15 regardless of
// the chosen font family/size. This is intentionally not user-configurable.
export const FIXED_LINE_SPACING = 1.15;
export type LineSpacingChoice = 1.15;
export const LINE_SPACING_CHOICES: LineSpacingChoice[] = [1.15];

export type FontSizeChoice = 11 | 12 | 13;
export const FONT_SIZE_CHOICES: FontSizeChoice[] = [11, 12, 13];

export interface ExportSettings {
  trimSize: string;
  marginsMode: "kdp" | "custom";
  customMargins?: { top: number; bottom: number; inside: number; outside: number };
  font: FontChoice;
  fontSize: FontSizeChoice;
  lineSpacing: LineSpacingChoice;
  alignment: "left" | "justified";
  pageNumbers: boolean;
  headers: boolean;
  headerContent: "title" | "author" | "chapter";
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  trimSize: DEFAULT_TRIM_SIZE,
  marginsMode: "kdp",
  font: "Garamond",
  fontSize: 12,
  lineSpacing: 1.15,
  alignment: "left",
  pageNumbers: true,
  headers: false,
  headerContent: "title",
};

export function normalizeExportSettings(input: any): ExportSettings {
  const s = input && typeof input === "object" ? input : {};
  const trimSize = TRIM_SIZES.some((t) => t.id === s.trimSize) ? s.trimSize : DEFAULT_TRIM_SIZE;
  const font: FontChoice = FONT_CHOICES.includes(s.font) ? s.font : "Garamond";
  const fontSize: FontSizeChoice = FONT_SIZE_CHOICES.includes(Number(s.fontSize)) ? Number(s.fontSize) : 12;
  // Fixed per KDP typography rules — not user-configurable, always 1.15
  // regardless of what (if anything) the caller sends.
  const lineSpacing: LineSpacingChoice = FIXED_LINE_SPACING;
  const alignment = s.alignment === "justified" ? "justified" : "left";
  const pageNumbers = s.pageNumbers !== false;
  const headers = s.headers === true;
  const headerContent = ["title", "author", "chapter"].includes(s.headerContent) ? s.headerContent : "title";
  const marginsMode = s.marginsMode === "custom" ? "custom" : "kdp";
  const customMargins = marginsMode === "custom" && s.customMargins && typeof s.customMargins === "object"
    ? {
        top:     Number(s.customMargins.top)     || 0.75,
        bottom:  Number(s.customMargins.bottom)  || 0.75,
        inside:  Number(s.customMargins.inside)  || 0.75,
        outside: Number(s.customMargins.outside) || 0.5,
      }
    : undefined;

  return { trimSize, marginsMode, customMargins, font, fontSize, lineSpacing, alignment, pageNumbers, headers, headerContent };
}

export function getTrimSize(id: string): TrimSize {
  return TRIM_SIZES.find((t) => t.id === id) || TRIM_SIZES.find((t) => t.id === DEFAULT_TRIM_SIZE)!;
}

// ── KDP gutter recommendation table (approximate, based on estimated page count) ──
// The gutter (inside margin) increases with page count so the book still opens flat.
function kdpGutterForPageCount(pages: number): number {
  if (pages <= 150) return 0.75;
  if (pages <= 300) return 0.875;
  if (pages <= 500) return 1.0;
  if (pages <= 700) return 1.125;
  return 1.25;
}

export interface ResolvedMargins { top: number; bottom: number; inside: number; outside: number }

export function resolveMargins(settings: ExportSettings, estimatedPageCount: number): ResolvedMargins {
  if (settings.marginsMode === "custom" && settings.customMargins) {
    return { ...settings.customMargins };
  }
  return {
    top: 0.75,
    bottom: 0.75,
    outside: 0.5,
    inside: kdpGutterForPageCount(estimatedPageCount),
  };
}

// Rough page-count estimator from total manuscript word count, used only to
// pick the correct gutter width before final pagination is known.
export function estimatePageCount(wordCount: number, fontSize: number): number {
  const wordsPerPage = fontSize <= 11 ? 380 : fontSize === 12 ? 340 : 300;
  return Math.max(24, Math.ceil(wordCount / wordsPerPage) + 12); // +12 for front/back matter
}

// ── Font family resolution ───────────────────────────────────────────────────
// PDF: Garamond/Georgia need embedded TTFs (not standard PDF fonts).
// Times New Roman maps to pdf-lib's built-in Times-Roman (no embedding needed).
// DOCX: font family name is passed straight through — Word resolves it locally,
// falling back gracefully if the exact family isn't installed on the reader's machine.

export const DOCX_FONT_NAME: Record<FontChoice, string> = {
  "Garamond": "Garamond",
  "Georgia": "Georgia",
  "Times New Roman": "Times New Roman",
};

export const PDF_FONT_FILES: Record<string, { regular: string; bold: string; italic: string; boldItalic: string } | null> = {
  "Garamond": {
    regular: "EBGaramond-Regular.ttf",
    bold: "EBGaramond-Bold.ttf",
    italic: "EBGaramond-Italic.ttf",
    boldItalic: "EBGaramond-BoldItalic.ttf",
  },
  "Georgia": {
    regular: "Gelasio-Regular.ttf",
    bold: "Gelasio-Bold.ttf",
    italic: "Gelasio-Italic.ttf",
    boldItalic: "Gelasio-BoldItalic.ttf",
  },
  "Times New Roman": null, // uses pdf-lib StandardFonts.TimesRoman family — no embedding required
};
