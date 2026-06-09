// ═══════════════════════════════════════════════════════════════════════════
// Title Normalizer — provider-agnostic normalization for AI title responses
//
// Guarantees: every consumer always receives exactly 3 TitleItem objects
// with { title, angle, reason } regardless of which model produced the output.
// ═══════════════════════════════════════════════════════════════════════════

import { extractJSON } from "./aiRouter.js";

// ─── Canonical shape ───────────────────────────────────────────────────────

export interface TitleItem {
  title:  string;
  angle:  string;
  reason: string;
}

export interface NormalizeResult {
  titles:        TitleItem[];
  parseWarning:  string | null;
  repaired:      boolean;
}

export interface ValidationResult {
  valid:  boolean;
  errors: string[];
}

// ─── Context passed from the route for fallback generation ─────────────────

export interface TitleContext {
  idea?:    string;
  niche?:   string;
  subNiche?: string;
}

// ─── Field alias maps (alternative names models use) ──────────────────────

const TITLE_ALIASES  = ["title", "text", "name", "heading", "book_title", "bookTitle"];
const ANGLE_ALIASES  = ["angle", "category", "pattern", "style", "type", "formula", "approach", "strategy"];
const REASON_ALIASES = ["reason", "hook", "explanation", "description", "rationale", "why", "note", "subtitle"];

function pickField(obj: Record<string, any>, aliases: string[]): string {
  for (const key of aliases) {
    if (typeof obj[key] === "string" && obj[key].trim()) return obj[key].trim();
  }
  return "";
}

// ─── Coerce a single AI item into a TitleItem ──────────────────────────────

const MIN_TITLE_LENGTH = 8;

function coerceItem(raw: any, index: number): TitleItem | null {
  if (!raw) return null;

  // Plain string — must be a plausible title (not a fragment)
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t.length < MIN_TITLE_LENGTH) return null;
    return { title: t, angle: `Option ${index + 1}`, reason: "" };
  }

  if (typeof raw !== "object") return null;

  const title = pickField(raw, TITLE_ALIASES);
  if (!title || title.length < MIN_TITLE_LENGTH) return null;

  const angle  = pickField(raw, ANGLE_ALIASES)  || `Option ${index + 1}`;
  const reason = pickField(raw, REASON_ALIASES) || "";

  return { title, angle, reason };
}

// ─── Fallback titles generated from context ────────────────────────────────

function buildFallback(index: number, ctx: TitleContext): TitleItem {
  const niche = [ctx.subNiche, ctx.niche].filter(Boolean).join(" ").trim();
  const topic = ctx.idea?.trim() || niche || "Your Nonfiction Topic";

  const templates: Array<{ title: string; angle: string; reason: string }> = [
    {
      title:  `The Complete Guide to ${topic}`,
      angle:  "Authority-Focused",
      reason: "Positions the book as the definitive resource in its niche."
    },
    {
      title:  `${topic}: A Practical Playbook`,
      angle:  "Action-Focused",
      reason: "Signals hands-on, step-by-step transformation to the reader."
    },
    {
      title:  `Master ${topic} Fast`,
      angle:  "Transformation-Focused",
      reason: "Appeals to readers who want speed and measurable results."
    }
  ];

  return templates[index % templates.length];
}

// ─── Core normalizer ───────────────────────────────────────────────────────

