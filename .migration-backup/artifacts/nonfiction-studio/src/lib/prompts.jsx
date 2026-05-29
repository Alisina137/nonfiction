export function systemPrompt() {
  return `You are a world-class publishing strategist and lead editor.
You produce commercially viable books aligned to niche-native structure—not generic templates.
Rules:
- Never use motivational fluff, cliches, or vague advice.
- Match pacing, hooks, and emotional arcs to the declared niche architecture.
- Build progressively; each chapter must advance the arc.
- Avoid repetition; deepen stakes or insight every chapter.
- Honor bestseller patterns for the sub-niche.`;
}

export function nicheSystemPrompt(architecture) {
  const a = architecture || {};
  return `You are an elite ${a.mainNicheLabel || "publishing"} architect specializing in ${a.subNicheLabel || "this sub-niche"}.
Structure type: ${a.structureType || "narrative"}.
Pacing: ${a.pacingType || "standard"}.
Emotional arc: ${a.emotionalArc || "progressive"}.
Hook style: ${a.hookStyle || "strong opening"}.
Ending style: ${a.endingStyle || "satisfying close"}.
Bestseller patterns: ${(a.bestsellerPatterns || []).join("; ")}.
Reader psychology: ${a.readerPsychology || "commercially engaged readers"}.
Never impose a business-only outline on romance, thriller, fantasy, or story unless the architecture says so.`;
}

export function titlesPrompt(idea) {
  return `User idea: ${idea}
Generate exactly 5 premium nonfiction book titles as a JSON array of strings.
Each title must signal practical transformation and expert authority.`;
}

export function contextualBookTitlesPrompt({ research, competitorSummaries }) {
  const stance = research.stanceOnTopic?.trim() || "(not specified)";
  const standout = research.standout?.trim() || "(not specified)";
  const summariesBlock =
    Array.isArray(competitorSummaries) && competitorSummaries.length
      ? competitorSummaries.map((line, i) => `${i + 1}. ${line}`).join("\n")
      : "(none listed — infer only from niche below)";

  const nicheLine = research.mainNicheLabel && research.subNicheLabel
    ? `${research.mainNicheLabel} › ${research.subNicheLabel}`
    : research.genre?.trim() || "";

  return `You are naming a book for the following profile.

PRIMARY SUBJECT / TOPIC:
${research.bookTopic?.trim() || ""}

NICHE:
${nicheLine}

TARGET READER:
${research.targetAudience?.trim() || ""}

PUBLISHING GOAL:
${research.publishingGoal?.trim() || "not specified"}

AUTHOR VOICE / TONES (multiple):
${Array.isArray(research.authorTones) && research.authorTones.length ? research.authorTones.join(", ") : "not specified"}

STANCE ON TOPIC:
${stance}

WHAT MAKES THIS BOOK STAND OUT:
${standout}

COMPETITIVE / PARALLEL BOOKS (differentiate—not copy):
${summariesBlock}

Generate exactly 6 strong titles that fit the niche and sub-niche expectations.
Return JSON only: {"titles":["..."]}`;
}

export function descriptionPrompt({ idea, title, audience, tone }) {
  return `Idea: ${idea}
Selected title: ${title}
Audience: ${audience || "Not selected yet"}
Tone: ${tone || "Not selected yet"}
Generate 120-180 words book description with:
1) clear transformation promise
2) specific target outcome
3) subtle curiosity hook
Return JSON: {"description":"..."}`;
}

export function marketingDescriptionPrompt({
  idea,
  title,
  audience,
  tone,
  genre,
  usp,
  authorName,
  focusTags,
  shortSample
}) {
  const tags =
    Array.isArray(focusTags) && focusTags.length ? focusTags.join(", ") : "(none)";
  const sample = shortSample?.trim() ? shortSample.slice(0, 1200) : "(not provided)";

  return `Create Amazon/KDP-ready marketing copy for this book.

TITLE: ${title}
TOPIC / IDEA: ${idea}
NICHE: ${genre || "Nonfiction"}
AUTHOR: ${authorName || "Author"}
AUDIENCE: ${audience || "General readers"}
TONE: ${tone || "Direct and practical"}
UNIQUE SELLING PROPOSITION: ${usp || "Practical transformation without fluff"}
FOCUS PILLARS: ${tags}

MANUSCRIPT SAMPLE (voice reference only):
${sample}

Return JSON only:
{
  "description":"120-200 word back-cover style description",
  "shortHook":"one sentence hook under 18 words",
  "keywords":"7 comma-separated Amazon keywords"
}
Rules: no clichés, no vague motivation, concrete outcomes, match tone.`;
}

