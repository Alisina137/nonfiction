const STOP_WORDS = new Set([
  "a","an","and","are","as","at","be","been","being","but","by","can","could","did","do","does","for",
  "from","had","has","have","how","if","in","into","is","it","its","may","more","most","of","on","or",
  "our","should","so","than","that","the","their","then","there","these","they","this","to","was","we",
  "were","what","when","where","which","who","will","with","would","you","your"
]);

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function pagesOf(item) {
  if (Array.isArray(item?.pages)) return item.pages.filter((n) => Number.isFinite(Number(n))).map(Number);
  if (Number.isFinite(Number(item?.page))) return [Number(item.page)];
  if (Number.isFinite(Number(item?.startPage))) {
    const pages = [Number(item.startPage)];
    if (Number.isFinite(Number(item?.endPage)) && Number(item.endPage) !== Number(item.startPage)) {
      pages.push(Number(item.endPage));
    }
    return pages;
  }
  return [];
}

function pageLabel(pages) {
  if (!pages?.length) return "";
  if (pages.length === 1) return `PDF p.${pages[0]}`;
  return `PDF pp. ${pages[0]}–${pages[pages.length - 1]}`;
}

function priorityBonus(priority) {
  if (priority === "critical") return 4;
  if (priority === "high") return 2;
  if (priority === "low") return -0.5;
  return 0;
}

function makeCandidate(file, kind, item, text, detail = "") {
  const analysis = file?.referenceAnalysis || {};
  const pages = pagesOf(item);
  return {
    sourceId: file?.id || "",
    sourceTitle: clean(analysis.title || file?.title || file?.originalName || "Reference"),
    sourceAuthor: clean(analysis.author || ""),
    kind,
    title: clean(item?.title || item?.name || item?.claim || kind),
    text: clean(text),
    detail: clean(detail),
    pages,
    pageLabel: pageLabel(pages),
    priority: file?.priority || "medium"
  };
}

function candidateItems(file) {
  const a = file?.referenceAnalysis;
  if (!a || typeof a !== "object") return [];
  const out = [];

  for (const item of Array.isArray(a.chapters) ? a.chapters : []) {
    const keyIdeas = Array.isArray(item?.keyIdeas) ? item.keyIdeas.join("; ") : "";
    out.push(makeCandidate(file, "chapter", item, `${item?.title || ""}. ${item?.summary || ""} ${keyIdeas}`));
  }
  for (const item of Array.isArray(a.concepts) ? a.concepts : []) {
    out.push(makeCandidate(file, "concept", item, `${item?.name || ""}. ${item?.explanation || item?.definition || ""}`));
  }
  for (const item of Array.isArray(a.lessons) ? a.lessons : []) {
    out.push(makeCandidate(file, "lesson", item, `${item?.title || ""}. ${item?.lesson || item?.description || ""} ${item?.whyItMatters || ""}`));
  }
  for (const item of Array.isArray(a.claims) ? a.claims : []) {
    out.push(makeCandidate(file, "claim", item, `${item?.claim || ""}. ${item?.evidence || ""}`, item?.confidence || ""));
  }
  for (const item of Array.isArray(a.frameworks) ? a.frameworks : []) {
    const steps = Array.isArray(item?.steps) ? item.steps.join("; ") : "";
    out.push(makeCandidate(file, "framework", item, `${item?.name || ""}. ${item?.description || ""} ${steps}`));
  }
  for (const item of Array.isArray(a.examples) ? a.examples : []) {
    out.push(makeCandidate(file, "example", item, `${item?.name || item?.title || ""}. ${item?.summary || ""} ${item?.lesson || ""}`));
  }
  for (const item of Array.isArray(a.notableQuotes) ? a.notableQuotes : []) {
    out.push(makeCandidate(file, "verified_quote", item, item?.quote || "", item?.attribution || ""));
  }

  return out.filter((item) => item.text.length >= 12);
}

