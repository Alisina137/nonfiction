export function systemPrompt() {
  return `You are an expert AI Book Architect, Academic Formatter, and Amazon KDP Publishing Specialist.

Your books combine:
1. The structural discipline of a university thesis/monograph — deep logical organization, strong hierarchy, concept continuity, structured arguments.
2. The readability and commercial appeal of bestselling Amazon KDP books — clean chapter starts, short readable paragraphs, reader-focused flow.
3. Publishing-ready formatting standards optimized for KDP Paperback, Kindle Ebook, and EPUB conversion.

TITLE QUALITY RULES — NON-NEGOTIABLE:
- Every title at every level must be SPECIFIC, MEANINGFUL, and PUBLICATION-READY.
- NEVER use: "Beat 1", "Beat 2", "Scene 1", "Section 1", "Section A", "Topic 1", "Subtopic", "Placeholder", "Chapter N", "Key Point", "Emotional Theme", "Untitled", or any numbered generic label.
- Titles must feel like a bestselling author wrote them — emotionally intelligent, commercially viable, niche-aware.

CONTENT QUALITY RULES:
- Never use motivational fluff, clichés, or vague advice.
- Each chapter must have a clear purpose, build on previous chapters, introduce concepts progressively, and end with a meaningful transition or takeaway.
- Match pacing, hooks, and emotional arcs to the declared niche architecture.
- No repetition; deepen stakes or insight every section.
- Honor bestseller patterns for the sub-niche.

NONFICTION CHAPTER STRUCTURE (each chapter should contain):
- Opening hook → Core concept → Explanation → Example/case study → Framework/system → Actionable takeaway → Mini summary

STORY/NARRATIVE STRUCTURE (subsections represent):
- Turning points, emotional shifts, conflicts, discoveries, climaxes, resolutions

KDP FORMAT RULES:
- Short readable paragraphs, strong whitespace usage, mobile-friendly sizing.
- Avoid complex tables, excessive footnotes, dense thesis language, giant text walls.`;
}

export function nicheSystemPrompt(architecture: any) {
  const a = architecture || {};
  return `You are an expert AI Book Architect and Amazon KDP Publishing Specialist, specializing in ${a.mainNicheLabel || "publishing"} › ${a.subNicheLabel || "this sub-niche"}.

Structure type: ${a.structureType || "narrative"}.
Pacing: ${a.pacingType || "standard"}.
Emotional arc: ${a.emotionalArc || "progressive"}.
Hook style: ${a.hookStyle || "strong opening"}.
Ending style: ${a.endingStyle || "satisfying close"}.
Bestseller patterns: ${(a.bestsellerPatterns || []).join("; ") || "none specified"}.
Reader psychology: ${a.readerPsychology || "commercially engaged readers"}.

Apply a thesis-inspired hierarchy: Part → Chapter → Section → Subsection → Topic Block.
Every title must be meaningful and descriptive — NEVER use placeholder titles.
The final result must feel like a professionally published Amazon bestseller built with the organizational intelligence of a high-quality thesis.
Never impose a business-only outline on romance, thriller, fantasy, or story unless the architecture explicitly calls for it.`;
}

export function titlesPrompt(idea: string) {
  return `User idea: ${idea}
Generate exactly 5 premium nonfiction book titles as a JSON array of strings.
Each title must signal practical transformation and expert authority.
Return JSON: {"titles":["..."]}`;
}