export function coverBriefPrompt({ title, subtitle, audience, tone, genre, usp, authorName, description }) {
  return `Design an ebook cover brief.

TITLE: ${title}
SUBTITLE: ${subtitle || "(generate one)"}
AUTHOR: ${authorName}
NICHE: ${genre || "General"}
AUDIENCE: ${audience}
TONE: ${tone}
USP: ${usp || ""}
DESCRIPTION: ${(description || "").slice(0, 600)}

Return JSON only:
{
  "subtitle":"specific subtitle under 12 words",
  "tagline":"cover hook under 10 words",
  "authorLine":"byline as it should appear",
  "layoutStyle":"one of: typographic | split-band | minimal | bold-stack",
  "primaryColor":"hex like #0c4a6e",
  "accentColor":"hex like #38bdf8",
  "textColor":"hex like #ffffff",
  "designNotes":"2-3 sentences for a designer"
}`;
}

export function outlinePrompt({ idea, title, description, audience, tone }) {
  return `Build an 8-10 chapter outline for this nonfiction book.
Idea: ${idea}
Title: ${title}
Description: ${description}
Audience: ${audience}
Tone: ${tone}
Constraints:
- progression: pain -> clarity -> systems -> execution -> results
- no repeated concept across chapters
Return JSON: {"chapters":[{"title":"...","summary":"1-2 lines"}]}`;
}

/** Niche-native outline — drives chapter titles from architecture beats */
export function nicheOutlinePrompt({ research, architecture, title, description }) {
  const a = architecture || {};
  const chapterCount = a.recommendedChapters?.default || 10;
  const flow = (a.chapterFlow || []).map((beat, i) => `${i + 1}. ${beat}`).join("\n");

  return `Design a commercially viable ${chapterCount}-chapter book outline.

MAIN NICHE: ${a.mainNicheLabel}
SUB-NICHE: ${a.subNicheLabel}
STRUCTURE TYPE: ${a.structureType}
PACING: ${a.pacingType}
EMOTIONAL ARC: ${a.emotionalArc}
HOOK STYLE: ${a.hookStyle}
ENDING STYLE: ${a.endingStyle}
BESTSELLER PATTERNS: ${(a.bestsellerPatterns || []).join(", ")}

BOOK TOPIC: ${research.bookTopic || ""}
TITLE (working): ${title || research.bookTitle || ""}
DESCRIPTION: ${description || ""}
TARGET READER: ${research.targetAudience || ""}
PUBLISHING GOAL: ${research.publishingGoal || ""}
TONES: ${(research.authorTones || []).join(", ")}
STANCE: ${research.stanceOnTopic || ""}
DIFFERENTIATION: ${research.standout || ""}

MANDATORY CHAPTER BEAT FLOW (adapt titles but preserve order and function):
${flow || "(use sub-niche-native escalation)"}

Rules:
- Exactly ${chapterCount} chapters unless flow requires ${a.recommendedChapters?.min}-${a.recommendedChapters?.max} — stay near ${chapterCount}.
- Each chapter must map to the emotional/structural arc—NO generic business framework unless structure type is framework-driven.
- Summaries must name concrete events, frameworks, or relationship beats—not vague advice.
- Include a one-line "arcRole" per chapter (e.g. "midpoint intimacy", "twist reveal").

Return JSON:
{
  "chapters":[
    {
      "title":"...",
      "summary":"2-3 sentences",
      "arcRole":"beat label",
      "sections":[
        {
          "title":"...",
          "subsections":[
            {"title":"...","intent":"..."},
            {"title":"...","intent":"..."}
          ]
        }
      ]
    }
  ],
  "architectureNotes":"1-2 sentences on how this outline honors the sub-niche"
}`;
}

export function structurePrompt({ chapterTitle, chapterSummary, fullOutline, audience, tone }) {
  return `Create deep chapter structure for "${chapterTitle}".
Chapter summary: ${chapterSummary}
Book outline context: ${JSON.stringify(fullOutline)}
Audience: ${audience}
Tone: ${tone}
Output JSON:
{
 "sections":[
  {
   "title":"...",
   "explanation":"...",
   "subsections":[
    {
      "title":"...",
      "strategy":"specific idea/framework",
      "explanation":"...",
      "application":"real-world application or mental model"
    }
   ]
  }
 ]
}
Rules: 3 sections total, each with exactly 3 subsections. No generic advice.`;
}

export function lessonPrompt({ subsection, chapterContext, previousConcepts, audience, tone }) {
  return `Write a complete lesson for subsection: ${JSON.stringify(subsection)}
Chapter context: ${JSON.stringify(chapterContext)}
Already-covered concepts to avoid repeating: ${JSON.stringify(previousConcepts || [])}
Audience: ${audience}
Tone: ${tone}
Return JSON:
{
 "title":"...",
 "explanation":"structured explanation in several paragraphs",
 "example":"real-world example or contrast",
 "framework":"named mental model or framework",
 "executionSteps":["step 1","step 2","step 3","step 4"]
}
No fluff or motivational language.`;
}

export function improvementPrompt({ action, currentText, tone }) {
  return `Improve the writing with action "${action}" while preserving core meaning and tone "${tone}".
Return only refined text.
Text:
${currentText}`;
}
