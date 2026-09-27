export const KDP_BLEED_IN = 0.125;
export const KDP_OUTSIDE_SAFE_IN = 0.25;
export const KDP_SPINE_TEXT_CLEARANCE_IN = 0.0625;
export const KDP_BARCODE_WIDTH_IN = 2;
export const KDP_BARCODE_HEIGHT_IN = 1.2;
export const KDP_MIN_SPINE_TEXT_PAGES = 80;

export const PAPERBACK_INTERIORS = [
  { id: "bw-white", label: "Black & white · white paper", multiplier: 0.002252, paperType: "white", interiorType: "black-white" },
  { id: "bw-cream", label: "Black & white · cream paper", multiplier: 0.0025, paperType: "cream", interiorType: "black-white" },
  { id: "standard-color", label: "Standard color · white paper", multiplier: 0.002252, paperType: "white", interiorType: "standard-color" },
  { id: "premium-color", label: "Premium color · white paper", multiplier: 0.002347, paperType: "white", interiorType: "premium-color" },
];

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function estimateCoverPageCount(project) {
  const lessons = project?.lessons && typeof project.lessons === "object" ? project.lessons : {};
  const words = Object.values(lessons).reduce((total, entry) => {
    const prose = String(entry?.prose || "").trim();
    return total + (prose ? prose.split(/\s+/).filter(Boolean).length : 0);
  }, 0);

  if (words > 0) {
    const estimated = Math.ceil(words / 250);
    const even = estimated % 2 === 0 ? estimated : estimated + 1;
    return Math.max(24, even);
  }

  const range = String(project?.bookDetails?.wordCountRange || "");
  const values = range.replace(/,/g, "").match(/\d+/g)?.map(Number).filter(Number.isFinite) || [];
  if (values.length) {
    const avgWords = values.reduce((a, b) => a + b, 0) / values.length;
    const estimated = Math.ceil(avgWords / 250);
    const even = estimated % 2 === 0 ? estimated : estimated + 1;
    return Math.max(24, even);
  }

  return 120;
}

export function getSpineMultiplier(interiorId = "bw-white") {
  return PAPERBACK_INTERIORS.find((item) => item.id === interiorId)?.multiplier ?? 0.002252;
}

export function calculatePaperbackGeometry({
  trimWidth,
  trimHeight,
  pageCount,
  interiorId = "bw-white",
  readingDirection = "ltr",
} = {}) {
  const w = Math.max(4, num(trimWidth, 6));
  const h = Math.max(6, num(trimHeight, 9));
  const pages = Math.max(24, Math.round(num(pageCount, 120)));
  const spine = pages * getSpineMultiplier(interiorId);
  const fullWidth = KDP_BLEED_IN + w + spine + w + KDP_BLEED_IN;
  const fullHeight = KDP_BLEED_IN + h + KDP_BLEED_IN;

  return {
    trimWidth: w,
    trimHeight: h,
    pageCount: pages,
    interiorId,
    readingDirection,
    bleed: KDP_BLEED_IN,
    safeMargin: KDP_OUTSIDE_SAFE_IN,
    spineWidth: spine,
    spineTextEligible: pages >= KDP_MIN_SPINE_TEXT_PAGES,
    spineTextSafeWidth: Math.max(0, spine - KDP_SPINE_TEXT_CLEARANCE_IN * 2),
    fullWidth,
    fullHeight,
    frontX: readingDirection === "rtl"
      ? KDP_BLEED_IN
      : KDP_BLEED_IN + w + spine,
    backX: readingDirection === "rtl"
      ? KDP_BLEED_IN + w + spine
      : KDP_BLEED_IN,
    spineX: KDP_BLEED_IN + w,
    pixels300: {
      width: Math.round(fullWidth * 300),
      height: Math.round(fullHeight * 300),
      frontWidth: Math.round(w * 300),
      frontHeight: Math.round(h * 300),
    },
    barcode: {
      width: KDP_BARCODE_WIDTH_IN,
      height: KDP_BARCODE_HEIGHT_IN,
      side: readingDirection === "rtl" ? "left" : "right",
    },
  };
}

export function buildCoverPreflight({
  metadata,
  printSetup,
  geometry,
  backCover,
  concepts,
  selectedConceptIndex,
} = {}) {
  const checks = [];
  const add = (id, label, status, detail) => checks.push({ id, label, status, detail });

  const title = String(metadata?.title || "").trim();
  const author = String(metadata?.author || "").trim();
  const pages = geometry?.pageCount || 0;
  const selected = Array.isArray(concepts) && typeof selectedConceptIndex === "number"
    ? concepts[selectedConceptIndex]
    : null;

  add("title", "Front-cover title", title ? "pass" : "block", title ? "Title is present." : "Add the title before generating or exporting a cover.");
  add("author", "Author name", author ? "pass" : "review", author ? "Author name is present." : "Author name is empty.");
  add(
    "page-count",
    "Page count",
    pages >= 24 ? "pass" : "block",
    pages >= 24 ? `${pages} pages are being used for spine geometry.` : "Paperback page count must be at least 24."
  );
  add(
    "concept",
    "Selected front concept",
    selected ? "pass" : "review",
    selected ? `Concept ${selected.label || selectedConceptIndex + 1} is selected.` : "Generate and select a front-cover concept."
  );
  add(
    "spine-text",
    "Spine text",
    printSetup?.spineText && !geometry?.spineTextEligible ? "review" : "pass",
    geometry?.spineTextEligible
      ? `Spine width is ${geometry.spineWidth.toFixed(3)}″ and supports spine text.`
      : `At ${pages} pages, leave spine text off; KDP prints spine text only above 79 pages.`
  );
  add(
    "back-copy",
    "Back-cover copy",
    String(backCover?.blurb || "").trim() ? "pass" : "review",
    String(backCover?.blurb || "").trim() ? "Back-cover blurb is present." : "Add or generate a back-cover blurb."
  );
  add(
    "barcode",
    "Barcode safe area",
    printSetup?.barcodeMode === "none" ? "review" : "pass",
    printSetup?.barcodeMode === "own"
      ? "Keep your own barcode sharp, 300 PPI, and clear of trim/spine."
      : "KDP barcode exclusion zone is reserved on the back cover."
  );
  add(
    "trim-after-generation",
    "Trim consistency",
    printSetup?.generatedTrim && printSetup.generatedTrim !== metadata?.bookSize ? "review" : "pass",
    printSetup?.generatedTrim && printSetup.generatedTrim !== metadata?.bookSize
      ? `Concepts were generated for ${printSetup.generatedTrim}; current trim is ${metadata?.bookSize}. Regenerate concepts for the new proportions.`
      : "Current design is aligned with the selected trim."
  );

  const blocked = checks.filter((check) => check.status === "block").length;
  const reviews = checks.filter((check) => check.status === "review").length;
  return {
    status: blocked ? "block" : reviews ? "review" : "pass",
    blocked,
    reviews,
    passed: checks.filter((check) => check.status === "pass").length,
    checks,
  };
}

export function formatInches(value, digits = 3) {
  return `${Number(value || 0).toFixed(digits)}″`;
}