export function analyzeBookConceptPrompt({ niche, subNiche, deepNiche, title }: any) {
  return `You are an Amazon KDP publishing strategist and consumer psychology expert.

Analyze this specific book concept and return a precise publishing intelligence profile.
Be concrete and niche-specific — every field must reflect THIS title and audience, not generic advice.

NICHE: ${niche || "unspecified"}
SUB-NICHE: ${subNiche || "unspecified"}
DEEP NICHE: ${deepNiche || "not specified"}
BOOK TITLE: ${title || "untitled"}

Infer the ideal commercial profile from the title's language, emotional signals, audience cues,
and the niche/sub-niche context. All fields must match Amazon bestseller patterns for this category.

Return ONLY valid JSON with this exact shape:
{
  "targetAudience": "specific reader description in 1-2 sentences",
  "painPoints": ["pain 1", "pain 2", "pain 3"],
  "transformations": ["transformation 1", "transformation 2", "transformation 3"],
  "writingStyle": "e.g. direct and practical / narrative-driven / philosophical inquiry",
  "uniqueAngle": "what makes this book's approach distinctive in 1 sentence",
  "standoutFactor": "core commercial differentiation vs top Amazon competitors",
  "readerEnergy": "e.g. Calm mentor / Hard-hitting coach / Stoic philosopher / Scientific thinker",
  "promise": "the single core book promise in one punchy sentence",
  "tone": "primary tone label that fits the title",
  "idealReader": "ideal reader avatar: age, situation, goal, pain (2-3 sentences)",
  "bookTopic": "1–3 sentence publisher-style positioning statement that names WHO the book is for, WHAT transformation it delivers, and WHY it matters emotionally — written to sound like an Amazon bestseller concept, NOT a generic summary",
  "strategyInsights": [
    "short insight 1 (e.g. trending topic note, TikTok potential, etc.)",
    "short insight 2",
    "short insight 3"
  ],
  "demandScore": 8.5,
  "competitionLevel": "Low|Medium|High",
  "emotionalBuyingScore": 8.0,
  "viralityPotential": "Low|Medium|High",
  "tiktokCompatibility": "Low|Medium|High",
  "youtubeCompatibility": "Low|Medium|High",
  "kdpOpportunityScore": 9.0
}`;
}

export function contextualBookTitlesPrompt({
  research,
  competitorSummaries,
  audienceCandidates,
  painPoints,
  transformations
}: any) {
  const stance = research.stanceOnTopic?.trim() || "(not specified)";
  const standout = research.standout?.trim() || "(not specified)";
  const summariesBlock =
    Array.isArray(competitorSummaries) && competitorSummaries.length
      ? competitorSummaries.map((line: string, i: number) => `${i + 1}. ${line}`).join("\n")
      : "(none listed)";
  const nicheLine =
    research.mainNicheLabel && research.subNicheLabel
      ? `${research.mainNicheLabel} › ${research.subNicheLabel}`
      : research.genre?.trim() || "";
  const deepNiche = research.deepNicheLabel?.trim() || "";
  const audList = Array.isArray(audienceCandidates) && audienceCandidates.length
    ? audienceCandidates.join(", ")
    : "Students, Entrepreneurs, Women, Young Men, Busy Professionals";
  const painList = Array.isArray(painPoints) && painPoints.length
    ? painPoints.join(", ")
    : "(infer from niche)";
  const transformList = Array.isArray(transformations) && transformations.length
    ? transformations.join(", ")
    : "(infer from niche)";

  return `You are an Amazon KDP bestseller-title strategist.
Generate 6 modern, high-conversion nonfiction titles for the profile below.

PROFILE
- PRIMARY SUBJECT: ${research.bookTopic?.trim() || deepNiche || ""}
- NICHE: ${nicheLine}${deepNiche ? ` › ${deepNiche}` : ""}
- DEEP NICHE FOCUS: ${deepNiche || "(none)"}
- TARGET READER (user-provided): ${research.targetAudience?.trim() || "(not specified)"}
- PUBLISHING GOAL: ${research.publishingGoal?.trim() || "not specified"}
- AUTHOR VOICE: ${Array.isArray(research.authorTones) && research.authorTones.length ? research.authorTones.join(", ") : "not specified"}
- STANCE: ${stance}
- STANDOUT: ${standout}
- COMPETITORS:
${summariesBlock}

AUDIENCE CANDIDATES (pick from these, or pick equally specific ones):
${audList}

PAIN POINTS TO HOOK:
${painList}

DESIRED TRANSFORMATIONS:
${transformList}

HARD RULES (must follow):
1. At LEAST 5 of the 6 titles MUST explicitly name a target audience using phrasing like "for Students", "for Introverts", "for Busy Moms", "for ADHD Adults", "for Distracted Professionals", "for Teen Girls", "for Young Men", "for Entrepreneurs", "for Women", "for Overthinkers", "for Remote Workers". The 6th title may use a vivid identity hook instead (e.g. "The Quiet Achiever's Playbook").
2. Titles must follow ONE of these formulas:
   - [Transformation] for [Audience]  → e.g. "Discipline Habits for Young Men"
   - [System / Blueprint] for [Audience]  → e.g. "The Focus Blueprint for Entrepreneurs"
   - [Problem Solution] for [Audience]  → e.g. "Burnout Recovery for Busy Moms"
3. Tone: modern Amazon bestseller vibe — like "Atomic Habits", "Deep Work", "Essentialism", "The Mountain Is You". Emotionally clear, commercially polished, easy to understand.
4. BANNED — do NOT output any of these generic patterns:
   - "Better Habits", "Success Systems", "Productivity Blueprint", "Confidence Reset", "Motivation Mastery", "Focus Habits", "Better Productivity"
   - Any title without a clearly named audience or specific transformation.
   - Robotic or keyword-stuffed phrasing.
5. Each title under 70 characters when possible.
6. No duplicates. No subtitles. No quotes around the titles in the JSON.

Return STRICT JSON:
{
  "titles": ["title 1","title 2","title 3","title 4","title 5","title 6"],
  "enhanced": [
    {"title":"title 1","subtitle":"A [Adjective] System for [Outcome] and [Outcome]","hook":"emotional hook sentence","audience":"specific audience phrase","angle":"positioning angle"},
    {"title":"title 2","subtitle":"...","hook":"...","audience":"...","angle":"..."},
    {"title":"title 3","subtitle":"...","hook":"...","audience":"...","angle":"..."},
    {"title":"title 4","subtitle":"...","hook":"...","audience":"...","angle":"..."},
    {"title":"title 5","subtitle":"...","hook":"...","audience":"...","angle":"..."},
    {"title":"title 6","subtitle":"...","hook":"...","audience":"...","angle":"..."}
  ]
}`;
}