function scoreCandidate(candidate, queryTokens, normalizedQuery) {
  const haystack = normalize(`${candidate.title} ${candidate.text} ${candidate.detail}`);
  if (!haystack) return -Infinity;

  let score = priorityBonus(candidate.priority);
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 1.4;
    if (normalize(candidate.title).includes(token)) score += 1.2;
  }

  const queryPhrase = normalizedQuery.length >= 8 ? normalizedQuery : "";
  if (queryPhrase && haystack.includes(queryPhrase)) score += 6;

  if (candidate.kind === "claim") score += 0.8;
  if (candidate.kind === "framework") score += 0.6;
  if (candidate.kind === "lesson") score += 0.5;
  if (candidate.kind === "verified_quote") score -= 0.2;

  return score;
}

export function buildReferenceEvidence(resources, query, options = {}) {
  const files = Array.isArray(resources?.files) ? resources.files : [];
  const indexed = files.filter((file) => file?.referenceAnalysis);
  if (!indexed.length) return { items: [], text: "", sourceCount: 0 };

  const maxItems = Math.max(1, Math.min(16, Number(options.maxItems) || 10));
  const maxPerSource = Math.max(1, Math.min(5, Number(options.maxPerSource) || 3));
  const maxChars = Math.max(1000, Math.min(16000, Number(options.maxChars) || 9000));
  const normalizedQuery = normalize(query);
  const queryTokens = tokenize(query);

  const candidates = indexed
    .flatMap(candidateItems)
    .map((candidate) => ({ ...candidate, _score: scoreCandidate(candidate, queryTokens, normalizedQuery) }))
    .filter((candidate) => candidate._score > 0)
    .sort((a, b) => b._score - a._score);

  const perSource = new Map();
  const seen = new Set();
  const picked = [];

  for (const candidate of candidates) {
    const sourceCount = perSource.get(candidate.sourceId) || 0;
    if (sourceCount >= maxPerSource) continue;

    const dedupeKey = normalize(`${candidate.sourceTitle} ${candidate.title} ${candidate.text}`).slice(0, 180);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    picked.push(candidate);
    perSource.set(candidate.sourceId, sourceCount + 1);
    if (picked.length >= maxItems) break;
  }

  let chars = 0;
  const lines = [];
  const items = [];
  for (const item of picked) {
    const citation = [item.sourceTitle, item.sourceAuthor, item.pageLabel].filter(Boolean).join(" — ");
    const line = `[${citation || "Reference"}] ${item.kind.toUpperCase()}: ${item.text}`;
    if (chars + line.length > maxChars && lines.length) break;
    chars += line.length;
    lines.push(line);
    items.push({
      sourceId: item.sourceId,
      sourceTitle: item.sourceTitle,
      sourceAuthor: item.sourceAuthor,
      kind: item.kind,
      title: item.title,
      text: item.text,
      pages: item.pages,
      pageLabel: item.pageLabel
    });
  }

  return {
    items,
    text: lines.join("\n"),
    sourceCount: new Set(items.map((item) => item.sourceId)).size
  };
}

export function compactReferenceAnalyses(resources, maxBooks = 20) {
  const files = Array.isArray(resources?.files) ? resources.files : [];
  return files
    .filter((file) => file?.referenceAnalysis)
    .slice(0, Math.max(1, maxBooks))
    .map((file) => {
      const a = file.referenceAnalysis;
      return {
        sourceId: file.id,
        title: clean(a.title || file.title || file.originalName),
        author: clean(a.author),
        publicationYear: clean(a.publicationYear),
        pageCount: Number(a.pageCount) || null,
        overview: clean(a.overview),
        thesis: clean(a.thesis),
        chapters: (Array.isArray(a.chapters) ? a.chapters : []).slice(0, 24).map((x) => ({
          title: clean(x?.title),
          summary: clean(x?.summary),
          keyIdeas: Array.isArray(x?.keyIdeas) ? x.keyIdeas.slice(0, 5).map(clean) : [],
          startPage: Number(x?.startPage) || null,
          endPage: Number(x?.endPage) || null
        })),
        concepts: (Array.isArray(a.concepts) ? a.concepts : []).slice(0, 25),
        lessons: (Array.isArray(a.lessons) ? a.lessons : []).slice(0, 25),
        claims: (Array.isArray(a.claims) ? a.claims : []).slice(0, 20),
        frameworks: (Array.isArray(a.frameworks) ? a.frameworks : []).slice(0, 12)
      };
    });
}

