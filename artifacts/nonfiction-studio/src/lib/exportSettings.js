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
export const LINE_SPACING_CHOICES = [
  { value: 1.0, label: "1.0" },
  { value: 1.15, label: "1.15" },
  { value: 1.5, label: "1.5" },
  { value: 2.0, label: "Double" },
];

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
