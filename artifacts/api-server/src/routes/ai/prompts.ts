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
  return `Design a ${chapterCount}-chapter book outline.
MAIN NICHE: ${a.mainNicheLabel}, SUB-NICHE: ${a.subNicheLabel}
TOPIC: ${research.bookTopic || ""}, TITLE: ${title || ""}
BEAT FLOW:\n${flow || "(use sub-niche-native escalation)"}
Return JSON: {"chapters":[{"title":"...","summary":"...","arcRole":"...","sections":[{"title":"...","subsections":[{"title":"...","intent":"..."}]}]}],"architectureNotes":"..."}`;
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