export function normalizeTitlesFromText(
  rawText: string,
  ctx: TitleContext = {}
): NormalizeResult {
  let parseWarning: string | null = null;
  let rawItems: any[] = [];

  // ── Step 1: parse JSON safely ────────────────────────────────────────────
  let parsed: any = null;
  try {
    parsed = extractJSON(rawText);
  } catch (e: any) {
    parseWarning = `JSON parse failed: ${e?.message?.slice(0, 100)}`;
  }

  // ── Step 2: extract array of candidates ──────────────────────────────────
  if (parsed !== null) {
    if (Array.isArray(parsed)) {
      rawItems = parsed;
    } else if (Array.isArray(parsed?.titles)) {
      rawItems = parsed.titles;
    } else if (Array.isArray(parsed?.data)) {
      rawItems = parsed.data;
    } else if (Array.isArray(parsed?.items)) {
      rawItems = parsed.items;
    } else if (typeof parsed?.title === "string") {
      rawItems = [parsed];
    } else {
      parseWarning = parseWarning ?? "Unexpected JSON shape — no titles array found";
    }
  }

  // ── Step 3: regex fallback — pull quoted strings if JSON gave nothing ─────
  if (!rawItems.length) {
    const quoted = [...rawText.matchAll(/"([A-Z][^"]{8,90})"/g)]
      .map((m) => m[1].trim())
      .filter((t) => !t.includes("{") && !t.includes(":") && !t.startsWith("title"));
    if (quoted.length) {
      rawItems = quoted;
      parseWarning = parseWarning ?? "Fell back to regex extraction";
    }
  }

  // ── Step 4: coerce each item into TitleItem ───────────────────────────────
  const coerced: TitleItem[] = rawItems
    .map((item, i) => coerceItem(item, i))
    .filter((x): x is TitleItem => x !== null)
    .slice(0, 10);

  // ── Step 5: pad to 3 with fallbacks if needed ─────────────────────────────
  const repaired = coerced.length < 3;
  const titles   = [...coerced];
  while (titles.length < 3) {
    titles.push(buildFallback(titles.length, ctx));
  }

  return { titles: titles.slice(0, 3), parseWarning, repaired };
}

// ─── Validator ─────────────────────────────────────────────────────────────

export function validateTitleItems(items: TitleItem[]): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(items)) {
    errors.push("titles is not an array");
    return { valid: false, errors };
  }

  if (items.length !== 3) {
    errors.push(`Expected exactly 3 titles, got ${items.length}`);
  }

  items.forEach((item, i) => {
    if (!item || typeof item !== "object") {
      errors.push(`Item ${i} is not an object`);
      return;
    }
    if (!item.title?.trim())  errors.push(`Item ${i} missing title`);
    if (!item.angle?.trim())  errors.push(`Item ${i} missing angle`);
    // reason is checked but not required to be non-empty — warn only
  });

  return { valid: errors.length === 0, errors };
}

// ─── Full pipeline: normalize → validate → repair ─────────────────────────

export interface PipelineResult {
  titles:        TitleItem[];
  valid:         boolean;
  repaired:      boolean;
  parseWarning:  string | null;
  validationErrors: string[];
}

export function runTitlePipeline(
  rawText: string,
  ctx: TitleContext = {}
): PipelineResult {
  const { titles, parseWarning, repaired } = normalizeTitlesFromText(rawText, ctx);
  const { valid, errors: validationErrors } = validateTitleItems(titles);

  return { titles, valid, repaired, parseWarning, validationErrors };
}

// ─── Structured logger ─────────────────────────────────────────────────────

export interface TitleLogPayload {
  endpoint:          string;
  provider:          string;
  model:             string;
  rawResponse:       string;
  parsedResponse:    any;
  normalizedTitles:  TitleItem[];
  validationResult:  ValidationResult;
  repaired:          boolean;
  parseWarning:      string | null;
  attempt:           number;
}

export function logTitlePipeline(payload: TitleLogPayload): void {
  const tag = `[titles:${payload.endpoint}]`;
  console.log(`${tag} ──────────────────────────────────`);
  console.log(`${tag} Provider : ${payload.provider}`);
  console.log(`${tag} Model    : ${payload.model}`);
  console.log(`${tag} Attempt  : ${payload.attempt}`);
  console.log(`${tag} Raw      : ${payload.rawResponse.slice(0, 300)}${payload.rawResponse.length > 300 ? "…" : ""}`);
  if (payload.parseWarning) {
    console.log(`${tag} Warning  : ${payload.parseWarning}`);
  }
  console.log(`${tag} Parsed   :`, JSON.stringify(payload.parsedResponse)?.slice(0, 300));
  console.log(`${tag} Normalized:`);
  payload.normalizedTitles.forEach((t, i) => {
    console.log(`${tag}   [${i + 1}] title : ${t.title}`);
    console.log(`${tag}       angle : ${t.angle}`);
    console.log(`${tag}       reason: ${t.reason.slice(0, 80)}`);
  });
  console.log(`${tag} Valid    : ${payload.validationResult.valid}`);
  if (!payload.validationResult.valid) {
    console.log(`${tag} Errors   : ${payload.validationResult.errors.join(", ")}`);
  }
  if (payload.repaired) {
    console.log(`${tag} Repaired : true (fallbacks injected)`);
  }
  console.log(`${tag} ──────────────────────────────────`);
}
