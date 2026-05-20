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

export function nicheSystemPrompt(architecture: any) {
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

export function titlesPrompt(idea: string) {
  return `User idea: ${idea}
Generate exactly 5 premium nonfiction book titles as a JSON array of strings.
Each title must signal practical transformation and expert authority.
Return JSON: {"titles":["..."]}`;
}

export function contextualBookTitlesPrompt({ research, competitorSummaries }: any) {
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
  return `You are naming a book for the following profile.
PRIMARY SUBJECT: ${research.bookTopic?.trim() || ""}
NICHE: ${nicheLine}
TARGET READER: ${research.targetAudience?.trim() || ""}
PUBLISHING GOAL: ${research.publishingGoal?.trim() || "not specified"}
AUTHOR VOICE: ${Array.isArray(research.authorTones) && research.authorTones.length ? research.authorTones.join(", ") : "not specified"}
STANCE: ${stance}
STANDOUT: ${standout}
COMPETITORS: ${summariesBlock}
Generate exactly 6 strong titles. Return JSON: {"titles":["..."]}`;
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

export function coverBriefPrompt({ title, subtitle, audience, tone, genre, usp, authorName, description }: any) {
  return `Design an ebook cover brief.
TITLE: ${title}
SUBTITLE: ${subtitle || "(generate one)"}
AUTHOR: ${authorName}
NICHE: ${genre || "General"}
AUDIENCE: ${audience}
TONE: ${tone}
USP: ${usp || ""}
DESCRIPTION: ${(description || "").slice(0, 600)}
Return JSON: {"subtitle":"...","tagline":"...","authorLine":"...","layoutStyle":"typographic|split-band|minimal|bold-stack","primaryColor":"hex","accentColor":"hex","textColor":"hex","designNotes":"..."}`;
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
    : "";
  return `You are an elite publishing strategist and nonfiction architect.

CRITICAL RULES — follow exactly:
1. Every title at every level must be SPECIFIC, MEANINGFUL, and PUBLICATION-READY.
2. FORBIDDEN outputs (never use): "Beat 1", "Beat 2", "Scene 1", "Section 1", "Section A", "Topic 1", "Subtopic", "Placeholder", "Chapter N", "Key Point", "Emotional Theme", any numbered generic label.
3. Chapter titles must signal a clear emotional or intellectual transformation.
4. Section titles must identify a specific idea, conflict, or concept within the chapter.
5. Subsection titles must name a precise angle, tactic, story beat, or insight — never a generic label.
6. Every level must feel like it was written by a bestselling author — specific, emotionally intelligent, commercially viable.

GOOD subsection title examples:
- "The Fear of Falling Behind"
- "When Failure Becomes Identity"
- "Curated Success vs Real Life"
- "Learning to Continue Anyway"
- "The Quiet Weight of Comparison"

BAD subsection titles (STRICTLY FORBIDDEN):
- "Beat 1", "Beat 2", "Scene 1"
- "Emotional Topic", "Key Point", "Section A"
- "Topic 1", "Subtopic 1", "Placeholder"

BOOK PROFILE:
TITLE: ${title || ""}
TOPIC: ${research?.bookTopic || ""}
NICHE: ${a.mainNicheLabel || ""} › ${a.subNicheLabel || ""}
TARGET AUDIENCE: ${research?.targetAudience || ""}
AUTHOR TONE: ${tones || "direct and authoritative"}
PUBLISHING GOAL: ${research?.publishingGoal || ""}
STANCE: ${research?.stanceOnTopic || ""}
STANDOUT FACTOR: ${research?.standout || ""}

STRUCTURAL BLUEPRINT:
Structure type: ${a.structureType || "narrative"}
Pacing: ${a.pacingType || "standard"}
Emotional arc: ${a.emotionalArc || "progressive"}
Bestseller patterns: ${(a.bestsellerPatterns || []).join("; ") || ""}
Reader psychology: ${a.readerPsychology || ""}
Beat flow:
${flow || "(use sub-niche-native escalation)"}

CHAPTERS TO GENERATE: ${chapterCount}
SECTIONS PER CHAPTER: 2-3 (generate exactly, with real titles)
SUBSECTIONS PER SECTION: 2-3 (generate exactly, with real titles)

Return ONLY valid JSON:
{"chapters":[{"title":"Specific chapter title signaling transformation","summary":"2-sentence summary of what this chapter achieves","arcRole":"opening hook|escalation|climax|resolution|transformation|etc","sections":[{"title":"Specific concept or angle — not generic","subsections":[{"title":"Precise emotionally-specific insight or tactic","intent":"What shift or insight this delivers to the reader"}]}]}],"architectureNotes":"Brief structural strategy note"}`;
}

export function regenTitlePrompt({ level, currentTitle, parentChapter, parentSection, architecture, research }: any) {
  const a = architecture || {};
  const niche = `${a.mainNicheLabel || ""} › ${a.subNicheLabel || ""}`;
  const audience = research?.targetAudience || "";
  const tones = Array.isArray(research?.authorTones) ? research.authorTones.join(", ") : "";

  if (level === "chapter") {
    return `You are a publishing strategist. Generate ONE specific, emotionally compelling chapter title.
BOOK TOPIC: ${research?.bookTopic || ""}
NICHE: ${niche}
AUDIENCE: ${audience}
TONE: ${tones}
CURRENT TITLE (replace this, keep the same chapter position/role): ${currentTitle}
Rules: No generic labels. No "Chapter N". No "Beat N". Title must signal a transformation or insight.
Return JSON: {"title":"..."}`;
  }
  if (level === "section") {
    return `Generate ONE specific section title for this chapter context.
CHAPTER: ${parentChapter || ""}
NICHE: ${niche}
AUDIENCE: ${audience}
CURRENT TITLE (replace): ${currentTitle}
The title must address a specific concept, conflict, or angle within the chapter.
No generic labels. No "Section N". No "Topic N".
Return JSON: {"title":"..."}`;
  }
  return `Generate ONE specific subsection title.
CHAPTER: ${parentChapter || ""}
SECTION: ${parentSection || ""}
NICHE: ${niche}
AUDIENCE: ${audience}
CURRENT TITLE (replace): ${currentTitle}
Must be emotionally specific — a precise insight, tactic, or story angle.
Example good titles: "The Fear of Falling Behind", "When Failure Becomes Identity", "Curated Success vs Real Life"
No generic labels. No "Beat N". No "Scene N".
Return JSON: {"title":"..."}`;
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