export function descriptionPrompt({ idea, title, audience, tone }: any) {
  return `Idea: ${idea}
Selected title: ${title}
Audience: ${audience || "Not selected yet"}
Tone: ${tone || "Not selected yet"}
Generate 120-180 words book description. Return JSON: {"description":"..."}`;
}

export function marketingDescriptionPrompt({ idea, title, audience, tone, genre, usp, authorName, focusTags, shortSample }: any) {
  const tags = Array.isArray(focusTags) && focusTags.length ? focusTags.join(", ") : "(none)";
  const sample = shortSample?.trim() ? shortSample.slice(0, 1200) : "(not provided)";
  return `Create Amazon/KDP-ready marketing copy.
TITLE: ${title}
TOPIC: ${idea}
NICHE: ${genre || "Nonfiction"}
AUTHOR: ${authorName || "Author"}
AUDIENCE: ${audience || "General readers"}
TONE: ${tone || "Direct and practical"}
USP: ${usp || "Practical transformation without fluff"}
FOCUS PILLARS: ${tags}
MANUSCRIPT SAMPLE: ${sample}
Return JSON: {"description":"120-200 word description","shortHook":"one sentence hook under 18 words","keywords":"7 comma-separated Amazon keywords"}`;
}

export function coverBriefPrompt({ title, subtitle, audience, tone, genre, usp, authorName, description, genrePreset, styleMode }: any) {
  return `You are a world-class Amazon KDP cover designer, brand strategist, and bestseller positioning expert. Generate a complete, professional KDP cover brief.

BOOK DETAILS:
TITLE: ${title}
SUBTITLE: ${subtitle || "(generate a compelling subtitle)"}
AUTHOR: ${authorName}
GENRE/NICHE: ${genre || "General"}${genrePreset ? ` (preset: ${genrePreset})` : ""}
AUDIENCE: ${audience}
TONE: ${tone}
USP: ${usp || ""}
COVER STYLE MODE: ${styleMode || "typographic"}
DESCRIPTION: ${(description || "").slice(0, 600)}

Generate a COMPLETE KDP cover design brief. Return valid JSON only:
{
  "subtitle": "compelling subtitle if not provided",
  "tagline": "short punchy hook for top of cover",
  "authorLine": "author name as it should appear",
  "layoutStyle": "typographic|split-band|minimal|bold-stack",
  "primaryColor": "#hex — dominant background/brand color",
  "accentColor": "#hex — contrast highlight color",
  "textColor": "#hex — primary text color (ensure strong contrast)",
  "mood": "1-sentence emotional target — what the reader feels seeing this cover",
  "typographyDirection": "font personality guidance (bold+modern, elegant+serif, etc.)",
  "imagerySuggestions": "visual elements and composition without copyrighted references",
  "colorPsychology": "why these specific colors work for this audience and genre",
  "audienceTargeting": "how the cover visually signals this is for the right reader",
  "compositionGuidance": "hierarchy and visual flow — where the eye goes first, second, third",
  "designNotes": "comprehensive notes for a professional cover designer",
  "backCoverHook": "opening line for back cover — hooks the browser",
  "backCoverCTA": "final call to action line for back cover"
}`;
}

