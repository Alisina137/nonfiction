export type EpubAccessibilityCheck = {
  id: string;
  label: string;
  status: "pass" | "review" | "block";
  detail: string;
};

export type EpubAccessibilityProfile = {
  direction: "ltr" | "rtl";
  metadata: Array<{ property: string; value: string }>;
  checks: EpubAccessibilityCheck[];
};

const RTL_LANGUAGES = new Set(["ar", "fa", "he", "yi", "ps", "ur"]);

export function epubReadingDirection(language: string): "ltr" | "rtl" {
  const primary = String(language || "en").toLowerCase().split("-")[0];
  return RTL_LANGUAGES.has(primary) ? "rtl" : "ltr";
}

export function buildEpubAccessibilityProfile(input: {
  language?: string;
  sectionCount?: number;
  navCount?: number;
  hasImages?: boolean;
} = {}): EpubAccessibilityProfile {
  const language = String(input.language || "en").trim() || "en";
  const sectionCount = Math.max(0, Number(input.sectionCount || 0));
  const navCount = Math.max(0, Number(input.navCount || 0));
  const hasImages = Boolean(input.hasImages);
  const direction = epubReadingDirection(language);

  const metadata = [
    { property: "schema:accessMode", value: "textual" },
    { property: "schema:accessModeSufficient", value: "textual" },
    { property: "schema:accessibilityFeature", value: "tableOfContents" },
    { property: "schema:accessibilityFeature", value: "structuralNavigation" },
    { property: "schema:accessibilityHazard", value: "none" },
    {
      property: "schema:accessibilitySummary",
      value: hasImages
        ? "This EPUB is primarily textual. Any meaningful images require text alternatives before publication."
        : "This EPUB is text-first, includes structural navigation, and contains no meaningful images requiring alternative text.",
    },
  ];

  const checks: EpubAccessibilityCheck[] = [
    {
      id: "epub-accessibility-metadata",
      label: "EPUB accessibility metadata",
      status: "pass",
      detail: "The package declares textual access mode, structural navigation, no known hazards, and an accessibility summary.",
    },
    {
      id: "epub-structural-navigation",
      label: "Structural navigation",
      status: sectionCount > 1 && navCount === sectionCount ? "pass" : "block",
      detail: sectionCount > 1 && navCount === sectionCount
        ? `Navigation covers all ${sectionCount} reading-order documents.`
        : `Navigation count (${navCount}) does not match the reading order (${sectionCount}).`,
    },
    {
      id: "epub-text-alternatives",
      label: "Meaningful image text alternatives",
      status: hasImages ? "review" : "pass",
      detail: hasImages
        ? "Meaningful images were detected; confirm useful alt text before Kindle upload."
        : "No meaningful images are embedded in the generated EPUB, so no image alt-text gap is present.",
    },
    {
      id: "epub-reading-direction",
      label: "Language and reading direction",
      status: language ? "pass" : "review",
      detail: `Language is ${language}; generated XHTML uses ${direction.toUpperCase()} reading direction.`,
    },
  ];

  return { direction, metadata, checks };
}
