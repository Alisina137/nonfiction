// ─── Shared project data extractor ───────────────────────────────────────────

function safeStr(v: any): string {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const s = v.primary || v.description || v.value ||
      (Object.values(v) as any[]).find((x: any) => typeof x === "string") || "";
    return typeof s === "string" ? s.trim() : "";
  }
  return "";
}

function extractProjectData(project: any) {
  const research  = project?.research  || {};
  const intel     = project?.analysis?.intelligence || {};
  const pb        = project?.proposedBook?.content  || {};
  const bd        = project?.bookDetails || {};
  const books     = project?.analysis?.books || [];
  const focus     = Array.isArray(project?.proposedBook?.focusTags) ? project.proposedBook.focusTags : [];
  const persona   = (() => {
    const ap = project?.authorPersona || {};
    const selId = ap.selectedId;
    if (selId && selId !== "__create_new__") {
      return (Array.isArray(ap.savedPersonas) ? ap.savedPersonas : []).find((p: any) => p.id === selId) || ap.draft || {};
    }
    return ap.draft || {};
  })();

  const title    = bd.title || research.bookTitle || project?.bookTitle?.selectedCard?.title || "";
  const subtitle = bd.subtitle || research.bookSubtitle || project?.bookTitle?.selectedCard?.subtitle || "";
  const topic    = research.bookTopic || "";
  const niche    = [research.mainNicheLabel, research.subNicheLabel, research.deepNicheLabel].filter(Boolean).join(" › ");
  const genre    = bd.genre || research.mainNicheLabel || "";
  const audience = safeStr(bd.audience) || safeStr(pb.proposedAudience) || safeStr(research.targetAudience) || safeStr(intel.targetAudience) || "";
  const tone     = bd.tone || pb.proposedTone || intel.energyStyle || "";
  const structure = bd.structure || "";

  const painProfile      = intel.readerPainProfile     || "";
  const transformation   = intel.transformationPromise || pb.proposedTransformation || "";
  const marketGap        = intel.marketGapAnalysis     || "";
  const positioningStrat = intel.positioningStrategy   || "";
  const corePromise      = bd.corePromise              || "";
  const uniqueMechanism  = bd.uniqueMechanism          || "";
  const beforeState      = bd.readerTransformationBefore || "";
  const afterState       = bd.readerTransformationAfter  || "";

  const authorArchetype   = persona?.authorArchetype   || "";
  const voiceSummary      = persona?.voiceSummary      || "";
  const coreAuthorPromise = persona?.coreAuthorPromise || "";
  const signatureFramework = persona?.signatureFramework || pb.signatureFramework?.name || "";

  const focusLine    = focus.join(", ") || "(none selected)";
  const competitorBlock = books.slice(0, 6)
    .map((b: any) => `- "${b.title || ""}"${b.author ? ` by ${b.author}` : ""}`)
    .filter((s: string) => s.length > 3)
    .join("\n") || "(none)";

  const existingDiff = pb.differentiation || "";
  const existingUSP  = pb.uniqueSellingProposition || "";

  return {
    title, subtitle, topic, niche, genre, audience, tone, structure,
    painProfile, transformation, marketGap, positioningStrat,
    corePromise, uniqueMechanism, beforeState, afterState,
    authorArchetype, voiceSummary, coreAuthorPromise, signatureFramework,
    focusLine, competitorBlock, existingDiff, existingUSP
  };
}

function projectDataBlock(d: ReturnType<typeof extractProjectData>): string {
  return `BOOK TITLE: ${d.title || "(not set)"}
SUBTITLE: ${d.subtitle || "(not set)"}
TOPIC: ${d.topic || "(not set)"}
NICHE: ${d.niche || "(not set)"}
GENRE: ${d.genre || "(not set)"}
STRUCTURE CHOSEN: ${d.structure || "(not set)"}

TARGET AUDIENCE: ${d.audience || "(not set)"}
READER PAIN PROFILE: ${d.painProfile || "(not set)"}
READER BEFORE: ${d.beforeState || "(not set)"}
READER AFTER: ${d.afterState || "(not set)"}
TRANSFORMATION PROMISE: ${d.transformation || "(not set)"}

MARKET GAP: ${d.marketGap || "(not set)"}
POSITIONING STRATEGY: ${d.positioningStrat || "(not set)"}
CORE PROMISE: ${d.corePromise || "(not set)"}
UNIQUE MECHANISM: ${d.uniqueMechanism || "(not set)"}

AUTHOR ARCHETYPE: ${d.authorArchetype || "(not set)"}
AUTHOR CORE PROMISE: ${d.coreAuthorPromise || "(not set)"}
AUTHOR VOICE SUMMARY: ${d.voiceSummary || "(not set)"}
SIGNATURE FRAMEWORK (author): ${d.signatureFramework || "(not set)"}

FOCUS TOPICS: ${d.focusLine}
TONE: ${d.tone || "(not set)"}

COMPETITOR BOOKS:
${d.competitorBlock}`;
}

// ─── Strategic Book Plan ──────────────────────────────────────────────────────

export function generateStrategicBookPlanPrompt(project: any) {
  const d = extractProjectData(project);

  return `You are a world-class publishing strategist and book architect.

Analyze ALL project data and generate a complete Strategic Book Plan — 8 components in one JSON response.
Every output must be NICHE-SPECIFIC. No generic content.

═══ PROJECT DATA ════════════════════════════════

${projectDataBlock(d)}

════════════════════════════════════════════════

Return ONLY valid JSON — no commentary, no markdown fences:

{
  "recommendedStructure": {
    "structureName": "Specific structure name e.g. Blueprint-Based How-To",
    "structureType": "Category e.g. Implementation Roadmap | Transformation Journey | Framework Guide | Conceptual Deep-Dive | Reference Manual",
    "confidenceScore": 9.4,
    "reasoning": "2–3 sentences: why this structure wins for this audience vs. competitors."
  },
  "structureExplanation": "3–4 sentences: why readers in this niche prefer this structure, why it supports the specific transformation, why it gaps competitors.",
  "signatureFramework": {
    "name": "Unique branded framework name with ™ e.g. The Campus Affiliate Blueprint™",
    "stages": [
      {"stage": "Stage 1", "label": "Foundation"},
      {"stage": "Stage 2", "label": "Niche Selection"},
      {"stage": "Stage 3", "label": "Content Creation"},
      {"stage": "Stage 4", "label": "Traffic"},
      {"stage": "Stage 5", "label": "Conversions"},
      {"stage": "Stage 6", "label": "Scaling"}
    ]
  },
  "chapterComponents": {
    "recommended": ["4–6 values from: Key Takeaways, Action Plan, Checklist, Exercises, Reflection Questions, Templates, Case Studies, Examples, Research Highlights, Resources, Summary"]
  },
  "bookFlowPreview": {
    "parts": [
      {"title": "Part 1", "subtitle": "Mindset"},
      {"title": "Part 2", "subtitle": "Foundation"},
      {"title": "Part 3", "subtitle": "Implementation"},
      {"title": "Part 4", "subtitle": "Optimization"},
      {"title": "Part 5", "subtitle": "Scaling"}
    ]
  },
  "competitiveDifferentiation": {
    "points": ["5–8 specific differentiators tailored to this book vs. competitor books listed"],
    "score": 8.8
  },
  "bookPitch": "One sentence: clear audience + clear transformation + clear positioning. Publishing-quality.",
  "bookConceptScore": {
    "overall": 94,
    "breakdown": {
      "marketDemand": 9.4,
      "differentiation": 8.8,
      "transformationStrength": 9.6,
      "readerClarity": 9.5,
      "commercialPotential": 9.3,
      "outlineReadiness": 9.7
    },
    "strengths": ["3–5 specific strengths of this book concept"],
    "suggestions": ["2–4 specific improvement suggestions"]
  }
}

RULES:
- confidenceScore, competitiveDifferentiation.score: floats 0–10 (one decimal)
- bookConceptScore.overall: integer 0–100
- bookConceptScore.breakdown values: floats 0–10 (one decimal)
- signatureFramework.stages: 4–8 stages, each with a distinct niche-specific label
- bookFlowPreview.parts: 3–6 parts matching the recommended structure and focus topics
- chapterComponents.recommended: 4–6 items from the allowed list only
- bookPitch: exactly one sentence, no ellipsis
- Everything must be specific to THIS book's niche, audience, and transformation — not generic`;
}

// ─── Regenerate single book section ──────────────────────────────────────────

const SECTION_SCHEMAS: Record<string, string> = {
  recommendedStructure: `{
  "recommendedStructure": {
    "structureName": "...",
    "structureType": "...",
    "confidenceScore": 9.4,
    "reasoning": "2–3 sentences"
  }
}`,
  structureExplanation: `{
  "structureExplanation": "3–4 sentences"
}`,
  signatureFramework: `{
  "signatureFramework": {
    "name": "Branded name with ™",
    "stages": [{"stage": "Stage N", "label": "Label"}, ...]
  }
}`,
  chapterComponents: `{
  "chapterComponents": {
    "recommended": ["4–6 from: Key Takeaways, Action Plan, Checklist, Exercises, Reflection Questions, Templates, Case Studies, Examples, Research Highlights, Resources, Summary"]
  }
}`,
  bookFlowPreview: `{
  "bookFlowPreview": {
    "parts": [{"title": "Part N", "subtitle": "Theme"}, ...]
  }
}`,
  competitiveDifferentiation: `{
  "competitiveDifferentiation": {
    "points": ["5–8 specific differentiators"],
    "score": 8.8
  }
}`,
  bookPitch: `{
  "bookPitch": "One publishing-quality sentence"
}`,
  bookConceptScore: `{
  "bookConceptScore": {
    "overall": 94,
    "breakdown": {
      "marketDemand": 9.4,
      "differentiation": 8.8,
      "transformationStrength": 9.6,
      "readerClarity": 9.5,
      "commercialPotential": 9.3,
      "outlineReadiness": 9.7
    },
    "strengths": ["3–5 specific strengths"],
    "suggestions": ["2–4 specific suggestions"]
  }
}`
};

const SECTION_INSTRUCTIONS: Record<string, string> = {
  recommendedStructure: "Determine the single best book structure for this niche, audience, and transformation. confidenceScore: float 0–10.",
  structureExplanation: "Explain in 3–4 sentences why this structure works for this specific niche, audience, transformation, and competitive landscape.",
  signatureFramework: "Generate a unique, branded proprietary framework for this book. 4–8 stages with niche-specific labels. Use ™.",
  chapterComponents: "Recommend 4–6 chapter components that best serve this audience and structure. Select from the allowed list only.",
  bookFlowPreview: "Design the book's reader journey as 3–6 thematic parts that follow the recommended structure and focus topics.",
  competitiveDifferentiation: "List 5–8 specific differentiators vs. the competitor books listed. score: float 0–10.",
  bookPitch: "Write exactly one publishing-quality sentence: clear audience + transformation + positioning.",
  bookConceptScore: "Score this book concept. overall: integer 0–100. breakdown values: floats 0–10. Specific strengths and improvement suggestions."
};

export function regenerateBookSectionPrompt(section: string, project: any) {
  const d    = extractProjectData(project);
  const schema = SECTION_SCHEMAS[section] || "{}";
  const instr  = SECTION_INSTRUCTIONS[section] || "Regenerate this section.";

  return `You are a world-class publishing strategist.

TASK: Regenerate ONLY the "${section}" section of the Strategic Book Plan.
${instr}

All output must be NICHE-SPECIFIC to this book. No generic content.

═══ PROJECT DATA ════════════════════════════════

${projectDataBlock(d)}

════════════════════════════════════════════════

Return ONLY valid JSON matching this exact schema — no commentary, no markdown:

${schema}`;
}