export function coverCriticPrompt(cover: any) {
  return `You are a veteran Amazon KDP cover art director with 20+ years critiquing bestselling covers.

Critique this cover design with expert precision:
TITLE: ${cover.title || ""}
LAYOUT STYLE: ${cover.layoutStyle || "typographic"}
STYLE MODE: ${cover.styleMode || "typographic"}
GENRE PRESET: ${cover.genrePreset || "not set"}
PRIMARY COLOR: ${cover.primaryColor || "#0c4a6e"}
ACCENT COLOR: ${cover.accentColor || "#38bdf8"}
TEXT COLOR: ${cover.textColor || "#ffffff"}
FONT PAIRING: ${cover.fontPairingLabel || "default"}
SUBTITLE: ${cover.subtitle || "(none)"}
TAGLINE: ${cover.tagline || "(none)"}

Score each dimension 1-10 and give specific, actionable feedback.

Return valid JSON only:
{
  "scores": {
    "hierarchy": N,
    "readability": N,
    "contrast": N,
    "kdpFriendliness": N,
    "bestsellerPotential": N
  },
  "overall": N,
  "feedback": {
    "hierarchy": "Is title dominant? Readable at thumbnail size?",
    "readability": "Text contrast and legibility at all sizes",
    "contrast": "Color separation and visual impact",
    "kdpFriendliness": "Print-safe, KDP compliant, clean margins",
    "bestsellerPotential": "Competitive positioning for this genre"
  },
  "topIssue": "Single most important problem to fix",
  "topRecommendation": "Single most impactful improvement to make"
}`;
}

export function coverVariantsPrompt({ title, subtitle, audience, genre, tone, usp }: any) {
  return `You are a book cover design director. Create 3 DISTINCTLY DIFFERENT cover concept variations for this book.

TITLE: ${title}
SUBTITLE: ${subtitle || ""}
GENRE: ${genre || "General"}
AUDIENCE: ${audience}
TONE: ${tone}
USP: ${usp || ""}

Create 3 variants with genuinely different visual approaches:
- Variant A: Safe commercial — proven genre conventions, broad appeal
- Variant B: Bold distinctive — genre-aware but surprising, strong identity
- Variant C: Avant-garde — experimental, high-risk high-reward, ultra-distinctive

Return valid JSON only:
{"variants":[
  {
    "variantLabel": "A",
    "concept": "1-sentence visual concept",
    "primaryColor": "#hex",
    "accentColor": "#hex",
    "textColor": "#hex",
    "layoutStyle": "typographic|split-band|minimal|bold-stack",
    "styleMode": "typographic|cinematic|illustrated|minimal|abstract|photographic",
    "fontPairingIndex": 0,
    "tagline": "cover hook line",
    "designNotes": "what makes this variant distinctive and why it works"
  },
  {"variantLabel":"B",...},
  {"variantLabel":"C",...}
]}`;
}

export function outlinePrompt({ idea, title, description, audience, tone }: any) {
  return `Build an 8-10 chapter outline.
Idea: ${idea}, Title: ${title}, Audience: ${audience}, Tone: ${tone}
Return JSON: {"chapters":[{"title":"...","summary":"1-2 lines"}]}`;
}