export function buildVerifiedSourceList(projectOrResources) {
  const resources = projectOrResources?.resources || projectOrResources || {};
  const files = Array.isArray(resources?.files) ? resources.files : [];
  const links = Array.isArray(resources?.links) ? resources.links : [];
  const project = projectOrResources?.resources ? projectOrResources : null;
  const competitors = Array.isArray(project?.analysis?.books) ? project.analysis.books : [];

  const refs = [];

  for (const file of files) {
    const a = file?.referenceAnalysis;
    if (!a) continue;
    refs.push({
      id: file.id,
      type: "Book",
      title: clean(a.title || file.originalName),
      author: clean(a.author),
      year: clean(a.publicationYear),
      publication: clean(a.publisher),
      url: "",
      source: "uploaded_reference"
    });
  }

  for (const link of links) {
    if (!link?.url || !(link?.title || link?.label)) continue;
    refs.push({
      id: link.id,
      type: "Website",
      title: clean(link.title || link.label),
      author: "",
      year: "",
      publication: "",
      url: clean(link.url),
      source: "user_reference"
    });
  }

  for (const book of competitors) {
    if (!book?.title) continue;
    const provider = String(book?.source_provider || "");
    if (provider === "ai_research") continue;
    refs.push({
      id: book.asin || book.openLibraryKey || `competitor-${refs.length}`,
      type: "Book",
      title: clean(book.title),
      author: clean(book.authors),
      year: clean(book.publicationDate).slice(0, 4),
      publication: clean(book.publisher),
      url: clean(book.url),
      source: provider || "market_research"
    });
  }

  const seen = new Set();
  return refs.filter((ref) => {
    const key = normalize(`${ref.type}|${ref.title}|${ref.author}|${ref.url}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourcePhrases(resources) {
  const files = Array.isArray(resources?.files) ? resources.files : [];
  const phrases = [];
  for (const file of files) {
    const a = file?.referenceAnalysis;
    if (!a) continue;
    const title = clean(a.title || file.originalName || "Reference");
    for (const item of Array.isArray(a.distinctivePhrases) ? a.distinctivePhrases : []) {
      const text = clean(item?.text || item?.phrase);
      if (tokenize(text).length >= 5) phrases.push({ sourceTitle: title, text, pages: pagesOf(item) });
    }
    for (const item of Array.isArray(a.notableQuotes) ? a.notableQuotes : []) {
      const text = clean(item?.quote);
      if (tokenize(text).length >= 5) phrases.push({ sourceTitle: title, text, pages: pagesOf(item) });
    }
  }
  return phrases;
}

export function assessReferenceOverlap(text, resources) {
  const normalizedText = normalize(text);
  if (!normalizedText) return { risk: "none", matches: [], scannedPhrases: 0 };

  const phrases = sourcePhrases(resources);
  const matches = [];

  for (const phrase of phrases) {
    const normalizedPhrase = normalize(phrase.text);
    if (!normalizedPhrase || tokenize(normalizedPhrase).length < 5) continue;
    if (normalizedText.includes(normalizedPhrase)) {
      matches.push({
        sourceTitle: phrase.sourceTitle,
        text: phrase.text,
        pages: phrase.pages,
        pageLabel: pageLabel(phrase.pages)
      });
    }
  }

  return {
    risk: matches.length ? "review" : "low",
    matches: matches.slice(0, 20),
    scannedPhrases: phrases.length
  };
}