export function generateAuthorPersonaPrompt(project: any) {
  const research  = project?.research  || {};
  const intel     = project?.analysis?.intelligence || {};
  const pb        = project?.proposedBook?.content  || {};
  const bd        = project?.bookDetails || {};
  const books     = project?.analysis?.books || [];

  const title     = bd.title || research.bookTitle || project?.bookTitle?.selectedCard?.title || "";
  const subtitle  = bd.subtitle || "";
  const topic     = research.bookTopic || "";
  const niche     = [research.mainNicheLabel, research.subNicheLabel, research.deepNicheLabel].filter(Boolean).join(" › ");
  const audience  = bd.audience || pb.proposedAudience || research.targetAudience || intel.targetAudience || "";
  const painProfile       = intel.readerPainProfile      || "";
  const transformation    = intel.transformationPromise  || pb.proposedTransformation || "";
  const marketGap         = intel.marketGapAnalysis      || "";
  const positioningStrat  = intel.positioningStrategy    || "";
  const corePromise       = bd.corePromise               || "";
  const uniqueMechanism   = bd.uniqueMechanism           || "";
  const beforeState       = bd.readerTransformationBefore || "";
  const afterState        = bd.readerTransformationAfter  || "";
  const tone              = bd.tone || intel.energyStyle  || "";
  const structure         = bd.structure                  || "";
  const genre             = bd.genre || research.mainNicheLabel || "";
  const competitorBlock   = books.slice(0, 6)
    .map((b: any) => `- "${b.title || ""}"${b.author ? ` by ${b.author}` : ""}`)
    .filter((s: string) => s.length > 3)
    .join("\n") || "(none provided)";

  return `You are an expert author brand strategist and publishing consultant.

Analyze all of the project data below and generate a comprehensive, strategically optimized Author Persona.
Every field must be specific to THIS book and audience — never generic.

═══ PROJECT DATA ═══════════════════════════════

BOOK TITLE: ${title || "(not set)"}
SUBTITLE: ${subtitle || "(not set)"}
TOPIC: ${topic || "(not set)"}
NICHE: ${niche || "(not set)"}

TARGET AUDIENCE: ${audience || "(not set)"}
READER PAIN PROFILE: ${painProfile || "(not set)"}
TRANSFORMATION PROMISE: ${transformation || "(not set)"}
MARKET GAP: ${marketGap || "(not set)"}
POSITIONING STRATEGY: ${positioningStrat || "(not set)"}

CORE PROMISE: ${corePromise || "(not set)"}
UNIQUE MECHANISM: ${uniqueMechanism || "(not set)"}
READER BEFORE: ${beforeState || "(not set)"}
READER AFTER: ${afterState || "(not set)"}
TONE: ${tone || "(not set)"}
STRUCTURE: ${structure || "(not set)"}
GENRE: ${genre || "(not set)"}

COMPETITOR BOOKS:
${competitorBlock}

═══════════════════════════════════════════════

Based on ALL of this data, determine the OPTIMAL author persona that will:
1. Resonate most powerfully with the specific target audience
2. Differentiate clearly from competitor approaches
3. Fill the identified market gap
4. Deliver the transformation promise credibly
5. Match niche audience expectations

Return ONLY valid JSON — no commentary before or after:

{
  "authorArchetype": "ONE of: Trusted Expert | Friendly Mentor | Inspirational Motivator | Academic Researcher | Investigative Journalist | Business Strategist | Transformation Coach | Storytelling Teacher | Practical Practitioner | Thought Leader",
  "authorDescription": "2–3 sentence author bio in third person, specific to this topic and audience",
  "coreAuthorPromise": "The single sentence promise this author makes to readers (e.g. I help X achieve Y without Z)",
  "readerRelationship": "ONE of: Mentor | Coach | Teacher | Guide | Friend | Consultant | Professor",
  "signatureTeachingStyle": ["2–4 values from: Framework-Based, Step-by-Step, Checklist Driven, Case Study Driven, Story Driven, Research Driven, Exercise Driven, Blueprint Driven, Roadmap Driven"],
  "signatureElements": ["3–6 values from: Action Plans, Reflection Questions, Worksheets, Templates, Case Studies, Stories, Checklists, Quotes, Research Findings, Chapter Summaries, Key Takeaways"],
  "signatureFramework": "A proprietary framework name with trademark symbol e.g. The Campus Affiliate Blueprint™",
  "voiceSummary": "Master AI instruction: Write like a [role] who [method] for [audience]. Maintain [tone]. Use [style]. Avoid [anti-patterns].",
  "writingStyleControls": {
    "tone": 30,
    "inspiration": 50,
    "authority": 70,
    "storytelling": 40,
    "complexity": 30
  },
  "personaStrength": {
    "score": 85,
    "strengths": ["specific strength 1 tied to this book and audience", "specific strength 2", "specific strength 3"],
    "suggestions": ["specific actionable suggestion 1", "specific actionable suggestion 2"]
  },
  "dos": ["DO specific writing behavior 1 for this author", "DO specific writing behavior 2", "DO specific writing behavior 3", "DO specific writing behavior 4"],
  "donts": ["DON'T specific anti-pattern 1 for this author/audience", "DON'T specific anti-pattern 2", "DON'T specific anti-pattern 3"],
  "contentGuidelines": ["Specific content guideline 1 for this niche/audience", "Specific content guideline 2", "Specific content guideline 3", "Specific content guideline 4"],
  "writingSample": "2–3 sentence writing sample that demonstrates this author's voice speaking to the target audience about the core topic"
}

RULES for dos / donts / contentGuidelines:
- dos: 3–5 specific, actionable writing behaviors this author SHOULD always do (language, structure, framing).
- donts: 3–4 specific anti-patterns this author must NEVER do with this audience.
- contentGuidelines: 3–5 niche-specific content rules that govern what topics, depth levels, and formats are appropriate.
All must be specific to THIS book, audience, and niche — never generic.

RULES for writingStyleControls (integers 0–100):
- tone: 0 = fully Conversational, 100 = fully Formal
- inspiration: 0 = fully Practical, 100 = fully Inspirational
- authority: 0 = Peer (equal footing), 100 = Expert (authoritative)
- storytelling: 0 = Minimal (data/logic focused), 100 = Heavy (narrative driven)
- complexity: 0 = Beginner (simple vocabulary), 100 = Advanced (expert vocabulary)

personaStrength.score: integer 0–100 evaluating clarity, differentiation, audience fit, consistency, and commercial viability.
voiceSummary will be injected verbatim into every AI generation call — make it a precise, actionable master instruction.`;
}

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
  return `You are an Amazon KDP nonfiction title strategist.

USER IDEA: ${idea || "(not provided)"}

Generate exactly 3 premium nonfiction book titles for this idea.
Each title must signal practical transformation, expert authority, and commercial appeal.

TITLE RULES:
- Short, memorable, bestseller-style
- Clear audience or benefit
- Strong buyer appeal on Amazon KDP
- Avoid keyword stuffing, generic wording, or clickbait

Return ONLY valid JSON — no markdown, no code fences, no explanation before or after:
{"titles":[{"title":"First title","angle":"Audience-Focused","reason":"One short sentence."},{"title":"Second title","angle":"Transformation-Focused","reason":"One short sentence."},{"title":"Third title","angle":"Authority-Focused","reason":"One short sentence."}]}

CRITICAL: Output raw JSON only. Start your response with { and end with }.`;
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