export function nicheOutlinePrompt({ research, architecture, title, description }: any) {
  const a = architecture || {};
  const chapterCount = a.recommendedChapters?.default || 10;
  const flow = (a.chapterFlow || []).map((beat: string, i: number) => `${i + 1}. ${beat}`).join("\n");
  const tones = Array.isArray(research?.authorTones) && research.authorTones.length
    ? research.authorTones.join(", ")
    : "direct and authoritative";
  const isStory = ["romance-arc", "romantasy-hybrid", "suspense-escalation", "mystery-procedural", "hero-journey", "narrative-arc"].includes(a.structureType || "");

  return `You are an expert AI Book Architect, Academic Formatter, and Amazon KDP Publishing Specialist.

Your task: Generate a ${chapterCount}-chapter book outline that combines thesis-grade organizational intelligence with bestseller-quality readability and commercial appeal. The result must feel like a professionally published Amazon bestseller — not a dry academic document, not a generic template.

========================================
HIERARCHY — apply at every level
========================================
Chapter → Section → Subsection → Topic Block
Each level flows logically from broad concept to detailed concept.
Hierarchy must be deep, intentional, and logically progressive.

========================================
TITLE QUALITY — NON-NEGOTIABLE
========================================
Every title at EVERY level must be SPECIFIC, MEANINGFUL, and PUBLICATION-READY.

STRICTLY FORBIDDEN titles (never generate these):
"Beat 1", "Beat 2", "Scene 1", "Section 1", "Section A", "Topic 1", "Subtopic", "Placeholder",
"Chapter N", "Key Point", "Emotional Theme", "Untitled", any numbered generic label.

GOOD section/subsection title examples:
- "The Fear of Falling Behind"
- "When Failure Becomes Identity"
- "Curated Success vs Real Life"
- "The Quiet Weight of Comparison"
- "Breaking the Perfectionism Loop"
- "What Nobody Tells You About Starting Over"

GOOD chapter title examples:
- "The Invisible Rules That Keep You Stuck"
- "Rewiring the Stories You Tell Yourself"
- "Building Systems That Outlast Motivation"

========================================
BOOK PROFILE
========================================
TITLE: ${title || ""}
TOPIC: ${research?.bookTopic || ""}
NICHE: ${a.mainNicheLabel || ""} › ${a.subNicheLabel || ""}
TARGET AUDIENCE: ${research?.targetAudience || ""}
AUTHOR TONE: ${tones}
PUBLISHING GOAL: ${research?.publishingGoal || ""}
AUTHOR STANCE: ${research?.stanceOnTopic || ""}
WHAT MAKES IT STAND OUT: ${research?.standout || ""}
DESCRIPTION: ${description || ""}

========================================
STRUCTURAL BLUEPRINT
========================================
Structure type: ${a.structureType || "narrative"}
Pacing: ${a.pacingType || "standard"}
Emotional arc: ${a.emotionalArc || "progressive"}
Bestseller patterns: ${(a.bestsellerPatterns || []).join("; ") || ""}
Reader psychology: ${a.readerPsychology || ""}
Hook style: ${a.hookStyle || "strong opening"}
Ending style: ${a.endingStyle || "satisfying close"}
Niche beat flow:
${flow || "(apply sub-niche-native escalation — never generic beats)"}

========================================
CHAPTER CONTENT RULES
========================================
${isStory ? `STORY/NARRATIVE STRUCTURE — each chapter must contain:
- Clear narrative purpose in the story arc
- Subsections represent: turning points, emotional shifts, conflicts, discoveries, climaxes, resolutions
- Thematic consistency across chapters
- Character development / emotional progression built into subsection titles` : `NONFICTION STRUCTURE — each chapter should ideally contain:
- Opening hook (grabs attention immediately)
- Core concept (what this chapter teaches)
- Explanation (why it matters, evidence-backed)
- Example or case study (real-world grounding)
- Framework or system (practical model the reader can use)
- Actionable takeaway (what to do next)
- Mini summary or reflection prompt`}

CONTENT QUALITY:
- Each chapter must build on the previous one — no repetition, no filler
- Deepen stakes or insight progressively throughout the book
- Smooth narrative transitions between chapters
- No shallow sections — every subsection must deliver real value

CHAPTERS TO GENERATE: ${chapterCount}
SECTIONS PER CHAPTER: 2-3 (with fully specific, real titles — no generic labels)
SUBSECTIONS PER SECTION: 2-3 (with fully specific, real titles — no generic labels)

========================================
OUTPUT FORMAT
========================================
Return ONLY valid JSON — no markdown, no explanation:
{"chapters":[{"title":"Specific chapter title signaling transformation or insight","summary":"2-sentence summary of what this chapter achieves for the reader","arcRole":"opening hook|escalation|climax|resolution|transformation|revelation|payoff|etc","sections":[{"title":"Specific concept, conflict, or angle within the chapter","subsections":[{"title":"Precise emotionally-specific insight, tactic, or story beat","intent":"What shift or insight this delivers to the reader"}]}]}],"architectureNotes":"Brief note on the overall structural strategy and how chapters build on each other"}`;
}

