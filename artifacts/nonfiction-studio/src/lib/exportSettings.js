export const TRIM_SIZES = [
  { id: "5x8", label: "5\" x 8\"" },
  { id: "5.5x8.5", label: "5.5\" x 8.5\"" },
  { id: "6x9", label: "6\" x 9\"" },
  { id: "8x10", label: "8\" x 10\"" },
  { id: "8.5x11", label: "8.5\" x 11\"" },
];

export const DEFAULT_TRIM_SIZE = "6x9";

export const FONT_CHOICES = [
  { id: "Garamond", label: "Garamond", cssFamily: "'EB Garamond', 'Garamond', serif" },
  { id: "Georgia", label: "Georgia", cssFamily: "'Gelasio', Georgia, serif" },
  { id: "Times New Roman", label: "Times New Roman", cssFamily: "'Times New Roman', Times, serif" },
];

export const FONT_SIZE_CHOICES = [11, 12, 13];

// Line spacing is fixed per KDP typography rules — always 1.15, regardless of
// the chosen font family/size. It is intentionally not user-configurable, so
// there is no picker for it in the export settings UI.
export const FIXED_LINE_SPACING = 1.15;

export const DEFAULT_EXPORT_SETTINGS = {
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

export function fontCssFamily(fontId) {
  return FONT_CHOICES.find((f) => f.id === fontId)?.cssFamily || "serif";
}