export function coverConceptsPrompt({ title, subtitle, genre, audience, tone, corePromise, coreThesis, authorName, positioning }: any) {
  return `You are a world-class book cover art director who has designed hundreds of Amazon bestsellers across every genre.

Generate 5 COMPLETELY DIFFERENT cover concept briefs for this book. Each concept must feel like a different design agency's take — different color psychology, typography strategy, and visual hierarchy.

BOOK DETAILS:
Title: ${title}
Subtitle: ${subtitle || "(none yet)"}
Genre: ${genre || "Nonfiction"}
Audience: ${audience || ""}
Tone: ${tone || ""}
Core Promise: ${corePromise || ""}
Core Thesis: ${coreThesis || ""}
Author: ${authorName || ""}
Market Positioning: ${positioning || ""}

THE 5 FIXED CONCEPT TYPES — provide one brief per type, in this exact order:

1. type "authority" — BUSINESS BESTSELLER: Bold, structured, corporate authority. Dark background (navy, charcoal, dark slate). Heavy condensed sans-serif typography. Full-width accent bar or band as structural element. Proven, commercial, safe. Think $100M Offers, Atomic Habits, 12 Rules for Life.

2. type "premium" — PREMIUM AUTHORITY: Elegant, editorial, prestigious. MUST use a LIGHT background (cream, ivory, pale warm white — provide as "secondary" field). Dark text on light background. Thin horizontal rules framing the title. Lots of whitespace. Understated. Think The Psychology of Money, Stillness Is the Key, Man's Search for Meaning.

3. type "minimal" — MODERN MINIMALIST: Maximum impact from minimum elements. Bold solid color background. Single large geometric circle element as the dominant visual. Very few words visible. Strong use of negative space. Think The ONE Thing, Start With Why, Essentialism.

4. type "metaphor" — VISUAL METAPHOR: Concept-driven visual. Gradient or two-tone background transitioning between "bg" and "secondary". Large central hexagonal/diamond geometric symbol representing the book's core idea. Title and symbol work together. Think Thinking Fast and Slow, The Lean Startup, Zero to One.

5. type "dynamic" — CREATIVE AI CONCEPT: Unexpected, energetic. Dark background with a bold diagonal parallelogram/band in the accent color cutting across the upper portion. Title overlaid dramatically. Something a traditional designer might not immediately try. High-risk, high-reward visual impact.

For EACH concept provide:
- Colors calibrated to the book's genre, audience, and emotional target
- A compelling cover tagline (short punchy hook, 4–8 words max)
- A concise design rationale (1–2 sentences on why this works for THIS book)

CRITICAL: For "premium" concept, "secondary" must be a LIGHT color (cream, ivory, pale white like #f5f0e8 or #faf7f2). For other concepts "secondary" is a darker shade or complementary color.

Return ONLY valid JSON, no markdown:
{
  "concepts": [
    {
      "type": "authority",
      "label": "Business Bestseller",
      "bg": "#hex",
      "accent": "#hex",
      "text": "#hex",
      "secondary": "#hex",
      "tagline": "4–8 word hook",
      "designNotes": "1–2 sentences why this works"
    },
    {
      "type": "premium",
      "label": "Premium Authority",
      "bg": "#hex",
      "accent": "#hex",
      "text": "#hex",
      "secondary": "#f5f0e8",
      "tagline": "4–8 word hook",
      "designNotes": "..."
    },
    {"type":"minimal","label":"Modern Minimalist","bg":"#hex","accent":"#hex","text":"#hex","secondary":"#hex","tagline":"...","designNotes":"..."},
    {"type":"metaphor","label":"Visual Metaphor","bg":"#hex","accent":"#hex","text":"#hex","secondary":"#hex","tagline":"...","designNotes":"..."},
    {"type":"dynamic","label":"Creative AI Concept","bg":"#hex","accent":"#hex","text":"#hex","secondary":"#hex","tagline":"...","designNotes":"..."}
  ]
}`;
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

export function nicheOutlinePrompt({ research, architecture, title, description, resources, bookContext }: any) {
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
${bookContext ? `USP: ${bookContext.usp || ""}
DIFFERENTIATION: ${bookContext.differentiation || ""}
READER PAIN PROFILE: ${bookContext.readerPainProfile || ""}
READER TRANSFORMATION PROMISE: ${bookContext.transformationPromise || ""}
MARKET GAP TO FILL: ${bookContext.marketGap || ""}
WRITING STYLE BENCHMARK: ${bookContext.writingStyleFingerprint || ""}
POSITIONING STRATEGY: ${bookContext.positioningStrategy || ""}
EMOTIONAL TRIGGERS: ${bookContext.emotionalTriggers || ""}
AUTHOR BACKGROUND & STYLE: ${bookContext.authorSummary || ""}
KEY SELLING POINTS:
${bookContext.keySellingPoints || ""}
COMPETING TITLES (differentiate from these): ${bookContext.competitorTitles || ""}` : ""}
${resources ? resourcesBlock(resources, "outline") : ""}
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

/**
 * Format the compact book memory object as a prompt block.
 * All fields are already size-capped in buildBookContext on the frontend.
 */
export function subtitleSuggestPrompt({ title, niche, subNiche, bookTopic, bookContext }: any): string {
  const ctxBlock = bookContext ? bookContextBlock(bookContext) : "";
  const nicheStr = [niche, subNiche].filter(Boolean).join(" › ");
  return `Generate 5 compelling, specific book subtitles for a nonfiction book.

BOOK TITLE: "${title}"
NICHE: ${nicheStr || "(not specified)"}
CORE TOPIC: ${bookTopic || "(not specified)"}${ctxBlock}

Rules for each subtitle:
- Clearly state WHO it's for AND the specific outcome/transformation they get
- 6–14 words, no more
- Sound like an Amazon bestseller (specific, outcome-driven, emotionally resonant)
- Each must be meaningfully different in angle or audience framing
- No generic phrases: "A Guide to", "Everything You Need", "The Complete", "How to"
- No quotes around the subtitle

Return ONLY valid JSON: {"subtitles":["subtitle 1","subtitle 2","subtitle 3","subtitle 4","subtitle 5"]}`;
}

export function topicSuggestPrompt({ title, subtitle, niche, subNiche, deepNiche }: any): string {
  const nicheStr = [niche, subNiche, deepNiche].filter(Boolean).join(" › ");
  return `Write a concise book topic description for a nonfiction book.

TITLE: "${title}"${subtitle ? `\nSUBTITLE: "${subtitle}"` : ""}
NICHE: ${nicheStr || "(not specified)"}

The book topic is a 1–2 sentence description that captures:
- Exactly WHO the book is for (specific reader identity, not general)
- WHAT core problem or desire it addresses
- The specific TRANSFORMATION or outcome the reader achieves

Rules:
- 20–60 words total
- Concrete and specific, no generic phrases
- Written as a statement, not a question or list
- No quotes, no bullet points, plain prose

Return ONLY valid JSON: {"topic":"your topic description here"}`;
}

// ─── Unified KDP suggest prompt (titles / subtitles / topics) ─────────────────

export function kdpSuggestPrompt({
  action,
  mainNiche,
  subNiche,
  deepNiche,
  title,
  subtitle,
}: {
  action:    "suggest_titles" | "suggest_subtitles" | "suggest_topics";
  mainNiche: string;
  subNiche:  string;
  deepNiche?: string;
  title?:    string;
  subtitle?: string;
}): string {
  return `You are an elite Amazon KDP publishing strategist, nonfiction book positioning expert, and Amazon marketplace researcher.

INPUTS

Action:
${action}

Main Niche:
${mainNiche}

Sub-Niche:
${subNiche}

Deep Niche (Optional):
${deepNiche || ""}

Selected Title:
${title || ""}

Selected Subtitle:
${subtitle || ""}

IMPORTANT

- Main Niche and Sub-Niche are required.
- Deep Niche is optional.
- Never request additional information.
- If Deep Niche is empty, use Main Niche and Sub-Niche only.
- If Deep Niche is provided, use it to improve specificity, audience targeting, positioning, and market differentiation.
- Focus on Amazon KDP nonfiction books.
- Optimize for buyer intent and conversion potential.
- Avoid generic, vague, or AI-sounding content.
- Sound like real bestselling nonfiction books.

----------------------------------------------------
STEP 1 - MARKET ANALYSIS
----------------------------------------------------

Before generating any output, analyze the niche and infer:

- Target Audience
- Primary Problem
- Desired Outcome
- Buyer Intent
- Market Opportunity

Apply this framework:

Topic + Audience + Problem + Outcome

Examples:

Affiliate Marketing + College Students + Lack of Income + Build Online Revenue

Productivity + Entrepreneurs + Lack of Focus + Get More Done

Fitness + Women Over 40 + Slow Metabolism + Sustainable Weight Loss

----------------------------------------------------
ACTION: suggest_titles
----------------------------------------------------

If action = "suggest_titles"

Generate exactly 3 title options.

Use these title formulas:

OPTION 1
Benefit + Audience

OPTION 2
Unique Concept + Benefit

OPTION 3
Transformation-Focused Title

TITLE RULES

- Short and memorable
- Commercially attractive
- Bestseller style
- Clear audience or benefit
- Strong buyer appeal
- Avoid keyword stuffing
- Avoid generic wording
- Avoid clickbait
- Sound professional

Return JSON:

{
  "titles": [
    {
      "title": "",
      "angle": "Audience-Focused",
      "reason": ""
    },
    {
      "title": "",
      "angle": "Benefit-Focused",
      "reason": ""
    },
    {
      "title": "",
      "angle": "Transformation-Focused",
      "reason": ""
    }
  ]
}

----------------------------------------------------
ACTION: suggest_subtitles
----------------------------------------------------

If action = "suggest_subtitles"

Generate exactly 3 subtitle options for the selected title.

SUBTITLE FORMULA

Problem + Outcome + Method

Examples:

- A Practical System to Beat Procrastination, Reduce Stress, and Get More Done Every Day

- How to Build Better Habits, Stay Focused, and Achieve More Without Burnout

- Proven Strategies for Managing Your Time, Increasing Productivity, and Reaching Your Goals

SUBTITLE RULES

- Expand on the promise of the title
- Clarify the transformation
- Focus on benefits
- Sound professional
- Sound publishable
- Avoid fluff
- Avoid buzzwords
- Avoid AI-sounding language

Return JSON:

{
  "subtitles": [
    {
      "subtitle": "",
      "angle": "Benefit-Focused"
    },
    {
      "subtitle": "",
      "angle": "Problem-Solution"
    },
    {
      "subtitle": "",
      "angle": "Transformation-Focused"
    }
  ]
}

----------------------------------------------------
ACTION: suggest_topics
----------------------------------------------------

If action = "suggest_topics"

Generate exactly 3 topic descriptions.

TOPIC FORMULA

Audience + Problem + Outcome + Key Methods + Scope

TOPIC RULES

- Clearly define what the book covers
- Provide enough detail to guide outline generation
- Explain who the book is for
- Explain the problems being solved
- Explain the outcomes readers can expect
- Mention key systems, frameworks, or methods that will be taught
- Sound like a professional book concept

Generate:

OPTION 1
Beginner-Friendly

OPTION 2
Practical & Action-Oriented

OPTION 3
Comprehensive Authority Style

Return JSON:

{
  "topics": [
    {
      "topic": "",
      "style": "Beginner-Friendly"
    },
    {
      "topic": "",
      "style": "Practical & Action-Oriented"
    },
    {
      "topic": "",
      "style": "Comprehensive Authority Style"
    }
  ]
}

----------------------------------------------------
FINAL RULES
----------------------------------------------------

- Generate ONLY the content requested by the action.
- Return ONLY valid JSON.
- No markdown.
- No explanations.
- No additional text.
- No code blocks.`;
}

export function bookContextBlock(ctx: any): string {
  if (!ctx) return "";
  const lines: string[] = [];

  if (ctx.title)    lines.push(`Book: "${ctx.title}"${ctx.subtitle ? ` — ${ctx.subtitle}` : ""}`);
  if (ctx.niche && ctx.subNiche) lines.push(`Niche: ${ctx.niche} › ${ctx.subNiche}${ctx.deepNiche ? ` › ${ctx.deepNiche}` : ""}`);
  else if (ctx.niche) lines.push(`Niche: ${ctx.niche}`);
  if (ctx.bookTopic)   lines.push(`Core Topic: ${ctx.bookTopic}`);
  if (ctx.stance)      lines.push(`Author Stance: ${ctx.stance}`);
  if (ctx.standout)    lines.push(`What Makes It Stand Out: ${ctx.standout}`);
  if (ctx.audience)    lines.push(`Target Reader: ${ctx.audience}`);
  if (ctx.tone)        lines.push(`Voice & Tone: ${ctx.tone}`);
  if (ctx.genre)       lines.push(`Genre: ${ctx.genre}`);
  if (ctx.wordCountRange) lines.push(`Target Length: ${ctx.wordCountRange}`);
  if (ctx.structure)   lines.push(`Structure: ${ctx.structure}`);
  if (ctx.usp)         lines.push(`USP: ${ctx.usp}`);
  if (ctx.differentiation) lines.push(`Differentiation: ${ctx.differentiation}`);
  if (ctx.keySellingPoints) lines.push(`Key Selling Points: ${ctx.keySellingPoints}`);
  if (ctx.authorName)  lines.push(`Author: ${ctx.authorName}`);
  if (ctx.authorSummary) lines.push(`Author Style/Background: ${ctx.authorSummary}`);
  if (ctx.readerPainProfile)     lines.push(`Reader Pain Profile: ${ctx.readerPainProfile}`);
  if (ctx.transformationPromise) lines.push(`Transformation Promise: ${ctx.transformationPromise}`);
  if (ctx.marketGap)   lines.push(`Market Gap to Fill: ${ctx.marketGap}`);
  if (ctx.writingStyleFingerprint) lines.push(`Ideal Writing Style: ${ctx.writingStyleFingerprint}`);
  if (ctx.positioningStrategy) lines.push(`Positioning Strategy: ${ctx.positioningStrategy}`);
  if (ctx.emotionalTriggers) lines.push(`Emotional Triggers: ${ctx.emotionalTriggers}`);
  if (ctx.competitorTitles) lines.push(`Competing Titles: ${ctx.competitorTitles}`);

  if (!lines.length) return "";

  let block = `\n\n========================================\nBOOK MEMORY — carry this through all generation\n========================================\n${lines.join("\n")}`;

  if (Array.isArray(ctx.previousChapterSummaries) && ctx.previousChapterSummaries.length) {
    const s = ctx.previousChapterSummaries.map((c: any) => `  • ${c.title}: ${c.summary}`).join("\n");
    block += `\n\nPreviously Written Chapters (build on these — don't repeat concepts):\n${s}`;
  }

  return block;
}

// ─── Structure-Aware Writing Flows ────────────────────────────────────────────

const STRUCTURE_FLOWS: Record<string, { flow: string[]; description: string }> = {
  "step-by-step": {
    flow: ["Objective", "Why It Matters", "Step Explanation", "Execution Instructions", "Common Mistakes", "Action Task"],
    description: "Sequential skill-building — guide the reader through a concrete capability one step at a time."
  },
  "framework": {
    flow: ["Framework Component", "Concept Explanation", "Why It Exists", "How It Connects To Other Components", "Practical Application"],
    description: "Framework-driven — each subsection teaches one component of the larger system and shows how it connects."
  },
  "blueprint": {
    flow: ["Desired Outcome", "System Design", "Required Components", "Implementation Process", "Optimization"],
    description: "Blueprint — describe the end-state first, then architect the path to get there with precision."
  },
  "playbook": {
    flow: ["Situation", "Decision Process", "Tactical Actions", "Example Scenario", "Expected Results"],
    description: "Tactical playbook — give readers clear decision frameworks for real situations they'll face."
  },
  "problem-solution": {
    flow: ["Problem", "Root Cause", "Consequences", "Solution", "Application"],
    description: "Problem-solution — identify the exact pain point, dig to its root, then deliver the specific fix."
  },
  "case-study": {
    flow: ["Case Study", "Analysis", "Lessons", "Principles", "Application"],
    description: "Case study driven — lead with a real example, extract the lessons, then generalize the principles."
  },
  "story-based": {
    flow: ["Narrative", "Conflict", "Turning Point", "Insight", "Lesson", "Application"],
    description: "Story-based — open with a scene, build tension, deliver the turning point, extract the reader's lesson."
  },
  "narrative": {
    flow: ["Narrative", "Conflict", "Turning Point", "Insight", "Lesson", "Application"],
    description: "Narrative — immerse readers in story, then surface the insight that changes how they see the world."
  },
  "academic": {
    flow: ["Definition", "Theory", "Research", "Analysis", "Implications"],
    description: "Academic — rigorous definitions, theoretical grounding, research evidence, analytical depth, and implications."
  },
  "manifesto": {
    flow: ["Belief", "Challenge To Conventional Thinking", "Evidence", "New Perspective", "Call To Action"],
    description: "Manifesto — state a bold belief, challenge the status quo, back it with evidence, reframe the world, and inspire action."
  },
  "transformation": {
    flow: ["Starting Point", "Obstacles", "Discovery", "Transformation", "Outcome"],
    description: "Transformation journey — trace the reader's evolution from where they are now to who they'll become."
  },
  "workbook": {
    flow: ["Core Concept", "Why It Matters", "Instructions", "Exercise", "Reflection Prompt"],
    description: "Workbook — teach the concept, then immediately give the reader something to do and reflect on."
  },
  "how-to": {
    flow: ["Objective", "Why It Matters", "Step Explanation", "Execution Instructions", "Common Mistakes", "Action Task"],
    description: "How-to — practical, sequential, and action-oriented. Every subsection teaches a concrete skill."
  },
  "thematic": {
    flow: ["Theme Introduction", "Core Argument", "Supporting Evidence", "Real-World Illustration", "Reader Takeaway"],
    description: "Thematic — explore a theme from multiple angles, building a cumulative case for the central argument."
  }
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  "business":      "Write strategically and professionally. Use analytical precision. Be direct and results-oriented. Avoid fluff.",
  "self-help":     "Write with warmth and encouragement. Be practical and reader-focused. Use 'you' frequently. Make the reader feel capable.",
  "memoir":        "Write personally and reflectively. Use first-person narrative. Let vulnerability and honesty carry authority.",
  "academic":      "Write with rigor and precision. Cite evidence. Use formal language. Every claim must be grounded.",
  "inspirational": "Write with emotional energy. Uplift and motivate. Let transformation feel not just possible but inevitable.",
  "leadership":    "Write with authority and vision. Challenge readers to think bigger. Model strategic thinking in every sentence.",
  "conversational": "Write like a smart friend having a real conversation. Use contractions, rhetorical questions, short punchy paragraphs.",
  "philosophical": "Write with depth and contemplation. Let ideas breathe. Reference principles and invite the reader to think.",
  "scientific":    "Write evidence-first. Lead with data, support with research, conclude with implications. Be precise about uncertainty."
};

function resolveStructureFlow(structureRaw: string): { key: string; flow: string[]; description: string } {
  if (!structureRaw) return { key: "step-by-step", ...STRUCTURE_FLOWS["step-by-step"] };
  const lower = structureRaw.toLowerCase();
  for (const [key, val] of Object.entries(STRUCTURE_FLOWS)) {
    if (lower.includes(key)) return { key, ...val };
  }
  if (lower.includes("how") || lower.includes("guide"))  return { key: "how-to",        ...STRUCTURE_FLOWS["how-to"] };
  if (lower.includes("story") || lower.includes("narr")) return { key: "story-based",   ...STRUCTURE_FLOWS["story-based"] };
  if (lower.includes("play"))                             return { key: "playbook",      ...STRUCTURE_FLOWS["playbook"] };
  if (lower.includes("blue"))                             return { key: "blueprint",     ...STRUCTURE_FLOWS["blueprint"] };
  if (lower.includes("frame") || lower.includes("model")) return { key: "framework",    ...STRUCTURE_FLOWS["framework"] };
  if (lower.includes("trans"))                            return { key: "transformation", ...STRUCTURE_FLOWS["transformation"] };
  if (lower.includes("manifest"))                        return { key: "manifesto",     ...STRUCTURE_FLOWS["manifesto"] };
  if (lower.includes("case"))                            return { key: "case-study",    ...STRUCTURE_FLOWS["case-study"] };
  if (lower.includes("acad") || lower.includes("research")) return { key: "academic",  ...STRUCTURE_FLOWS["academic"] };
  if (lower.includes("work"))                            return { key: "workbook",      ...STRUCTURE_FLOWS["workbook"] };
  if (lower.includes("problem") || lower.includes("solution")) return { key: "problem-solution", ...STRUCTURE_FLOWS["problem-solution"] };
  return { key: "step-by-step", ...STRUCTURE_FLOWS["step-by-step"] };
}

function resolveToneInstruction(toneRaw: string): string {
  if (!toneRaw) return TONE_INSTRUCTIONS["self-help"];
  const lower = toneRaw.toLowerCase();
  for (const [key, instr] of Object.entries(TONE_INSTRUCTIONS)) {
    if (lower.includes(key)) return instr;
  }
  return `Write with the following voice and tone: ${toneRaw}. Maintain this tone consistently throughout.`;
}

// ─── Chapter Writing Strategy ──────────────────────────────────────────────────

export function chapterWritingStrategyPrompt({
  chapterTitle,
  chapterNumber,
  chapterPurpose,
  sectionTitles,
  bookContext,
  bookStructure,
  bookTone
}: any): string {
  const structureInfo = resolveStructureFlow(bookStructure || "");
  const toneInstr = resolveToneInstruction(bookTone || "");

  const ctx = bookContext || {};
  const contextLines: string[] = [];
  if (ctx.title)       contextLines.push(`Book: "${ctx.title}"`);
  if (ctx.audience)    contextLines.push(`Reader: ${ctx.audience}`);
  if (ctx.bookTopic)   contextLines.push(`Core Topic: ${ctx.bookTopic}`);
  if (ctx.corePromise) contextLines.push(`Core Promise: ${ctx.corePromise}`);
  if (ctx.transformation || ctx.transformationPromise)
    contextLines.push(`Reader Transformation: ${ctx.transformation || ctx.transformationPromise}`);
  const contextBlock = contextLines.length ? contextLines.join("\n") : "(not specified)";

  const sectionsBlock = Array.isArray(sectionTitles) && sectionTitles.length
    ? sectionTitles.map((s: string, i: number) => `  ${i + 1}. ${s}`).join("\n")
    : "  (not specified)";

  return `You are an elite nonfiction developmental editor and book strategist.

Before this chapter is written, generate a Chapter Writing Strategy that will guide every section and subsection in it.

The strategy must ensure:
1. Every subsection feels consistent with the book's chosen structure
2. Every section builds toward this chapter's single purpose
3. The writing style matches the book's tone
4. No two subsections repeat concepts or teaching methods
5. The reader experiences a clear emotional and intellectual arc within this chapter

════════════════════════════════════
BOOK & CHAPTER CONTEXT
════════════════════════════════════

${contextBlock}

Book Structure: ${bookStructure || "(not set)"}
Structure Writing Approach: ${structureInfo.description}
Writing Flow Pattern: ${structureInfo.flow.join(" → ")}

Tone: ${bookTone || "(not set)"}
Tone Instruction: ${toneInstr}

Chapter ${chapterNumber || ""}: ${chapterTitle || "(not set)"}
Chapter Purpose: ${chapterPurpose || "Deliver the full promise of this chapter title"}

Planned Sections:
${sectionsBlock}

════════════════════════════════════
STRATEGY OUTPUT
════════════════════════════════════

Return ONLY valid JSON — no markdown, no commentary:

{
  "chapterTheme": "The single unifying idea that all sections must reinforce",
  "chapterArc": "Reader's journey through this chapter: where they start emotionally/intellectually → where they end",
  "structureType": "${structureInfo.key}",
  "writingFlow": ${JSON.stringify(structureInfo.flow)},
  "toneGuidance": "2-sentence instruction on how to apply this chapter's tone — be specific to this topic",
  "openingStrategy": "How to open this chapter to immediately hook the reader",
  "closingStrategy": "How to close this chapter to set up the next chapter",
  "teachingMethods": ["List of 3-5 distinct teaching methods to vary across sections: e.g. anecdote, data, analogy, exercise, case study, direct instruction"],
  "conceptsToAvoid": ["Concepts that already appeared in prior chapters and must not be repeated"],
  "uniquenessDirective": "One sentence telling each subsection how to be completely distinct from its siblings",
  "readerOutcome": "What the reader will be able to think, do, or feel after completing this chapter"
}`;
}

// ─── Structure-Aware Lesson Prompt ────────────────────────────────────────────

export function lessonPrompt({
  subsection,
  chapterContext,
  previousConcepts,
  audience,
  tone,
  resources,
  bookContext,
  chapterStrategy,
  bookStructure,
  sectionTitle,
  subsectionPurpose
}: any) {
  const resBlock = resources ? resourcesBlock(resources, "lesson") : "";
  const ctxBlock = bookContext ? bookContextBlock(bookContext) : "";
  const prevNote = Array.isArray(previousConcepts) && previousConcepts.length
    ? `\nConcepts already covered (do NOT repeat): ${previousConcepts.slice(-8).join("; ")}`
    : "";

  const rawStructure = bookStructure || bookContext?.structure || chapterStrategy?.structureType || "";
  const { key: structureKey, flow, description: flowDesc } = resolveStructureFlow(rawStructure);
  const toneInstr = resolveToneInstruction(tone || bookContext?.tone || "");

  const strategyBlock = chapterStrategy ? `
════════════════════════════════════
CHAPTER WRITING STRATEGY (follow this for every subsection)
════════════════════════════════════
Chapter Theme: ${chapterStrategy.chapterTheme || ""}
Chapter Arc: ${chapterStrategy.chapterArc || ""}
Tone Guidance: ${chapterStrategy.toneGuidance || ""}
Teaching Methods Available: ${Array.isArray(chapterStrategy.teachingMethods) ? chapterStrategy.teachingMethods.join(", ") : ""}
Uniqueness Directive: ${chapterStrategy.uniquenessDirective || ""}
Reader Outcome for Chapter: ${chapterStrategy.readerOutcome || ""}
${Array.isArray(chapterStrategy.conceptsToAvoid) && chapterStrategy.conceptsToAvoid.length ? `Concepts to Avoid (already in prior chapters): ${chapterStrategy.conceptsToAvoid.join("; ")}` : ""}` : "";

  const chapterInfo = chapterContext
    ? `Chapter: ${typeof chapterContext === "string" ? chapterContext : (chapterContext.title || JSON.stringify(chapterContext))}`
    : "";
  const sectionInfo = sectionTitle ? `Section: ${sectionTitle}` : "";
  const subsectionTitle = typeof subsection === "string"
    ? subsection
    : (subsection?.title || JSON.stringify(subsection));
  const purposeNote = subsectionPurpose
    ? `\nSubsection Purpose: ${subsectionPurpose}`
    : "";

  const flowBlock = `
════════════════════════════════════
WRITING FLOW — ${structureKey.toUpperCase()} STRUCTURE
════════════════════════════════════
Structure: ${rawStructure || structureKey}
Approach: ${flowDesc}

You MUST write this subsection following this exact internal flow:
${flow.map((step, i) => `${i + 1}. ${step}`).join("\n")}

This flow determines how you organize and sequence the content.
Do NOT use a generic introduction → explanation → example → summary template.
Each section of this flow must be substantively different and add unique value.` ;

  const antiTemplateRules = `
════════════════════════════════════
ANTI-TEMPLATE RULES (non-negotiable)
════════════════════════════════════
❌ Do NOT open every subsection with a definition
❌ Do NOT end every subsection with a summary paragraph
❌ Do NOT use the same paragraph structure as other subsections
❌ Do NOT use motivational filler, clichés, or vague advice
❌ Do NOT repeat concepts already covered

✅ Vary your opening (start with a question, a scene, a fact, a provocative claim, a short story)
✅ Let the structure type shape the pacing, not a universal template
✅ Make this subsection feel DISTINCTLY different from its siblings`;

  const qualityCheck = `
════════════════════════════════════
QUALITY CHECK (verify before returning)
════════════════════════════════════
1. Does the content follow the ${structureKey} writing flow? 
2. Does the tone match: ${toneInstr.slice(0, 120)}
3. Does this subsection provide unique value not found in other subsections?
4. Is the opening varied and engaging (not a definition)?
5. Would a reader immediately notice this is a ${structureKey} book rather than a generic one?

If any answer is NO — rewrite.`;

  return `You are a professional nonfiction author and developmental editor.

Write a complete, publication-ready subsection for a nonfiction book.

════════════════════════════════════
LOCATION IN BOOK
════════════════════════════════════
${chapterInfo}
${sectionInfo}
Subsection: ${subsectionTitle}${purposeNote}

Target Reader: ${audience || "(see book context)"}
Voice & Tone: ${tone || "(see book context)"}
Tone Instruction: ${toneInstr}${prevNote}${strategyBlock}${flowBlock}${antiTemplateRules}${qualityCheck}${ctxBlock}${resBlock}

════════════════════════════════════
SUBSECTION UNIQUENESS TEST
════════════════════════════════════
Before writing, answer internally: "What unique value does this subsection provide that no other subsection provides?"
If the answer overlaps with another subsection — reframe this one's angle until it is genuinely distinct.

════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════
Return ONLY valid JSON — no markdown fences, no commentary outside the JSON:

{
  "title": "The subsection title (publication-ready, specific, compelling)",
  "structureUsed": "${structureKey}",
  "content": "The full subsection prose — multi-paragraph, written according to the ${structureKey} flow above. Minimum 350 words. Use natural paragraph breaks. Do NOT include markdown headers inside the content — write as flowing prose.",
  "flowSections": [
    ${flow.map(step => `{"label": "${step}", "text": "2-4 sentences summarizing what this flow section covers in the content"}`).join(",\n    ")}
  ],
  "keyTakeaway": "One sentence — the single most important thing the reader learns from this subsection",
  "teachingMethod": "The primary teaching method used (e.g. anecdote, data-led, analogy, direct instruction, case study, exercise)"
}`;
}

export function improvementPrompt({ action, currentText, tone, audience, bookStructure, subsectionTitle, bookContext }: any) {
  const toneInstr = resolveToneInstruction(tone || "");

  const contextLines: string[] = [];
  if (bookContext?.title)        contextLines.push(`Book: "${bookContext.title}"`);
  if (audience || bookContext?.audience)
    contextLines.push(`Target Reader: ${audience || bookContext.audience}`);
  if (bookStructure || bookContext?.structure)
    contextLines.push(`Book Structure: ${bookStructure || bookContext.structure}`);
  if (subsectionTitle)           contextLines.push(`Subsection: ${subsectionTitle}`);
  if (bookContext?.bookTopic)    contextLines.push(`Core Topic: ${bookContext.bookTopic}`);
  if (bookContext?.usp)          contextLines.push(`USP: ${bookContext.usp}`);
  if (bookContext?.authorSummary) contextLines.push(`Author Voice: ${String(bookContext.authorSummary).slice(0, 200)}`);
  const ctxBlock = contextLines.length ? contextLines.join("\n") + "\n" : "";

  const ACTION_INSTRUCTIONS: Record<string, string> = {
    sharpen:     "Rewrite for maximum clarity and precision. Remove vague language, redundancy, and motivational filler. Every sentence must earn its place. Keep the same length.",
    shorten:     "Tighten the writing by at least 20%. Cut redundancy, filler, and over-explanation. Preserve every key insight, example, and named framework.",
    expand:      "Deepen the content — add a concrete example, case study, or nuanced sub-point that the reader can immediately apply. Do NOT add filler or generic summaries. Add genuine depth only.",
    add_example: "Insert a vivid, specific, real-world example that makes the main concept tangible. Place it naturally within the existing flow. The example must be concrete, not hypothetical.",
  };
  const instruction = ACTION_INSTRUCTIONS[action] || `Apply the following refinement: "${action}".`;

  return `You are a professional nonfiction editor refining a single book section.

════════════════════════════════════
BOOK CONTEXT
════════════════════════════════════
${ctxBlock}Voice & Tone: ${tone || "Direct & practical"}
Tone Instruction: ${toneInstr}

════════════════════════════════════
EDITING ACTION
════════════════════════════════════
${instruction}

════════════════════════════════════
EDITING RULES (non-negotiable)
════════════════════════════════════
- Match the existing voice, tone, and reading level exactly — do NOT shift register
- Do NOT change the structural purpose of the section
- Do NOT add a generic summary paragraph or motivational closer at the end
- Do NOT introduce markdown headers inside the prose
- Preserve any specific examples, data points, named frameworks, or statistics already present
- The refined text must feel like it belongs in a book with the context above

════════════════════════════════════
TEXT TO IMPROVE
════════════════════════════════════
${currentText}

Return ONLY the refined prose — no commentary, no JSON, no metadata.`;
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

export function titleCardsPrompt({
  research, competitorSummaries, intelligence, mode
}: any) {
  const nicheLine = research.mainNicheLabel && research.subNicheLabel
    ? `${research.mainNicheLabel} › ${research.subNicheLabel}`
    : research.genre?.trim() || "Nonfiction";
  const deepNiche = research.deepNicheLabel?.trim() || "";

  const summariesBlock = Array.isArray(competitorSummaries) && competitorSummaries.length
    ? competitorSummaries.slice(0, 6).map((l: string, i: number) => `${i + 1}. ${l}`).join("\n")
    : "(none)";

  const intelBlock = intelligence ? `
TARGET AUDIENCE: ${intelligence.targetAudience || ""}
READER PAIN: ${intelligence.readerPainProfile || ""}
EMOTIONAL TRIGGERS: ${(intelligence.emotionalTriggers || []).join(", ")}
TRANSFORMATION PROMISE: ${intelligence.transformationPromise || ""}
BESTSELLER DNA: ${intelligence.bestsellerDNA || ""}
WRITING STYLE: ${intelligence.writingStyleFingerprint || ""}
POSITIONING STRATEGY: ${intelligence.positioningStrategy || ""}
MARKET GAP: ${intelligence.marketGapAnalysis || ""}`.trim()
    : "(not available — infer all signals from niche and competitor data)";

  const modeMap: Record<string, string> = {
    "bestseller":          "Commercial bestseller style — audience-named, transformation-forward, commercially polished. Like Atomic Habits, Deep Work, Can't Hurt Me.",
    "masculine-authority": "Masculine authority — strong, disciplined, direct, no-nonsense. For ambitious men, leaders, high-performers. Commands respect.",
    "emotional-transform": "Emotional transformation — vulnerability + hope + clear outcome. Feeling-forward, personal journey, empathy-driven.",
    "scientific":          "Scientific/evidence-based — credibility signals, 'research-backed', 'the psychology of', 'the science of'. Analytical reader.",
    "minimalist-premium":  "Minimalist premium — very short titles (2-4 words), elegant, timeless feel. Like 'Stillness Is the Key', 'Essentialism', 'Deep Work'.",
    "bold-controversial":  "Bold/controversial — challenges assumptions, disrupts conventions, provocative framing. Grabs attention and sparks debate.",
    "philosophical":       "Philosophical/wisdom — stoic or reflective, timeless principles, ancient meets modern. Contemplative, thoughtful readers.",
    "viral-modern":        "Viral modern self-help — Gen Z / millennial resonance, TikTok-friendly, conversational, identity-based. Feels current."
  };
  const modeInstruction = modeMap[mode] || modeMap["bestseller"];

  return `You are an Amazon KDP bestseller-title strategist and consumer psychology expert.

Generate 6 premium nonfiction title packages. Produce differentiated titles — vary patterns, categories, and emotional angles. Make each one genuinely distinct.

STYLE MODE: ${mode || "bestseller"}
MODE INSTRUCTION: ${modeInstruction}

BOOK PROFILE:
- NICHE: ${nicheLine}${deepNiche ? ` › ${deepNiche}` : ""}
- CONCEPT: ${research.bookTopic?.trim() || deepNiche || nicheLine}
- TRANSFORMATION: ${research.stanceOnTopic?.trim() || "(infer from niche)"}
- CUSTOM NOTES: ${research.standout?.trim() || "(none)"}
- COMPETITORS:
${summariesBlock}

MARKET INTELLIGENCE:
${intelBlock}

SCORING RULES (must follow):
- Scores should realistically vary — not all titles score equally. Range: 55-97.
- A title can be strong on SEO but weaker on emotion, or vice versa. Reflect real tradeoffs.
- isRecommended: true on the SINGLE best overall title only.
- Use at least 3 different categories across the 6 cards.

TITLE RULES:
- Every title must name or strongly imply a specific audience
- No generic patterns: "Better Habits", "Success Blueprint", "Confidence Reset", "Motivation Mastery"
- Commercially polished — feels like a $9.99 Amazon bestseller
- Mix these patterns across the 6 titles: "Transformation for Audience" | "System for Audience" | "Identity Label" | "The [Noun] of [Topic]" | "Art/Science of [Topic]"

Return STRICT JSON only — no markdown, no text outside the JSON:
{
  "cards": [
    {
      "title": "...",
      "subtitle": "A [Adjective] System for [Transformation] Without [Pain]",
      "subtitleOptions": [
        {"style": "SEO", "text": "keyword-rich subtitle with search terms"},
        {"style": "Emotional", "text": "feeling-forward subtitle"},
        {"style": "Minimalist", "text": "short elegant subtitle (max 8 words)"}
      ],
      "seoScore": 84,
      "emotionalScore": 91,
      "clickabilityScore": 88,
      "audienceMatch": 93,
      "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
      "toneProfile": ["calm authority", "masculine mentor"],
      "pattern": "Transformation for Audience",
      "category": "Masculine Authority",
      "hook": "One punchy sentence on why someone would impulse-buy this.",
      "audienceResonance": ["ambitious men 25-45", "entrepreneurs", "stoicism readers"],
      "isRecommended": false
    }
  ]
}

Valid categories: "Masculine Authority" | "Emotional Transformation" | "Premium Minimalist" | "Scientific Authority" | "Viral Modern" | "Philosophical Wisdom" | "Bold Challenger"
Valid patterns: "Transformation for Audience" | "System for Audience" | "Identity Label" | "How to [Outcome]" | "The [Noun] of [Topic]" | "Art/Science of [Topic]"`;
}

export function kdpPositioningTitlesPrompt({ research }: any) {
  const mainNiche  = research.mainNicheLabel?.trim() || "";
  const subNiche   = research.subNicheLabel?.trim()  || "";
  const deepNiche  = research.deepNicheLabel?.trim()  || "";

  return `You are an elite Amazon KDP publishing strategist, nonfiction book positioning expert, and Amazon marketplace researcher.

INPUTS

Main Niche:
${mainNiche}

Sub-Niche:
${subNiche}

Deep Niche (Optional):
${deepNiche || "(not provided)"}

IMPORTANT

- Main Niche and Sub-Niche are required inputs.
- Deep Niche is optional.
- Generate titles when Main Niche and Sub-Niche are available.
- If Deep Niche is empty, generate titles using only Main Niche and Sub-Niche.
- If Deep Niche is provided, use it to improve audience targeting, specificity, positioning, and market differentiation.
- Never request Deep Niche before generating titles.
- Never fail because Deep Niche is missing.

TASK

Step 1

Analyze the provided niche information and infer:

- Target Audience
- Primary Problem
- Desired Outcome
- Buyer Intent
- Market Opportunity

Step 2

Apply this positioning framework:

Topic + Audience + Problem + Outcome

Examples:

Affiliate Marketing + College Students + Lack of Income + Build Online Revenue

Productivity + Entrepreneurs + Lack of Focus + Get More Done

Fitness + Women Over 40 + Slow Metabolism + Sustainable Weight Loss

Step 3

Generate exactly 3 commercially attractive nonfiction book title options.

Each option must use a different positioning angle:

Title #1
Outcome-Focused

Title #2
Problem-Solution Focused

Title #3
Audience-Focused

TITLE RULES

- Sound like a real bestselling Amazon nonfiction book.
- Focus on reader benefits and transformation.
- Avoid generic wording.
- Avoid AI-sounding phrases.
- Avoid clickbait.
- Avoid vague promises.
- Prefer specificity over broadness.
- Make titles memorable and commercially attractive.
- Optimize for buyer intent and conversion.
- Differentiate from common competing titles.
- Use Deep Niche only when it strengthens positioning.

SUBTITLE RULES

- Clarify the promise.
- Expand on the transformation.
- Include audience, problem, or outcome when appropriate.
- Sound professional and publishable.

OUTPUT FORMAT

Return ONLY valid JSON — no markdown fences, no commentary:
[
  {
    "title": "",
    "subtitle": "",
    "angle": "Outcome-Focused",
    "targetAudience": "",
    "problem": "",
    "desiredOutcome": "",
    "reason": ""
  },
  {
    "title": "",
    "subtitle": "",
    "angle": "Problem-Solution Focused",
    "targetAudience": "",
    "problem": "",
    "desiredOutcome": "",
    "reason": ""
  },
  {
    "title": "",
    "subtitle": "",
    "angle": "Audience-Focused",
    "targetAudience": "",
    "problem": "",
    "desiredOutcome": "",
    "reason": ""
  }
]`;
}

export function titleVariationsPrompt({ title, subtitle, research, intelligence }: any) {
  const nicheLine = research?.mainNicheLabel && research?.subNicheLabel
    ? `${research.mainNicheLabel} › ${research.subNicheLabel}`
    : research?.genre || "Nonfiction";

  return `You are an Amazon KDP title strategist.
Create 6 powerful variations of this title, each with a meaningfully distinct style.

ORIGINAL TITLE: "${title}"
ORIGINAL SUBTITLE: "${subtitle || "(none)"}"
NICHE: ${nicheLine}
AUDIENCE: ${intelligence?.targetAudience || research?.targetAudience || "(infer from niche)"}
PAIN: ${intelligence?.readerPainProfile || "(infer from niche)"}
TRANSFORMATION: ${intelligence?.transformationPromise || research?.stanceOnTopic || "(infer)"}

Generate exactly these 6 styles — each must feel noticeably different from the original and from each other:
1. Bolder — more aggressive, challenging, confrontational wording
2. Premium — shorter, elevated, timeless (2-4 words ideal)
3. SEO — keyword-rich but still emotionally compelling
4. Emotional — vulnerability + hope + clear transformation promise
5. Modern Viral — Gen Z / TikTok-friendly energy, conversational
6. Philosophical — timeless wisdom angle, stoic or reflective

Return STRICT JSON only:
{
  "variations": [
    {"style": "Bolder", "title": "...", "subtitle": "...", "note": "one sentence on why this works"},
    {"style": "Premium", "title": "...", "subtitle": "...", "note": "..."},
    {"style": "SEO", "title": "...", "subtitle": "...", "note": "..."},
    {"style": "Emotional", "title": "...", "subtitle": "...", "note": "..."},
    {"style": "Modern Viral", "title": "...", "subtitle": "...", "note": "..."},
    {"style": "Philosophical", "title": "...", "subtitle": "...", "note": "..."}
  ]
}`;
}

// ─── Resource helpers ─────────────────────────────────────────────────────────

/**
 * Build a compact, priority-ordered resources block for prompt injection.
 * @param resources  The project's resources object (links, findings, files, settings)
 * @param context    Which prompt context: "outline" | "lesson" | "all"
 */
export function resourcesBlock(resources: any, context: "outline" | "lesson" | "all" = "all"): string {
  if (!resources) return "";
  const { links = [], findings = [], files = [] } = resources;
  const all = [
    ...links.map((r: any) => ({ ...r, _rtype: "link" })),
    ...findings.map((r: any) => ({ ...r, _rtype: "finding" })),
    ...files.map((r: any) => ({ ...r, _rtype: "file" }))
  ];
  if (!all.length) return "";

  const contextAllowed: Record<string, string[]> = {
    outline: ["entire_book", "outline_only"],
    lesson:  ["entire_book", "statistics", "quotes", "research_only"],
    all:     ["entire_book", "outline_only", "writing_style", "statistics", "quotes", "research_only"]
  };
  const allowed = contextAllowed[context] || contextAllowed.all;

  const filtered = all.filter((r: any) => {
    const useFor: string[] = Array.isArray(r.useFor) ? r.useFor : ["entire_book"];
    return useFor.some((u: string) => allowed.includes(u));
  });
  if (!filtered.length) return "";

  const PRIO: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  filtered.sort((a: any, b: any) => (PRIO[a.priority] ?? 2) - (PRIO[b.priority] ?? 2));

  const lines: string[] = [];
  for (const r of filtered.slice(0, 8)) {
    const prio    = r.priority === "critical" ? " [CRITICAL]" : r.priority === "high" ? " [HIGH]" : "";
    const title   = r.title || r.label || r.originalName || r._rtype;
    const content = String(r.summary || r.body || r.note || (r._rtype === "link" ? r.url : "")).slice(0, 250);
    if (!content) continue;
    const style   = r.isStyleRef ? " [Writing Style Reference]" : "";
    const useNote = Array.isArray(r.useFor) && r.useFor.length && !r.useFor.includes("entire_book")
      ? ` [Focus: ${r.useFor.join(", ")}]` : "";
    lines.push(`• ${title}${prio}${style}${useNote}: ${content}`);
  }
  if (!lines.length) return "";

  const cite = resources.settings?.citation;
  const citeNote = cite?.style && cite.style !== "none"
    ? `\n[Citation format: ${cite.style.toUpperCase()}${cite.inline ? ", inline" : ""}${cite.bibliography ? ", bibliography" : ""}]`
    : "";
  return `\n\nAuthor's Research Resources (priority-ordered):\n${lines.join("\n")}${citeNote}`;
}

/**
 * Prompt for extracting key insights from a resource's text content.
 */
export function extractResourcePrompt({ text, title, category }: any): string {
  const truncated = String(text || "").slice(0, 5000);
  return `Extract the most valuable information from this ${category || "resource"} titled "${title || "Untitled"}".

Content:
${truncated}

Return a concise extraction with only the sections that have content:
**Key Insights** — 3-5 bullet points of the most important takeaways
**Statistics** — specific data points, percentages, or numbers worth citing
**Notable Quotes** — verbatim phrases worth preserving verbatim
**Frameworks / Models** — any named systems, processes, or structured approaches

Keep the total response under 350 words. Be specific and factual. Do not add commentary.`;
}

export function generateFindingPrompt({ bookContext, category, priority, useFor, existingFindings, competitorBooks }: any) {
  const ctx = bookContext || {};
  const existing = Array.isArray(existingFindings) ? existingFindings : [];
  const bc = Array.isArray(competitorBooks) ? competitorBooks : [];

  const categoryGuidance: Record<string, string> = {
    academic_paper:  "Generate a research summary: key findings, implications, and evidence-based insights from academic literature relevant to this book's topic.",
    research_study:  "Generate a study summary: methodology overview, key findings, practical implications, and how this applies to the book's core argument.",
    gov_report:      "Generate a report summary: key statistics, demographic trends, policy findings, and data points directly useful for the book.",
    statistics:      "Generate a statistics finding: key metrics, trends, quantitative findings, and how to use these numbers persuasively in the manuscript.",
    competitor_book: "Generate a competitive analysis: this competitor's positioning, core strengths, weaknesses, gaps the author can exploit, and structural insights worth borrowing or avoiding.",
    book:            "Generate a book analysis: core concepts, major frameworks, lessons learned, and ideas the author can reference, adapt, or build upon.",
    writing_style:   "Generate a style observation: tone characteristics, voice patterns, sentence structure, readability techniques, and stylistic elements to emulate or contrast.",
    interview:       "Generate an interview analysis: notable insights, recurring themes, useful observations, and any memorable quotes or examples worth referencing.",
    blog_article:    "Generate an article analysis: key arguments, supporting evidence, useful ideas, and notable observations that strengthen the book's thesis.",
    case_study:      "Generate a case study breakdown: the situation, key actions taken, outcomes achieved, and lessons directly applicable to the book's readers.",
    note:            "Generate a research insight: a valuable principle, finding, or concept that should be woven into the book. Expand the idea with evidence and application guidance.",
    other:           "Generate the most useful research finding possible for this specific book project. Be creative and specific."
  };

  const priorityDepth: Record<string, string> = {
    critical: "Highly detailed, deeply actionable, ready for direct manuscript use. Include specific data points, evidence, and concrete application guidance.",
    high:     "Detailed and actionable. Provide strong analysis with specific examples and clear manuscript application.",
    medium:   "Moderate detail. Provide useful context and supporting analysis.",
    low:      "Brief and supplemental. Concise supporting notes with key takeaways."
  };

  const useForFocus: Record<string, string> = {
    entire_book:   "Make this broadly useful across the full manuscript.",
    outline_only:  "Focus on chapter ideas, structural insights, and organizational guidance.",
    writing_style: "Focus on voice, tone, flow, and readability insights.",
    statistics:    "Focus on data, metrics, trends, and quantitative evidence.",
    quotes:        "Highlight memorable quotes, anecdotes, and story-worthy moments.",
    research_only: "Deep research focus — evidence, citations, methodological detail."
  };

  const useForList = (Array.isArray(useFor) ? useFor : ["entire_book"])
    .map((u: string) => useForFocus[u] || u)
    .join(" ");

  const competitorList = bc.length
    ? bc.slice(0, 6).map((b: any, i: number) =>
        `${i + 1}. "${b.title || "Untitled"}"${b.authors ? ` by ${b.authors}` : ""}`
      ).join("\n")
    : "(none)";

  const existingList = existing.length
    ? existing.slice(0, 12).map((f: any) =>
        `- ${f.label || f.title || "(untitled)"}`
      ).join("\n")
    : "(none yet)";

  const categoryKey = (category as string) || "note";
  const priorityKey = (priority as string) || "medium";

  return `You are a professional nonfiction research assistant. Generate a single, highly relevant research finding for a nonfiction book project.

BOOK PROJECT:
Title: ${ctx.title || "not set"}
Subtitle: ${ctx.subtitle || ""}
Topic: ${ctx.bookTopic || ""}
Niche: ${ctx.niche || ""}${ctx.subNiche ? ` › ${ctx.subNiche}` : ""}${ctx.deepNiche ? ` › ${ctx.deepNiche}` : ""}
Audience: ${ctx.audience || ""}
Tone: ${ctx.tone || ""}
Transformation Promise: ${ctx.transformationPromise || ""}
Reader Pain: ${ctx.readerPainProfile || ""}
Market Gap: ${ctx.marketGap || ""}
Positioning: ${ctx.positioningStrategy || ""}
Writing Style Fingerprint: ${ctx.writingStyleFingerprint || ""}

COMPETITOR BOOKS:
${competitorList}

EXISTING FINDINGS (do NOT duplicate these topics):
${existingList}

FINDING REQUEST:
Category: ${categoryKey}
Priority: ${priorityKey} — ${priorityDepth[priorityKey] || ""}
Focus: ${useForList}

CATEGORY INSTRUCTION: ${categoryGuidance[categoryKey] || categoryGuidance.note}

CONTENT REQUIREMENTS:
- Directly related to THIS specific book project — not generic advice
- Written as professional nonfiction research notes
- Structured and easy to scan (use short paragraphs, bold key terms, bullet lists where helpful)
- Actionable and specific — include concrete examples or data where possible
- Unique — do not repeat existing findings
- Target length: 300–800 words for the content field

OUTPUT FORMAT — use exactly this structure, nothing before or after:

TITLE: <concise, specific finding title — like a published research headline>
CONTENT:
<full finding content — structured, actionable, book-ready research notes>

Do NOT wrap in JSON, markdown fences, or any other formatting. Start with "TITLE:" on the first line.`;
}

export function generateResourcePrompt({ bookContext, category, priority, useFor, existingResources, competitorBooks }: any) {
  const ctx = bookContext || {};
  const bc = Array.isArray(competitorBooks) ? competitorBooks : [];
  const existing = Array.isArray(existingResources) ? existingResources : [];

  const categoryDescriptions: Record<string, string> = {
    academic_paper:  "peer-reviewed papers, PubMed articles, NIH resources, university research, journal publications — for scientific evidence and citations",
    research_study:  "research studies, meta-analyses, systematic reviews, behavioral or industry studies — for evidence-based insights",
    gov_report:      "CDC, NIH, WHO, OECD, Bureau of Labor Statistics, or similar government publications — for trusted data and statistics",
    statistics:      "surveys, industry reports, public datasets, national studies, research dashboards — for charts, numbers, data points",
    competitor_book: "books from the competitor analysis — rank by relevance, pick one not already added, explain how to use it",
    book:            "influential nonfiction books, bestselling references relevant to the topic — for research and framework development",
    writing_style:   "books, articles, or authors whose style matches the desired tone — for voice, flow, and writing quality",
    interview:       "podcast transcripts, TED Talks, expert interviews, researcher discussions — for stories, examples, and quotes",
    blog_article:    "high-quality long-form content from Harvard Business Review, Psychology Today, Farnam Street, McKinsey, or industry authorities",
    case_study:      "business case studies, personal transformation stories, academic or organizational examples — for real-world proof",
    note:            "a valuable research insight or principle — NO URL REQUIRED, generate a key finding to weave into the book",
    other:           "the best available source based on book context and topic"
  };

  const priorityDescriptions: Record<string, string> = {
    critical: "the single most authoritative and relevant source available — highest research quality",
    high:     "most authoritative, trusted, and relevant source available",
    medium:   "balanced relevance and accessibility",
    low:      "supplementary supporting material"
  };

  const useForDescriptions: Record<string, string> = {
    entire_book:   "foundational resources that support the whole manuscript",
    outline_only:  "resources focused on frameworks, structures, and organization",
    writing_style: "stylistic references and exemplary authors",
    statistics:    "quantitative data sources",
    quotes:        "interview, transcript, speech, and quote-rich sources",
    research_only: "deep research and evidence-based material"
  };

  const useForList = (Array.isArray(useFor) ? useFor : ["entire_book"])
    .map((u: string) => useForDescriptions[u] || u)
    .join("; ");

  const competitorList = bc.length
    ? bc.slice(0, 8).map((b: any, i: number) =>
        `${i + 1}. "${b.title || "Untitled"}"${b.authors ? ` by ${b.authors}` : ""}${b.asin ? ` (ASIN: ${b.asin})` : ""}`
      ).join("\n")
    : "(none discovered)";

  const existingList = existing.length
    ? existing.slice(0, 20).map((r: any) =>
        `- ${r.label || r.title || ""}${r.url ? `: ${r.url}` : ""}`
      ).join("\n")
    : "(none yet)";

  const categoryKey = (category as string) || "other";
  const priorityKey = (priority as string) || "medium";
  const isNoteCategory = categoryKey === "note";
  const isCompetitorBook = categoryKey === "competitor_book";

  return `You are an AI research librarian helping to build a high-quality nonfiction book. Recommend ONE specific, highly relevant resource.

BOOK PROJECT:
Title: ${ctx.title || "not set"}
Subtitle: ${ctx.subtitle || ""}
Topic: ${ctx.bookTopic || ""}
Niche: ${ctx.niche || ""}${ctx.subNiche ? ` › ${ctx.subNiche}` : ""}${ctx.deepNiche ? ` › ${ctx.deepNiche}` : ""}
Audience: ${ctx.audience || ""}
Tone: ${ctx.tone || ""}
Transformation Promise: ${ctx.transformationPromise || ""}
Reader Pain: ${ctx.readerPainProfile || ""}
Market Gap: ${ctx.marketGap || ""}
Positioning: ${ctx.positioningStrategy || ""}

COMPETITOR BOOKS DISCOVERED:
${competitorList}

ALREADY ADDED RESOURCES — do NOT recommend these:
${existingList}

REQUEST:
Category: ${categoryKey} — ${categoryDescriptions[categoryKey] || "best available source"}
Priority: ${priorityKey} — ${priorityDescriptions[priorityKey] || ""}
Purpose: ${useForList}

${isCompetitorBook ? "COMPETITOR BOOK RULE: Only recommend a book from the 'COMPETITOR BOOKS DISCOVERED' list. Pick the most relevant one not already in the added resources list. If all are added, recommend the closest published rival in the same niche." : ""}
${isNoteCategory ? "NOTE/FINDING RULE: Generate a valuable insight, principle, or finding — NOT a URL. Leave url as empty string \"\"." : "URL RULE: Only use real, verifiable URLs. Never fabricate deep links. If a specific page URL is uncertain, use the authoritative domain (e.g. https://pubmed.ncbi.nlm.nih.gov) rather than a fake path."}

Return ONLY valid JSON:
{
  "url": "${isNoteCategory ? "" : "<real URL or empty string>"}",
  "label": "<descriptive title for this resource>",
  "note": "<1-2 sentences: exactly how to use this in the book>"
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

  return `You are an elite Amazon KDP market researcher, publishing strategist, reader psychology expert, and competitive intelligence analyst.

Your mission is to analyze:

1. The selected niche
2. The selected sub-niche
3. The selected deep niche
4. All competitor books provided by the user
5. Current market signals and reader demand patterns

Your goal is to produce a comprehensive market intelligence report that will be used to automatically power all downstream book-generation steps.

INPUTS

Main Niche:
${niche || "unspecified"}

Sub-Niche:
${subNiche || "unspecified"}

Deep Niche:
${deepNiche || "not specified"}

Competitor Books:
${bookLines}

--------------------------------------------------
ANALYSIS OBJECTIVES
--------------------------------------------------

Analyze the market and determine:

- What readers are actively seeking
- What problems readers want solved
- What outcomes readers desire
- What promises perform best
- What angles competitors overuse
- What gaps exist in the market
- What opportunities exist for differentiation

--------------------------------------------------
GENERATE THE FOLLOWING
--------------------------------------------------

1. TARGET AUDIENCE

Identify:

- Primary audience
- Secondary audience
- Experience level
- Demographics
- Motivations

--------------------------------------------------

2. READER PAIN POINTS

Generate:

- Top 10 frustrations
- Top 10 challenges
- Top 10 fears
- Top 10 obstacles

--------------------------------------------------

3. DESIRED OUTCOMES

Generate:

- Top 10 transformations readers want
- Top 10 goals readers want to achieve
- Top 10 benefits readers expect

--------------------------------------------------

4. BUYER INTENT ANALYSIS

Determine:

- Why readers buy books in this niche
- What triggers purchasing decisions
- What language resonates most
- What promises attract attention

--------------------------------------------------

5. MARKET GAPS

Identify:

- Topics competitors ignore
- Underserved audiences
- Weak areas in competing books
- Missed opportunities

--------------------------------------------------

6. UNIQUE SELLING PROPOSITIONS

Generate 5 potential USPs.

For each USP provide:

- USP statement
- Why it stands out
- Why readers would care

--------------------------------------------------

7. POSITIONING STRATEGIES

Generate 5 positioning angles.

Examples:

- Beginner-Friendly
- Fast Results
- Step-by-Step Framework
- Scientific Approach
- Real-World Practicality

--------------------------------------------------

8. COMPETITOR ANALYSIS

Analyze competitor books and identify:

- Common themes
- Common promises
- Common weaknesses
- Repeated messaging
- Strengths worth emulating
- Opportunities to improve

--------------------------------------------------

9. RECOMMENDED BOOK STRUCTURE

Generate:

- Recommended number of chapters
- Recommended chapter progression
- Key topics to cover
- Essential concepts
- Bonus chapter opportunities

--------------------------------------------------

10. READER PSYCHOLOGY

Identify:

- Reader desires
- Reader fears
- Reader motivations
- Reader objections
- Emotional triggers

--------------------------------------------------

11. TITLE INSIGHTS

Generate:

- Best title style
- Best subtitle style
- Best positioning approach
- Recommended transformation promise

--------------------------------------------------

12. AUTHOR PERSONA GUIDANCE

Recommend:

- Author voice
- Tone
- Credibility style
- Writing approach

--------------------------------------------------

13. BOOK DIFFERENTIATION STRATEGY

Explain:

- What will make this book different
- Why readers would choose it
- How it can outperform competitors

--------------------------------------------------

14. OUTLINE GENERATION BRIEF

Create a concise blueprint that future outline generation should follow.

--------------------------------------------------

OUTPUT FORMAT

Return ONLY valid JSON. No markdown. No explanations. No additional text.

{
  "targetAudience": {},
  "readerPainPoints": [],
  "desiredOutcomes": [],
  "buyerIntent": {},
  "marketGaps": [],
  "uniqueSellingPropositions": [],
  "positioningStrategies": [],
  "competitorAnalysis": {},
  "recommendedBookStructure": {},
  "readerPsychology": {},
  "titleInsights": {},
  "authorPersonaGuidance": {},
  "bookDifferentiationStrategy": {},
  "outlineGenerationBrief": {}
}`;
}

// ─── Generate Details (Book Details step auto-fill) ────────────────────────

export function generateDetailsPrompt(project: any): string {
  const r     = project?.research               || {};
  const intel = project?.analysis?.intelligence || {};
  const pb    = project?.proposedBook?.content  || {};
  const bd    = project?.bookDetails            || {};
  const bt    = project?.bookTitle              || {};
  const ap    = project?.authorPersona          || {};
  const saved = Array.isArray(ap.savedPersonas) ? ap.savedPersonas : [];
  const pid   = ap.selectedId;
  const persona = pid ? saved.find((p: any) => p.id === pid) || saved[0] : saved[0];

  const titleVal =
    bt?.selectedCard?.title?.trim() || pb.title?.trim() || r.bookTitle?.trim() || "(not set)";

  const subtitleVal =
    bd.subtitle?.trim() || bt?.selectedCard?.subtitle?.trim() || r.bookSubtitle?.trim() || "";

  const personaBlock = persona
    ? [
        persona.generated?.summary,
        persona.generated?.voice?.tone && `Voice tone: ${persona.generated.voice.tone}`,
        persona.generated?.voice?.mood && `Voice mood: ${persona.generated.voice.mood}`,
        persona.generated?.style?.pacing && `Pacing: ${persona.generated.style.pacing}`,
        persona.generated?.style?.sentenceStructure && `Sentences: ${persona.generated.style.sentenceStructure}`
      ].filter(Boolean).join("\n")
    : "(not generated)";

  const findingsBlock = (() => {
    const findings = project?.findings;
    if (!findings || typeof findings !== "object") return "(none)";
    const entries = Object.values(findings) as any[];
    return entries.slice(0, 6)
      .map((f: any) => `• ${f.title || ""}: ${String(f.content || "").slice(0, 120)}`)
      .join("\n") || "(none)";
  })();

  const resourcesBlock = (() => {
    const links = project?.resources?.links;
    if (!Array.isArray(links) || !links.length) return "(none)";
    return links.slice(0, 5)
      .map((l: any) => `• ${l.label || l.url || "link"}: ${(l.note || "").slice(0, 100)}`)
      .join("\n");
  })();

  const competitorBlock = (() => {
    const books = project?.analysis?.books;
    if (!Array.isArray(books) || !books.length) return "(none)";
    return books.slice(0, 5)
      .map((b: any) => `• "${b.title}" by ${b.author || "unknown"} — ${String(b.description || "").slice(0, 80)}`)
      .join("\n");
  })();

  const existingFields = [
    bd.genre               && `Genre: ${bd.genre}`,
    bd.structure           && `Structure: ${bd.structure}`,
    bd.tone                && `Tone: ${bd.tone}`,
    bd.audience            && `Audience: ${bd.audience}`,
    bd.wordCountRange      && `Word count: ${bd.wordCountRange}`,
    bd.chapterCount        && `Chapters: ${bd.chapterCount}`,
    bd.researchIntensity   && `Research intensity: ${bd.researchIntensity}`,
    bd.uniqueSellingProposition?.trim() && `USP (preserve unless weak): ${bd.uniqueSellingProposition.slice(0, 120)}`,
    bd.readerPainPoints?.trim()         && `Pain points (preserve unless weak): ${bd.readerPainPoints.slice(0, 120)}`,
    bd.corePromise?.trim()              && `Core promise already set: ${bd.corePromise.slice(0, 120)}`,
    bd.coreThesis?.trim()               && `Core thesis already set: ${bd.coreThesis.slice(0, 120)}`
  ].filter(Boolean).join("\n");

  return `You are an elite nonfiction publishing strategist and senior publishing consultant.

Analyze ALL project data below and generate a complete strategic Details profile for this book.
Return ONLY valid JSON — no prose, no markdown, no code fences.

═══════════════════════════
PROJECT DATA
═══════════════════════════

BOOK TITLE: ${titleVal}
SUBTITLE: ${subtitleVal || "(none yet)"}
NICHE: ${r.mainNicheLabel || "(not set)"}
SUB-NICHE: ${r.subNicheLabel || "(not set)"}
DEEP NICHE: ${r.deepNicheLabel || "(not set)"}
BOOK TOPIC: ${r.bookTopic || pb.bookTopic || "(not set)"}
PUBLISHING GOAL: ${r.publishingGoal || "(not set)"}
AUTHOR STANCE: ${r.stanceOnTopic || "(not set)"}
STANDOUT ANGLE: ${r.standout || "(not set)"}
TARGET AUDIENCE (research): ${r.targetAudience || "(not set)"}
AUTHOR TONES: ${Array.isArray(r.authorTones) ? r.authorTones.join(", ") : "(not set)"}

COMPETITIVE INTELLIGENCE:
  Audience: ${intel.targetAudience || "(not set)"}
  Reader Pain Profile: ${intel.readerPainProfile || "(not set)"}
  Transformation Promise: ${intel.transformationPromise || "(not set)"}
  Market Gap: ${intel.marketGapAnalysis || "(not set)"}
  Positioning Strategy: ${intel.positioningStrategy || "(not set)"}
  Energy Style: ${intel.energyStyle || "(not set)"}
  Emotional Triggers: ${Array.isArray(intel.emotionalTriggers) ? intel.emotionalTriggers.join(", ") : "(not set)"}

PROPOSED BOOK:
  USP: ${pb.uniqueSellingProposition || "(not set)"}
  Audience: ${pb.proposedAudience || "(not set)"}
  Differentiation: ${pb.differentiation || "(not set)"}
  Key Selling Points: ${pb.keySellingPoints || "(not set)"}

AUTHOR PERSONA:
${personaBlock}

RESEARCH FINDINGS:
${findingsBlock}

RESOURCES:
${resourcesBlock}

COMPETITOR BOOKS:
${competitorBlock}

EXISTING DETAILS (preserve strong values where present):
${existingFields || "(none yet)"}

═══════════════════════════
VALID OPTION LISTS
═══════════════════════════

GENRE options: Business | Self-help | Productivity | Personal finance | Entrepreneurship | Leadership | Investing | Marketing | Career development | Philosophy / ideas | Health & wellness | Cookbooks & food writing | Spirituality | Parenting & family | Technology | Memoir / narrative nonfiction | Other
STRUCTURE options: Chronological | Comparative | How-to | List-based | Modular | Problem-solution | Workbook | Question and answer | Thematic | Hybrid / mixed | Other
TONE options: Conversational | Academic | Neutral | Reflective | Authoritative | Witty | Narrative | Persuasive | Minimalist | Direct & practical
AUDIENCE options: Adult | Young adult | Child | Teen | Senior
WORD COUNT options: 10k–15k | 15k–20k | 20k–25k | 25k–30k | 30k–35k | 35k–40k | 40k–50k | 50k–70k | 70k–90k | 90k–120k
RESEARCH INTENSITY options: Light | Moderate | Heavy

═══════════════════════════
INSTRUCTIONS
═══════════════════════════

- Every recommendation must be SPECIFIC to THIS book. No generic boilerplate.
- Recommendations should feel like they came from a senior publishing consultant.
- Each suggestions array must have EXACTLY 3 items representing different strategic directions.
- genreSuggestions, structureSuggestions, toneSuggestions, audienceSuggestions: pick from the VALID OPTION LISTS above.
- researchIntensitySuggestions: always exactly ["Light","Moderate","Heavy"] ordered by what fits best first.
- uniqueMechanismSuggestions: invent 3 distinct marketable proprietary framework names with explanations.
- Positioning Statement template: "This book helps [audience] achieve [outcome] without [obstacle]."
- focusTopics: 10–20 highly specific strategic topic areas.
- readerObjectionsSuggestions: 3 DIFFERENT sets of 5–8 realistic objections. Each set is a single string with one objection per line (use literal \\n). Each set should emphasize different objection angles (e.g., set 1: practical barriers; set 2: emotional/mindset resistance; set 3: past-failure skepticism).
- readerPainPointsSuggestions: 3 different 2–3 sentence narratives of the reader's core frustrations, from different emotional angles.
- beforeStateSuggestions / afterStateSuggestions: 3 multi-line alternatives (4–6 states per alternative, one state per line).
- chapterCount: integer 5–15. wordCountRange: pick from WORD COUNT options.

OUTPUT — return only this JSON object:

{
  "genreSuggestions": ["<genre1>", "<genre2>", "<genre3>"],
  "structureSuggestions": ["<struct1>", "<struct2>", "<struct3>"],
  "structureReasons": ["<reason for struct1>", "<reason for struct2>", "<reason for struct3>"],
  "toneSuggestions": ["<tone1>", "<tone2>", "<tone3>"],
  "audienceSuggestions": ["<audience1>", "<audience2>", "<audience3>"],
  "researchIntensitySuggestions": ["<best fit first>", "<second>", "<third>"],
  "chapterCount": <5-15>,
  "chapterCountReason": "<1 sentence>",
  "wordCountRange": "<value from list>",
  "wordCountReason": "<1 sentence>",
  "positioningStatementSuggestions": [
    "This book helps <audience> achieve <outcome1> without <obstacle1>.",
    "This book helps <audience> achieve <outcome2> without <obstacle2>.",
    "This book helps <audience> achieve <outcome3> without <obstacle3>."
  ],
  "corePromiseSuggestions": ["<promise1>", "<promise2>", "<promise3>"],
  "coreThesisSuggestions": ["<thesis1>", "<thesis2>", "<thesis3>"],
  "uniqueMechanismSuggestions": [
    { "name": "<Framework Name 1>", "description": "<2-3 sentence explanation>" },
    { "name": "<Framework Name 2>", "description": "<2-3 sentence explanation>" },
    { "name": "<Framework Name 3>", "description": "<2-3 sentence explanation>" }
  ],
  "beforeStateSuggestions": [
    "<state1a>\\n<state1b>\\n<state1c>\\n<state1d>",
    "<state2a>\\n<state2b>\\n<state2c>\\n<state2d>",
    "<state3a>\\n<state3b>\\n<state3c>\\n<state3d>"
  ],
  "afterStateSuggestions": [
    "<state1a>\\n<state1b>\\n<state1c>\\n<state1d>",
    "<state2a>\\n<state2b>\\n<state2c>\\n<state2d>",
    "<state3a>\\n<state3b>\\n<state3c>\\n<state3d>"
  ],
  "readerObjectionsSuggestions": [
    "<objection1>\\n<objection2>\\n<objection3>\\n<objection4>\\n<objection5>",
    "<alt_b_obj1>\\n<alt_b_obj2>\\n<alt_b_obj3>\\n<alt_b_obj4>\\n<alt_b_obj5>",
    "<alt_c_obj1>\\n<alt_c_obj2>\\n<alt_c_obj3>\\n<alt_c_obj4>\\n<alt_c_obj5>"
  ],
  "readerPainPointsSuggestions": [
    "<version 1: 2-3 sentence pain narrative from a practical angle>",
    "<version 2: 2-3 sentence pain narrative from an emotional angle>",
    "<version 3: 2-3 sentence pain narrative from a missed-potential angle>"
  ],
  "desiredEmotionalOutcomeSuggestions": ["<outcome1>", "<outcome2>", "<outcome3>"],
  "uspSuggestions": ["<usp1>", "<usp2>", "<usp3>"],
  "focusTopics": ["<topic1>", "<topic2>", "<topic3>", "<topic4>", "<topic5>", "<topic6>", "<topic7>", "<topic8>", "<topic9>", "<topic10>"],
  "subtitle": "<subtitle or empty string if existing subtitle is strong>"
}`;
}

// ─── Subsection Generation Engine ──────────────────────────────────────────────

export function sectionGenerationPrompt(
  bookTitle: string,
  chapterTitle: string,
  sectionCount: number,
  research?: any,
  corePromise?: string,
  coreThesis?: string,
  chapterPurpose?: string
): string {
  const niche    = research?.mainNicheLabel || "";
  const subNiche = research?.subNicheLabel  || "";
  const audience = research?.targetAudience || "";
  const topic    = research?.bookTopic      || "";

  const purposeLine = chapterPurpose?.trim()
    ? `Chapter Purpose:\n${chapterPurpose.trim()}`
    : `Chapter Purpose:\nDeliver the full promise of this chapter: "${chapterTitle}"`;

  const contextBlock = [
    topic    ? `Book Topic: ${topic}` : "",
    niche    ? `Niche: ${niche}${subNiche ? ` › ${subNiche}` : ""}` : "",
    audience ? `Target Audience: ${audience}` : ""
  ].filter(Boolean).join("\n");

  return `You are an elite nonfiction book architect, developmental editor, and bestselling book strategist.

Your task is to generate ALL section titles for a chapter at the same time.

BOOK STRUCTURE
Book
└─ Chapter
   └─ Section
      └─ Subsection

INPUTS

Book Title: ${bookTitle || "(not set)"}

Book Core Promise: ${corePromise?.trim() || "Provide meaningful, actionable value to the target audience."}

Book Core Thesis: ${coreThesis?.trim() || "Help readers achieve the transformation this book promises."}

Chapter Title: ${chapterTitle}

${purposeLine}

Desired Number of Sections: ${sectionCount}${contextBlock ? `\n\n${contextBlock}` : ""}

====================================================

PRIMARY OBJECTIVE

Generate section titles that fully expand and deliver the promise of the chapter.

Each section should represent a major pillar of the chapter.

When combined, all section titles should create a complete learning journey for the reader.

====================================================

RULE 1 — CHAPTER EXPANSION

Every section must directly support and expand the chapter title.

Ask: "Does this section help the reader better understand, apply, or benefit from the chapter?"

If not, reject it. Never generate sections unrelated to the chapter.

====================================================

RULE 2 — NO DUPLICATES

Every section title must be unique.

Forbidden:
❌ Exact duplicates
❌ Similar wording
❌ Same concept phrased differently
❌ Multiple sections teaching the same lesson

Before returning results, compare every section title against every other section title.

If overlap exists: Regenerate.

====================================================

RULE 3 — DIFFERENT LEARNING ANGLES

Each section must explore a different major aspect of the chapter.

Possible angles: Foundations, Causes, Psychology, Science, Frameworks, Strategies, Systems, Habits, Mistakes, Obstacles, Case Studies, Real Examples, Implementation, Advanced Techniques, Long-Term Application.

Do not repeat the same angle.

====================================================

RULE 4 — COMPLETE COVERAGE

The combined sections should fully cover the chapter topic.

A reader should feel: "This chapter explored the topic from every important angle."

Avoid gaps. Avoid redundancy.

====================================================

RULE 5 — LOGICAL PROGRESSION

Arrange sections in a logical sequence.

Recommended flow:
1. Understanding
2. Why It Happens
3. Consequences
4. Solutions
5. Systems
6. Implementation
7. Long-Term Success

====================================================

RULE 6 — BOOK ALIGNMENT

Every section must support: Book Title, Core Promise, Core Thesis, Chapter Purpose.

Do not create sections that contradict the overall book positioning.

====================================================

RULE 7 — SECTION QUALITY

Avoid generic titles.

Forbidden:
❌ Introduction
❌ Overview
❌ Key Concepts
❌ Main Ideas
❌ Summary
❌ Final Thoughts

Create professional, compelling, commercially valuable section titles.

Each title should feel like it belongs in a bestselling nonfiction book.

====================================================

RULE 8 — SELF-AUDIT

Before returning results, check every section title:
1. Is it directly related to the chapter?
2. Is it unique?
3. Does it teach something different from every other section?
4. Does it help fulfill the chapter promise?
5. Would a professional editor approve it?

If any answer is NO: Regenerate.

====================================================

RULE 9 — CHAPTER COMPLETENESS TEST

After generating all sections, ask:

"If these were the only sections in the chapter, would the reader fully understand and be able to apply the chapter's main lesson?"

If NO: Regenerate.

====================================================

RULE 10 — ANTI-REPETITION VALIDATION

Count unique section titles. If unique titles < ${sectionCount}: REGENERATE.

Never return duplicates.

====================================================

OUTPUT FORMAT

Return ONLY a valid JSON array of exactly ${sectionCount} string(s).

No markdown. No explanations. No comments. Only the JSON array.

["Section Title 1", "Section Title 2", ...]`;
}

export function subsectionGenerationPrompt(
  chapterTitle: string,
  sectionTitle: string,
  subsectionCount: number,
  research?: any
): string {
  const niche    = research?.mainNicheLabel || "";
  const subNiche = research?.subNicheLabel  || "";
  const audience = research?.targetAudience || "";
  const topic    = research?.bookTopic      || "";

  return `You are an elite nonfiction book architect.
Your task is to generate ALL subsection titles for a section at the same time.

BOOK STRUCTURE
Chapter
└─ Section
   └─ Subsections

INPUTS
Chapter Title: ${chapterTitle}
Section Title: ${sectionTitle}
Desired Number of Subsections: ${subsectionCount}${topic ? `\nBook Topic: ${topic}` : ""}${niche ? `\nNiche: ${niche}${subNiche ? ` › ${subNiche}` : ""}` : ""}${audience ? `\nTarget Audience: ${audience}` : ""}

RULES (NON-NEGOTIABLE)

RULE 1 — NO DUPLICATE SUBSECTIONS
Every subsection title MUST be completely unique.
Forbidden: same title repeated, same idea with slightly different wording, multiple titles covering the same topic.
Before returning results, compare every subsection against every other and remove duplicates.

RULE 2 — SUBSECTIONS MUST EXPAND THE SECTION
Each subsection must directly support the parent section.
Ask: "Does this subsection help explain, teach, prove, explore, or apply the section title?"
If not, reject it. Never introduce unrelated concepts. Never drift into topics belonging to another section.

RULE 3 — DIFFERENT ANGLES
Each subsection must cover a different aspect of the section.
Possible angles: Definition, Root Causes, Psychology, Science, Frameworks, Methods, Challenges, Mistakes, Examples, Real-Life Scenarios, Case Studies, Action Steps, Practical Application.
Do not use the same angle twice unless absolutely necessary.

RULE 4 — LOGICAL LEARNING FLOW
Arrange subsections in a natural progression: Understanding → Causes → Effects → Solutions → Application.
The reader should feel a clear progression from one subsection to the next.

RULE 5 — TITLE QUALITY
Avoid generic titles.
Forbidden: "Introduction", "Key Concepts", "Overview", "Summary", "Final Thoughts", "Chapter N", "Section N", "Topic N", "Subsection N".
Titles must feel professionally published and commercially valuable — specific, emotionally intelligent, niche-relevant.

RULE 6 — SUBSECTION UNIQUENESS TEST
Before returning output, verify every pair: Are they discussing different ideas? Providing unique value? Would a reader learn something different from each?
If the answer is NO, regenerate.

RULE 7 — ANTI-REPETITION CHECK
Count unique subsection titles. If unique titles < ${subsectionCount}: REGENERATE until all are unique.
Never return duplicate subsection titles.

RULE 8 — SECTION RELEVANCE CHECK
For every subsection: re-read the section title and score relevance 1–10. If relevance < 8: regenerate that subsection.

RULE 9 — RETURN ONLY FINAL RESULTS
Output ONLY a valid JSON array — no explanations, no markdown, no code fences, no comments.

Generate exactly ${subsectionCount} subsection title(s).

["<title 1>", "<title 2>", ...]`;
}

// ─── Generate Field-Level Suggestion ──────────────────────────────────────────

export function generateFieldSuggestionPrompt(fieldName: string, project: any): string {
  const r     = project?.research               || {};
  const intel = project?.analysis?.intelligence || {};
  const pb    = project?.proposedBook?.content  || {};
  const bd    = project?.bookDetails            || {};
  const bt    = project?.bookTitle              || {};
  const ap    = project?.authorPersona          || {};
  const saved = Array.isArray(ap.savedPersonas) ? ap.savedPersonas : [];
  const pid   = ap.selectedId;
  const persona = pid ? saved.find((p: any) => p.id === pid) || saved[0] : saved[0];

  const titleVal =
    bt?.selectedCard?.title?.trim() || pb.title?.trim() || r.bookTitle?.trim() || "(not set)";

  const personaBrief = persona
    ? [persona.generated?.summary].filter(Boolean).join(" ").slice(0, 200)
    : "(not set)";

  const ctx = `BOOK: "${titleVal}"
GENRE: ${bd.genre || r.mainNicheLabel || "(not set)"}
STRUCTURE: ${bd.structure || "(not set)"}
TONE: ${bd.tone || (Array.isArray(r.authorTones) ? r.authorTones[0] : "(not set)")}
AUDIENCE: ${bd.audience || r.targetAudience || "(not set)"}
BOOK TOPIC: ${r.bookTopic || pb.bookTopic || "(not set)"}
AUTHOR STANCE: ${r.stanceOnTopic || "(not set)"}
STANDOUT ANGLE: ${r.standout || "(not set)"}
MARKET GAP: ${intel.marketGapAnalysis || "(not set)"}
READER PAIN PROFILE: ${intel.readerPainProfile || "(not set)"}
TRANSFORMATION PROMISE: ${intel.transformationPromise || "(not set)"}
AUTHOR PERSONA: ${personaBrief}

EXISTING DETAILS (use for cross-field consistency):
- Positioning Statement: ${bd.positioningStatement || "(not set)"}
- Core Promise: ${bd.corePromise || "(not set)"}
- Core Thesis: ${bd.coreThesis || "(not set)"}
- Unique Mechanism: ${bd.uniqueMechanism || "(not set)"}
- Desired Emotional Outcome: ${bd.desiredEmotionalOutcome || "(not set)"}
- USP: ${bd.uniqueSellingProposition || "(not set)"}`;

  const header = `You are an elite nonfiction publishing strategist.
Generate field-level suggestions ONLY for the field specified below.
Return ONLY valid JSON — no prose, no markdown, no code fences.
Every suggestion must be SPECIFIC to this book — absolutely no generic boilerplate.

${ctx}

FIELD TO GENERATE: ${fieldName.toUpperCase()}

`;

  switch (fieldName) {
    case "positioningStatement":
      return header + `Generate 4 Positioning Statement alternatives using the exact template: "This book helps [audience] achieve [outcome] without [obstacle]."
- Index 0 is the single best-fit RECOMMENDED option
- Indices 1–3 are alternatives with different outcomes, obstacles, or audience framings
- Every item must be a complete sentence following the template

Return ONLY:
{ "recommendations": ["<rec0>", "<rec1>", "<rec2>", "<rec3>"] }`;

    case "corePromise":
      return header + `Generate 4 Core Promise alternatives — the specific, measurable outcome readers will achieve after finishing this book.
- Index 0 is the RECOMMENDED option (clearest, most compelling)
- Indices 1–3 are alternatives with different framings or specificity levels
- 1–2 sentences each, concrete and results-focused

Return ONLY:
{ "recommendations": ["<rec0>", "<rec1>", "<rec2>", "<rec3>"] }`;

    case "coreThesis":
      return header + `Generate 4 Core Thesis alternatives — the central argument or conviction that anchors this book.
- Index 0 is the RECOMMENDED option (strongest, most specific argument)
- Indices 1–3 use different angles: one contrarian, one research-backed, one paradigm-shift
- 1–2 sentences each, arguable and specific

Return ONLY:
{ "recommendations": ["<rec0>", "<rec1>", "<rec2>", "<rec3>"] }`;

    case "uniqueMechanism":
      return header + `Generate 4 Unique Mechanism alternatives — proprietary frameworks with memorable, publishable names.
- Index 0 is the RECOMMENDED framework (most marketable name + clearest description)
- Indices 1–3 are alternatives with different conceptual angles
- Each must have a distinct, marketable framework name and a 2–3 sentence description

Return ONLY:
{ "recommendations": [
    { "name": "<Framework Name 1>", "description": "<2-3 sentences>" },
    { "name": "<Framework Name 2>", "description": "<2-3 sentences>" },
    { "name": "<Framework Name 3>", "description": "<2-3 sentences>" },
    { "name": "<Framework Name 4>", "description": "<2-3 sentences>" }
  ]
}`;

    case "readerTransformation":
      return header + `Generate 3 Reader Transformation sets — concrete before/after states the reader experiences.
- Each set has 5–8 before-reading struggles AND 5–8 after-reading outcomes
- Each set is a single string with one state per line (use \\n)
- Index 0 is the RECOMMENDED transformation arc; indices 1–2 are alternative angles

Return ONLY:
{
  "beforeSuggestions": [
    "<set0: struggle1\\nstruggle2\\nstruggle3\\nstruggle4\\nstruggle5>",
    "<set1: struggle1\\nstruggle2\\nstruggle3\\nstruggle4\\nstruggle5>",
    "<set2: struggle1\\nstruggle2\\nstruggle3\\nstruggle4\\nstruggle5>"
  ],
  "afterSuggestions": [
    "<set0: outcome1\\noutcome2\\noutcome3\\noutcome4\\noutcome5>",
    "<set1: outcome1\\noutcome2\\noutcome3\\noutcome4\\noutcome5>",
    "<set2: outcome1\\noutcome2\\noutcome3\\noutcome4\\noutcome5>"
  ]
}`;

    case "readerObjections":
      return header + `Generate 3 Reader Objection sets — realistic beliefs that may prevent readers from accepting this book's message.
- Set 0 (RECOMMENDED): practical/logistical barriers
- Set 1: emotional/mindset resistance angle
- Set 2: past-failure skepticism angle
- Each set: 5–8 objections as a single string, one objection per line (use \\n)

Return ONLY:
{ "recommendations": [
    "<set0: obj1\\nobj2\\nobj3\\nobj4\\nobj5>",
    "<set1: obj1\\nobj2\\nobj3\\nobj4\\nobj5>",
    "<set2: obj1\\nobj2\\nobj3\\nobj4\\nobj5>"
  ]
}`;

    case "desiredEmotionalOutcome":
      return header + `Generate 4 Desired Emotional Outcome alternatives — how readers will feel after finishing this book.
- Index 0 is the RECOMMENDED option (most resonant for this audience)
- Indices 1–3 are alternatives with different emotional registers
- Each: 3–6 evocative words or a short phrase (e.g. "Empowered, clear, and unstoppable")

Return ONLY:
{ "recommendations": ["<rec0>", "<rec1>", "<rec2>", "<rec3>"] }`;

    default:
      return header + `Generate 4 alternatives for the "${fieldName}" field.
Return ONLY:
{ "recommendations": ["<rec0>", "<rec1>", "<rec2>", "<rec3>"] }`;
  }
}

// ─── Chapter Architecture (Blueprint export) ───────────────────────────────

export function chapterArchitecturePrompt(project: any): string {
  const bd    = project?.bookDetails   || {};
  const r     = project?.research      || {};
  const intel = project?.analysis?.intelligence || {};
  const pb    = project?.proposedBook?.content || {};
  const bt    = project?.bookTitle     || {};
  const ap    = project?.authorPersona || {};

  const saved   = Array.isArray(ap.savedPersonas) ? ap.savedPersonas : [];
  const pid     = ap.selectedId;
  const persona = pid ? saved.find((p: any) => p.id === pid) || saved[0] : saved[0];

  const titleVal     = bt?.selectedCard?.title?.trim() || pb.title?.trim() || r.bookTitle?.trim() || bd.title?.trim() || "(not set)";
  const chapterCount = bd.chapterCount || 10;
  const structure    = bd.structure || "How-to";

  const personaBlock = persona
    ? [
        persona.generated?.summary,
        persona.generated?.voice?.tone     && `Voice tone: ${persona.generated.voice.tone}`,
        persona.generated?.style?.pacing   && `Pacing: ${persona.generated.style.pacing}`,
      ].filter(Boolean).join("\n")
    : "(not set)";

  const competitorBlock = (() => {
    const books = project?.analysis?.books;
    if (!Array.isArray(books) || !books.length) return "(none)";
    return books.slice(0, 4).map((b: any) => `• "${b.title}" by ${b.author || "unknown"}`).join("\n");
  })();

  return `You are an elite nonfiction developmental editor and book architect.

Generate a complete, professional chapter architecture for this book.
Return ONLY valid JSON — no prose, no markdown, no code fences.

═══════════════════════════
BOOK DATA
═══════════════════════════

TITLE: ${titleVal}
SUBTITLE: ${bd.subtitle?.trim() || "(none)"}
GENRE: ${bd.genre || "(not set)"}
STRUCTURE: ${structure}
TONE: ${bd.tone || "(not set)"}
AUDIENCE: ${bd.audience || "(not set)"}
CHAPTER COUNT: ${chapterCount} (generate EXACTLY this many chapters)
WORD COUNT RANGE: ${bd.wordCountRange || "(not set)"}
RESEARCH INTENSITY: ${bd.researchIntensity || "(not set)"}

NICHE: ${r.mainNicheLabel || "(not set)"}
BOOK TOPIC: ${r.bookTopic || pb.bookTopic || "(not set)"}
AUTHOR STANCE: ${r.stanceOnTopic || "(not set)"}
STANDOUT ANGLE: ${r.standout || "(not set)"}

STRATEGIC FOUNDATION:
Positioning Statement: ${bd.positioningStatement || "(not set)"}
Core Promise: ${bd.corePromise || "(not set)"}
Core Thesis: ${bd.coreThesis || "(not set)"}
Unique Mechanism: ${bd.uniqueMechanism || "(not set)"}
Unique Selling Proposition: ${bd.uniqueSellingProposition || "(not set)"}
Desired Emotional Outcome: ${bd.desiredEmotionalOutcome || "(not set)"}

READER TRANSFORMATION:
Before: ${bd.readerTransformationBefore || "(not set)"}
After: ${bd.readerTransformationAfter || "(not set)"}

READER PAIN POINTS: ${bd.readerPainPoints || intel.readerPainProfile || "(not set)"}
READER OBJECTIONS: ${bd.readerObjections || "(not set)"}
FOCUS TOPICS: ${bd.focusTopics || "(not set)"}

AUTHOR PERSONA:
${personaBlock}

COMPETITOR BOOKS:
${competitorBlock}

═══════════════════════════
STRUCTURE RULE
═══════════════════════════

THE ARCHITECTURE MUST STRICTLY FOLLOW THE SELECTED STRUCTURE: ${structure}

Structure implementation guidelines:
- How-to: Sequential skill-building — each chapter teaches one concrete capability
- Problem-solution: Ch1=Problem, Ch2=Root Cause, middle=Solutions, end=Results
- Thematic: Organize around major themes from the focus topics
- Transformation-based / Chronological: Reader evolution arc — current state → mastery
- Framework-driven / Modular: Each chapter covers one stage or module of the unique mechanism
- List-based / Comparative: Parallel structure, each chapter a distinct item or comparison
- Workbook: Alternating concept + exercise chapters, practical and action-oriented
- Narrative: Story arc structure — setup, conflict, rising action, climax, resolution

═══════════════════════════
CHAPTER QUALITY RULES
═══════════════════════════

Chapter titles MUST:
- Sound professionally published and commercially viable
- Create curiosity and anticipation
- Be specific to THIS book's topic and audience
- Avoid generic textbook wording ("Introduction to X", "Understanding Y")
- Reflect the book's unique mechanism and voice
- Build logical momentum from chapter to chapter

BAD title: "Chapter 1: Introduction to Productivity"
GOOD title: "Why Everything You Know About Getting Things Done Is Making You Worse"

Section titles MUST:
- Directly expand the chapter concept
- Progress logically (each section builds on the previous)
- Be specific, actionable, and intriguing
- NOT repeat or paraphrase the chapter title
- Prepare the reader for what comes next

═══════════════════════════
OUTPUT FORMAT
═══════════════════════════

Return exactly this JSON structure — EXACTLY ${chapterCount} chapters, EXACTLY 5 sections per chapter:

{
  "chapters": [
    {
      "number": 1,
      "title": "Full chapter title without any 'Chapter N:' prefix",
      "sections": [
        "Section 1 title",
        "Section 2 title",
        "Section 3 title",
        "Section 4 title",
        "Section 5 title"
      ]
    }
  ]
}`;
}

// ─── Generate Chapters prompt ─────────────────────────────────────────────────

export function generateChaptersPrompt(ctx: {
  title: string;
  subtitle: string;
  bookTopic: string;
  niche: string;
  audience: string;
  tone: string;
  targetWords: number;
  wordCountRange: string;
  corePromise: string;
  uniqueMechanism: string;
  transformationBefore: string;
  transformationAfter: string;
  signatureFramework: string;
  bookPitch: string;
  structure: string;
  authorSummary: string;
  readerPainProfile: string;
  transformationPromise: string;
  marketGap: string;
  positioningStrategy: string;
  competitorTitles: string;
}): string {
  return `You are a world-class bestselling book architect.

Analyze all available book information and create a publishing-quality outline.
Determine the optimal chapter count, chapter order, word allocation, section count, and section structure dynamically.
Create a logical reader transformation journey with no redundancy.
Allocate words according to chapter importance rather than equally.
Generate unique chapter titles and section titles that are specific to the book topic.
The outline must feel comparable to a professionally published bestseller and require minimal manual editing.

══════════════════════════════════════
BOOK INFORMATION
══════════════════════════════════════

Title: ${ctx.title || "(untitled)"}
Subtitle: ${ctx.subtitle || ""}
Topic: ${ctx.bookTopic || ""}
Niche: ${ctx.niche || ""}
Target Audience: ${ctx.audience || ""}
Tone / Voice: ${ctx.tone || ""}
Target Word Count: ~${ctx.targetWords.toLocaleString()} words (range: ${ctx.wordCountRange})
Core Promise: ${ctx.corePromise || ""}
Unique Mechanism: ${ctx.uniqueMechanism || ""}
Signature Framework: ${ctx.signatureFramework || ""}
Book Pitch: ${ctx.bookPitch || ""}
Structure Style: ${ctx.structure || ""}
Reader Before State: ${ctx.transformationBefore || ""}
Reader After State: ${ctx.transformationAfter || ""}
Author Summary: ${ctx.authorSummary || ""}
Reader Pain Profile: ${ctx.readerPainProfile || ""}
Transformation Promise: ${ctx.transformationPromise || ""}
Market Gap: ${ctx.marketGap || ""}
Positioning Strategy: ${ctx.positioningStrategy || ""}
Competitor Titles: ${ctx.competitorTitles || "(none)"}

══════════════════════════════════════
GENERATION RULES
══════════════════════════════════════

CHAPTER COUNT — Determine dynamically:
- Simple focused topics: 6–9 chapters
- Standard nonfiction: 9–14 chapters
- Comprehensive deep-dives: 14–20 chapters
- Never default to a fixed number; match the topic's natural scope

WORD ALLOCATION — Distribute intelligently (TOTAL must equal ${ctx.targetWords.toLocaleString()}):
- Introduction and Conclusion: typically 3–6% of total each
- Core transformation chapters: 8–12% of total each
- Supporting/context chapters: 4–7% of total each
- Total of all chapters + intro + conclusion MUST exactly equal ${ctx.targetWords.toLocaleString()} words

SECTION COUNT PER CHAPTER — Determine dynamically per chapter complexity:
- Short/transitional chapters: 2–3 sections
- Standard chapters: 3–5 sections
- Core/complex chapters: 5–8 sections
- Never default every chapter to the same count

TITLE QUALITY:
- No generic patterns: "Introduction to X", "Understanding Y", "The Basics of Z"
- Each title must be specific to the book topic and chapter purpose
- Titles should intrigue and compel reading
- No "Chapter N:" prefix — just the title itself

SECTION TITLE QUALITY:
- Each section must deliver distinct, non-overlapping value
- No repeated naming patterns across chapters
- Sections must support the chapter objective in a logical progression

VALIDATION (apply before outputting):
- No two chapters share a title or the same core concept
- No two sections in the book share a title
- The chapters form a clear beginning-to-mastery reader journey
- Word counts sum to exactly ${ctx.targetWords.toLocaleString()} (adjust largest chapter if off by ≤200)

══════════════════════════════════════
OUTPUT FORMAT — Return only valid JSON
══════════════════════════════════════

{
  "introduction": {
    "title": "Introduction title (specific to the book, not just 'Introduction')",
    "words": 1800
  },
  "chapters": [
    {
      "title": "Chapter title — no prefix",
      "objective": "One to two sentence description of what this chapter achieves for the reader.",
      "words": 4200,
      "readingTime": "17 min",
      "sections": [
        { "title": "Section title" },
        { "title": "Section title" },
        { "title": "Section title" }
      ]
    }
  ],
  "conclusion": {
    "title": "Conclusion title (specific, not just 'Conclusion')",
    "words": 1600
  }
}`;
}

// ─── Regenerate single chapter prompt ────────────────────────────────────────

export function regenerateChapterPrompt(ctx: {
  title: string;
  bookTopic: string;
  niche: string;
  audience: string;
  tone: string;
  targetWords: number;
  chapterIndex: number;
  totalChapters: number;
  prevChapterTitle: string;
  nextChapterTitle: string;
  existingChapterTitles: string[];
  currentWords: number;
  corePromise: string;
}): string {
  const existingList = ctx.existingChapterTitles
    .map((t, i) => `  ${i + 1}. ${t}`)
    .join("\n");
  return `You are a world-class bestselling book architect.

Regenerate chapter ${ctx.chapterIndex + 1} of ${ctx.totalChapters} in a nonfiction book.

BOOK: "${ctx.title || "Untitled"}"
TOPIC: ${ctx.bookTopic || ""}
NICHE: ${ctx.niche || ""}
AUDIENCE: ${ctx.audience || ""}
TONE: ${ctx.tone || ""}
CORE PROMISE: ${ctx.corePromise || ""}

EXISTING CHAPTER TITLES (do not duplicate these):
${existingList || "  (none yet)"}

POSITION CONTEXT:
- Previous chapter: "${ctx.prevChapterTitle || "Introduction"}"
- This is chapter ${ctx.chapterIndex + 1} of ${ctx.totalChapters}
- Next chapter: "${ctx.nextChapterTitle || "Conclusion"}"

REQUIREMENTS:
- Word count for this chapter: ~${ctx.currentWords.toLocaleString()} words
- Determine the right number of sections (2–8) for this chapter's complexity — do NOT default to 3
- Title must be unique — no overlap with any existing chapter title above
- No generic title patterns ("Introduction to X", "Understanding Y")
- Sections must progress logically and deliver unique value each
- The chapter must fit logically between its neighbors

Return only valid JSON:
{
  "title": "Chapter title — no prefix",
  "objective": "One to two sentence summary of what this chapter achieves.",
  "words": ${ctx.currentWords},
  "readingTime": "X min",
  "sections": [
    { "title": "Section title" }
  ]
}`;
}