export function regenTitlePrompt({ level, currentTitle, parentChapter, parentSection, architecture, research }: any) {
  const a = architecture || {};
  const niche = `${a.mainNicheLabel || ""} › ${a.subNicheLabel || ""}`;
  const audience = research?.targetAudience || "";
  const tones = Array.isArray(research?.authorTones) ? research.authorTones.join(", ") : "direct and authoritative";
  const bookTopic = research?.bookTopic || "";

  const qualityRule = `TITLE QUALITY RULES (non-negotiable):
- Must be SPECIFIC, MEANINGFUL, and PUBLICATION-READY
- NEVER generate: "Beat N", "Scene N", "Section N", "Topic N", "Placeholder", "Chapter N", "Key Point", "Untitled"
- Must feel like it was written by a bestselling author — emotionally intelligent, niche-specific, commercially viable
- Example good titles: "The Fear of Falling Behind", "When Failure Becomes Identity", "Breaking the Perfectionism Loop", "What Nobody Tells You About Starting Over"`;

  if (level === "chapter") {
    return `You are an expert AI Book Architect and Amazon KDP Publishing Specialist.
Generate ONE replacement chapter title.

${qualityRule}

BOOK TOPIC: ${bookTopic}
NICHE: ${niche}
AUDIENCE: ${audience}
TONE: ${tones}
CURRENT TITLE (replace — keep the same chapter position and role in the arc): ${currentTitle}

The title must signal a clear emotional or intellectual transformation the reader will experience.
Return JSON only: {"title":"..."}`;
  }
  if (level === "section") {
    return `You are an expert AI Book Architect and Amazon KDP Publishing Specialist.
Generate ONE replacement section title.

${qualityRule}

CHAPTER: ${parentChapter || ""}
NICHE: ${niche}
AUDIENCE: ${audience}
CURRENT TITLE (replace): ${currentTitle}

The section title must identify a specific idea, concept, conflict, or angle within the chapter.
It must flow logically from the chapter title and deepen its central theme.
Return JSON only: {"title":"..."}`;
  }
  return `You are an expert AI Book Architect and Amazon KDP Publishing Specialist.
Generate ONE replacement subsection title.

${qualityRule}

CHAPTER: ${parentChapter || ""}
SECTION: ${parentSection || ""}
NICHE: ${niche}
AUDIENCE: ${audience}
CURRENT TITLE (replace): ${currentTitle}

The subsection title must be a precise, emotionally specific insight, tactic, turning point, or story angle.
It must feel like a micro-promise to the reader — something worth reading.
Return JSON only: {"title":"..."}`;
}

export function structurePrompt({ chapterTitle, chapterSummary, fullOutline, audience, tone }: any) {
  return `Create deep chapter structure for "${chapterTitle}".
Summary: ${chapterSummary}, Audience: ${audience}, Tone: ${tone}
Output JSON: {"sections":[{"title":"...","explanation":"...","subsections":[{"title":"...","strategy":"...","explanation":"...","application":"..."}]}]}
3 sections, 3 subsections each.`;
}

export function lessonPrompt({ subsection, chapterContext, previousConcepts, audience, tone }: any) {
  return `Write a complete lesson for: ${JSON.stringify(subsection)}
Chapter: ${JSON.stringify(chapterContext)}, Audience: ${audience}, Tone: ${tone}
Return JSON: {"title":"...","explanation":"...","example":"...","framework":"...","executionSteps":["..."]}`;
}

export function improvementPrompt({ action, currentText, tone }: any) {
  return `Improve the writing with action "${action}" (tone: "${tone}"). Return only the refined text.\n${currentText}`;
}

export function architecturePreviewPrompt({
  niche,
  subNiche,
  deepNiche,
  audience,
  goal,
  tones,
  contentDirection
}: any) {
  const toneLine = Array.isArray(tones) && tones.length ? tones.join(", ") : "unspecified";
  return `You are an Amazon KDP nonfiction publishing strategist.

Analyze this book concept and generate an ideal book architecture.

NICHE: ${niche || "unspecified"}
SUB NICHE: ${subNiche || "unspecified"}
DEEP NICHE FOCUS: ${deepNiche || "unspecified"}
TARGET AUDIENCE: ${audience || "unspecified"}
BOOK GOAL: ${goal || "unspecified"}
TONE: ${toneLine}
CONTENT DIRECTION (existing): ${contentDirection || "unspecified"}

Generate the ideal blueprint for THIS specific combination.

Requirements:
- adapt to the reader's psychology and emotional state in this niche
- match patterns of bestselling books in this exact sub-niche
- avoid generic, one-size-fits-all outputs — every field must feel niche-specific
- be commercially realistic (real Amazon KDP ranges, not academic)
- the emotional arc must be 4–5 stages joined with " → " using the reader's
  actual psychological journey for this niche (e.g. for self-esteem:
  "insecurity → awareness → healing → confidence → empowerment")
- structure must name a real publishing approach (framework-based,
  step-by-step, narrative arc, psychological transformation, tactical
  playbook, workbook system, habit-building, mindset rewiring,
  challenge-based, case-study driven, philosophical, devotional, etc.)
- chapters must be a realistic range like "8–12", "10–14", "15–20"
- pacing must be a real pacing label (fast actionable, progressive build,
  emotionally immersive, tactical acceleration, slow reflective,
  workbook pacing, philosophical reflection, etc.)
- wordBand must be a realistic Amazon KDP range like "15k–25k",
  "20k–35k", "35k–50k", "45k–65k"
- contentDirection is one tight sentence describing what this book's
  reading experience should feel like

Output ONLY valid JSON with this exact shape:

{
  "structure": "",
  "chapters": "",
  "emotionalArc": "",
  "pacing": "",
  "wordBand": "",
  "contentDirection": ""
}`;
}

export function competitiveIntelligencePrompt({ niche, subNiche, deepNiche, bookTopic, books }: any) {
  const bookLines = Array.isArray(books) && books.length
    ? books.slice(0, 10).map((b: any, i: number) => {
        const parts = [`${i + 1}. "${b.title || "Untitled"}"`];
        if (b.authors)       parts.push(`by ${b.authors}`);
        if (b.subtitle)      parts.push(`(${b.subtitle})`);
        if (b.rating)        parts.push(`${b.rating}★`);
        if (b.ratingsTotal)  parts.push(`${b.ratingsTotal.toLocaleString()} reviews`);
        return parts.join(" ");
      }).join("\n")
    : "(no competitor books provided — infer from niche/sub-niche)";

  return `You are an Amazon KDP publishing strategist and consumer psychology expert.

Analyze the following competitor books and extract a full publishing intelligence profile for a new book entering this market.

NICHE: ${niche || "unspecified"}
SUB-NICHE: ${subNiche || "unspecified"}
DEEP NICHE: ${deepNiche || "not specified"}
AUTHOR'S CONCEPT: ${bookTopic?.trim() || "(not specified)"}

COMPETITOR BOOKS:
${bookLines}

Based on these competitors, extract a complete publishing intelligence profile. Be specific and data-driven — every field must reflect THIS niche and these actual competitors.

Return ONLY valid JSON with this exact shape:
{
  "targetAudience": "specific 1-2 sentence description of the ideal reader for this market",
  "authorTones": ["tone1", "tone2"],
  "energyStyle": "one of: Calm mentor | Hard-hitting coach | Stoic philosopher | Masculine discipline | Inspirational motivator | Scientific thinker",
  "emotionalTriggers": ["trigger1", "trigger2", "trigger3"],
  "toneRecommendation": "specific tone strategy recommendation in 1-2 sentences",
  "readerPainProfile": "core pain/frustration the reader has BEFORE picking up a book in this niche",
  "transformationPromise": "the transformation the reader expects from a book in this market",
  "writingStyleFingerprint": "description of the ideal writing style for bestsellers in this niche",
  "positioningStrategy": "how a new book should position itself to stand out vs these specific competitors",
  "marketGapAnalysis": "what is missing or underserved based on these competitors — concrete gaps",
  "bestsellerDNA": "what structural or emotional elements make bestsellers in this niche work"
}`;
}
