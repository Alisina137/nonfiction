import { useEffect, useState } from "react";
import { Link } from "wouter";
import AnalysisStep from "@/components/AnalysisStep";
import BookTitleStep from "@/components/BookTitleStep";
import ResourcesStep from "@/components/ResourcesStep";
import AuthorPersonaStep from "@/components/AuthorPersonaStep";
import ProposedBookStep from "@/components/ProposedBookStep";
import BookDetailsStep from "@/components/BookDetailsStep";
import AuthorBioStep from "@/components/AuthorBioStep";
import OutlineStep from "@/components/OutlineStep";
import WriteStep from "@/components/WriteStep";
import DescriptionStep from "@/components/DescriptionStep";
import BookCoverStep from "@/components/BookCoverStep";
import FinishStep from "@/components/FinishStep";
import { blockHasContent, enumerateWriteBlocks } from "@/lib/writeBlocks";
import { BOOK_BUILDER_STEPS } from "@/lib/constants";
import { effectiveBookTitle } from "@/lib/proposedBook";
import ResearchStep from "@/components/ResearchStep";
import { loadNicheRegistry, resolveArchitecture } from "@/lib/niche/registry";
import { architectureDefaultsForDetails } from "@/lib/niche/outlineApply";
import ProviderStatusBadge from "@/components/ProviderStatusBadge";

const STEP_COUNT = BOOK_BUILDER_STEPS.length;
const PROPOSED_BOOK_STEP = BOOK_BUILDER_STEPS.findIndex((s) => s.id === "proposedBook");
const DETAILS_STEP = BOOK_BUILDER_STEPS.findIndex((s) => s.id === "details");
const AUTHOR_BIO_STEP = BOOK_BUILDER_STEPS.findIndex((s) => s.id === "authorBio");
const OUTLINE_STEP = BOOK_BUILDER_STEPS.findIndex((s) => s.id === "outline");
const WRITE_STEP = BOOK_BUILDER_STEPS.findIndex((s) => s.id === "write");
const DESCRIPTION_STEP = BOOK_BUILDER_STEPS.findIndex((s) => s.id === "description");
const COVER_STEP = BOOK_BUILDER_STEPS.findIndex((s) => s.id === "bookCover");
const FINISH_STEP = BOOK_BUILDER_STEPS.findIndex((s) => s.id === "finish");

const emptyAnalysis = {
  books: [],
  amazonDomain: "amazon.com",
  lastSearchQuery: "",
  intelligence: null
};

const emptyBookTitle = {
  suggestions: [],
  cards: [],
  pickedFromAi: "",
  customTitle: "",
  selectedCard: null,
  mode: "bestseller"
};

const emptyResources = {
  links: [],
  findings: [],
  files: [],
  settings: { citation: { style: "none", inline: false, bibliography: false } }
};

const CREATE_NEW_PERSONA = "__create_new__";

const emptyAuthorPersona = {
  savedPersonas: [],
  selectedId: null,
  draft: {
    inspiredBy: "",
    authorDescription: "",
    writingSamples: [{ text: "", source: "" }]
  }
};

const emptyProposedBook = {
  focusTags: [],
  content: {},
  generatedAt: null
};

const emptyBookDetails = {
  wordCountRange: "",
  chapterCount: 8,
  title: "",
  subtitle: "",
  structure: "",
  genre: "",
  tone: "",
  audience: "",
  uniqueSellingProposition: "",
  readerPainPoints: "",
  keywords: "",
  authorPersonaNotes: ""
};

const emptyAuthorBio = {
  authorName: "",
  authorType: "Personal name",
  professionalBackground: "",
  education: "",
  previousPublications: "",
  achievements: "",
  affiliations: "",
  personalDetails: "",
  websiteSocial: "",
  generatedBio: "",
  generatedAt: null
};

const emptyBookOutline = {
  introduction: { id: "intro", title: "Introduction", words: 0 },
  chapters: [],
  conclusion: { id: "concl", title: "Conclusion", words: 0 }
};

const emptyBookMarketing = {
  shortHook: "",
  keywords: "",
  generatedAt: null
};

const emptyBookCover = {
  subtitle: "",
  tagline: "",
  authorLine: "",
  layoutStyle: "typographic",
  primaryColor: "#0f1923",
  accentColor: "#d4961a",
  textColor: "#ffffff",
  designNotes: "",
  concepts: null,
  selectedConceptIndex: 0,
  backDescription: "",
  backAuthorBio: "",
  backCoverHook: "",
  backReviewQuotes: "",
  backCoverCTA: "",
  pageCount: 200,
  paperType: "white",
  trimSizeIndex: 4,
  generatedAt: null
};

const emptyResearch = {
  bookTitle: "",
  bookSubtitle: "",
  authorName: "",
  mainNicheId: "",
  subNicheId: "",
  mainNicheLabel: "",
  subNicheLabel: "",
  deepNicheLabel: "",
  genre: "",
  bookTopic: "",
  stanceOnTopic: "",
  standout: "",
  authorTones: [],
  audiencePreset: "",
  publishingGoal: "",
  generalAudience: "",
  targetAudience: "",
  architectureSnapshot: null
};

const defaultWizard = {
  currentStep: 0,
  completedSteps: Array(STEP_COUNT).fill(false)
};

const baseProject = {
  research: { ...emptyResearch },
  analysis: { ...emptyAnalysis },
  bookTitle: { ...emptyBookTitle },
  resources: { ...emptyResources },
  authorPersona: { ...emptyAuthorPersona },
  proposedBook: { ...emptyProposedBook },
  bookDetails: { ...emptyBookDetails },
  authorBio: { ...emptyAuthorBio },
  bookOutline: { ...emptyBookOutline },
  wizard: { ...defaultWizard },
  idea: "",
  titles: [],
  title: "",
  description: "",
  audience: "",
  tone: "",
  outline: [],
  structure: [],
  lessons: {},
  bookMarketing: { ...emptyBookMarketing },
  bookCover: { ...emptyBookCover },
  finishedAt: null,
  step: "idea"
};

function migrateProject(raw) {
  const p = { ...baseProject, ...raw };
  if (!p.research || typeof p.research !== "object") p.research = { ...emptyResearch };
  else p.research = { ...emptyResearch, ...p.research };
  if (!Array.isArray(p.research.authorTones)) p.research.authorTones = [];
  if (typeof p.research.mainNicheId !== "string") p.research.mainNicheId = "";
  if (typeof p.research.subNicheId !== "string") p.research.subNicheId = "";
  if (typeof p.research.publishingGoal !== "string") p.research.publishingGoal = "";
  if (typeof p.research.audiencePreset !== "string") p.research.audiencePreset = "";

  if (!p.research.mainNicheId && p.research.genre) {
    const reg = typeof window !== "undefined" ? loadNicheRegistry() : { mainNiches: [] };
    const match = reg.mainNiches.find(
      (m) => m.label.toLowerCase() === String(p.research.genre).trim().toLowerCase()
    );
    if (match) {
      p.research.mainNicheId = match.id;
      p.research.mainNicheLabel = match.label;
      if (!p.research.subNicheId && match.subNiches?.[0]) {
        p.research.subNicheId = match.subNiches[0].id;
        p.research.subNicheLabel = match.subNiches[0].label;
      }
    }
  }
  if (!p.wizard || typeof p.wizard !== "object") p.wizard = { ...defaultWizard };
  if (!Array.isArray(p.wizard.completedSteps) || p.wizard.completedSteps.length !== STEP_COUNT) {
    p.wizard.completedSteps = Array(STEP_COUNT).fill(false);
  }
  if (typeof p.wizard.currentStep !== "number" || p.wizard.currentStep < 0 || p.wizard.currentStep >= STEP_COUNT) {
    p.wizard.currentStep = 0;
  }
  if (!p.analysis || typeof p.analysis !== "object") p.analysis = { ...emptyAnalysis };
  else {
    const rawBooks = Array.isArray(p.analysis.books) ? p.analysis.books : [];
    p.analysis = {
      ...emptyAnalysis,
      ...p.analysis,
      books: rawBooks.map((b, idx) => ({
        ...b,
        id: b.id || `legacy-${idx}-${b.asin || "ref"}`
      })),
      amazonDomain: p.analysis.amazonDomain || emptyAnalysis.amazonDomain
    };
  }
  if (!p.bookTitle || typeof p.bookTitle !== "object") p.bookTitle = { ...emptyBookTitle };
  else {
    p.bookTitle = {
      ...emptyBookTitle,
      ...p.bookTitle,
      suggestions: Array.isArray(p.bookTitle.suggestions) ? p.bookTitle.suggestions : []
    };
  }
  if (!p.resources || typeof p.resources !== "object") p.resources = { ...emptyResources };
  else {
    p.resources = {
      ...emptyResources,
      ...p.resources,
      links: Array.isArray(p.resources.links) ? p.resources.links : [],
      findings: Array.isArray(p.resources.findings) ? p.resources.findings : [],
      files: Array.isArray(p.resources.files) ? p.resources.files : []
    };
    // Migrate IDs + new metadata fields (priority, useFor, category, isStyleRef)
    const resourceDefaults = { priority: "medium", useFor: ["entire_book"], isStyleRef: false };
    p.resources.links = (p.resources.links || []).map((l, idx) => ({
      ...resourceDefaults,
      category: l.category || (l.kind === "journal" ? "academic_paper" : l.kind === "dataset" ? "statistics" : "blog_article"),
      ...l,
      id: l.id || `rlink-${idx}`
    }));
    p.resources.findings = (p.resources.findings || []).map((f, idx) => ({
      ...resourceDefaults,
      category: f.category || "note",
      ...f,
      id: f.id || `rfind-${idx}`
    }));
    p.resources.files = (p.resources.files || []).map((file, idx) => ({
      ...resourceDefaults,
      category: file.category || "book",
      summary: file.summary ?? null,
      ...file,
      id: file.id || `rfile-${idx}`
    }));
    if (!p.resources.settings || typeof p.resources.settings !== "object") {
      p.resources.settings = { citation: { style: "none", inline: false, bibliography: false } };
    }
  }
  if (!p.authorPersona || typeof p.authorPersona !== "object") {
    p.authorPersona = { ...emptyAuthorPersona };
  } else {
    const rawDraft = p.authorPersona.draft || {};
    const ws = Array.isArray(rawDraft.writingSamples) ? rawDraft.writingSamples : [];
    const writingSamples =
      ws.length > 0
        ? ws.map((w, idx) => ({
            text: typeof w?.text === "string" ? w.text : "",
            source: typeof w?.source === "string" ? w.source : ""
          }))
        : emptyAuthorPersona.draft.writingSamples;
    p.authorPersona = {
      ...emptyAuthorPersona,
      ...p.authorPersona,
      savedPersonas: Array.isArray(p.authorPersona.savedPersonas) ? p.authorPersona.savedPersonas : [],
      selectedId:
        p.authorPersona.selectedId === undefined || p.authorPersona.selectedId === ""
          ? null
          : p.authorPersona.selectedId,
      draft: {
        ...emptyAuthorPersona.draft,
        ...rawDraft,
        writingSamples
      }
    };
    p.authorPersona.savedPersonas = p.authorPersona.savedPersonas.map((persona, idx) => ({
      ...persona,
      id:
        persona.id ||
        `legacy-${idx}-${persona.updatedAt ? String(persona.updatedAt).slice(0, 16) : "persona"}`
    }));
  }

  const emptyContentShape = {
    title: "",
    uniqueSellingProposition: "",
    differentiation: "",
    keySellingPoints: "",
    proposedAudience: "",
    proposedTone: "",
    proposedAuthorPersona: ""
  };
  if (!p.proposedBook || typeof p.proposedBook !== "object") {
    p.proposedBook = { ...emptyProposedBook, content: { ...emptyContentShape } };
  } else {
    const rawCt = p.proposedBook.content;
    const normalizedContent =
      rawCt && typeof rawCt === "object" ?
        {
          ...emptyContentShape,
          ...rawCt
        }
      : { ...emptyContentShape };
    p.proposedBook = {
      ...emptyProposedBook,
      ...p.proposedBook,
      focusTags: Array.isArray(p.proposedBook.focusTags) ? p.proposedBook.focusTags : [],
      content: normalizedContent,
      generatedAt: p.proposedBook.generatedAt ?? null
    };
  }

  if (!p.bookDetails || typeof p.bookDetails !== "object") {
    p.bookDetails = { ...emptyBookDetails };
  } else {
    const cc = p.bookDetails.chapterCount;
    const n = Number(cc);
    p.bookDetails = {
      ...emptyBookDetails,
      ...p.bookDetails,
      chapterCount: Number.isFinite(n) ? Math.min(15, Math.max(5, Math.round(n))) : emptyBookDetails.chapterCount,
      wordCountRange: typeof p.bookDetails.wordCountRange === "string" ? p.bookDetails.wordCountRange : "",
      title: typeof p.bookDetails.title === "string" ? p.bookDetails.title : "",
      subtitle: typeof p.bookDetails.subtitle === "string" ? p.bookDetails.subtitle : "",
      structure: typeof p.bookDetails.structure === "string" ? p.bookDetails.structure : "",
      genre: typeof p.bookDetails.genre === "string" ? p.bookDetails.genre : "",
      tone: typeof p.bookDetails.tone === "string" ? p.bookDetails.tone : "",
      audience: typeof p.bookDetails.audience === "string" ? p.bookDetails.audience : "",
      uniqueSellingProposition:
        typeof p.bookDetails.uniqueSellingProposition === "string" ? p.bookDetails.uniqueSellingProposition : "",
      readerPainPoints:
        typeof p.bookDetails.readerPainPoints === "string" ? p.bookDetails.readerPainPoints : "",
      keywords:
        typeof p.bookDetails.keywords === "string" ? p.bookDetails.keywords : "",
      authorPersonaNotes:
        typeof p.bookDetails.authorPersonaNotes === "string" ? p.bookDetails.authorPersonaNotes : ""
    };
  }

  if (!p.authorBio || typeof p.authorBio !== "object") {
    p.authorBio = { ...emptyAuthorBio };
  } else {
    p.authorBio = {
      ...emptyAuthorBio,
      ...p.authorBio,
      authorName: typeof p.authorBio.authorName === "string" ? p.authorBio.authorName : "",
      authorType: typeof p.authorBio.authorType === "string" ? p.authorBio.authorType : emptyAuthorBio.authorType,
      professionalBackground:
        typeof p.authorBio.professionalBackground === "string" ? p.authorBio.professionalBackground : "",
      education: typeof p.authorBio.education === "string" ? p.authorBio.education : "",
      previousPublications:
        typeof p.authorBio.previousPublications === "string" ? p.authorBio.previousPublications : "",
      achievements: typeof p.authorBio.achievements === "string" ? p.authorBio.achievements : "",
      affiliations: typeof p.authorBio.affiliations === "string" ? p.authorBio.affiliations : "",
      personalDetails: typeof p.authorBio.personalDetails === "string" ? p.authorBio.personalDetails : "",
      websiteSocial: typeof p.authorBio.websiteSocial === "string" ? p.authorBio.websiteSocial : "",
      generatedBio: typeof p.authorBio.generatedBio === "string" ? p.authorBio.generatedBio : "",
      generatedAt: p.authorBio.generatedAt ?? null
    };
  }

  if (!p.bookOutline || typeof p.bookOutline !== "object") {
    p.bookOutline = { ...emptyBookOutline };
  } else {
    const introRaw = p.bookOutline.introduction;
    const conclRaw = p.bookOutline.conclusion;
    p.bookOutline = {
      introduction: {
        id: typeof introRaw?.id === "string" ? introRaw.id : "intro",
        title: typeof introRaw?.title === "string" ? introRaw.title : "Introduction",
        words: typeof introRaw?.words === "number" && !Number.isNaN(introRaw.words) ? introRaw.words : 0
      },
      chapters: Array.isArray(p.bookOutline.chapters)
        ? p.bookOutline.chapters.map((ch, ci) =>
            typeof ch === "object" && ch ?
              {
                ...ch,
                id: ch.id || `ch-${ci}`,
                title: typeof ch.title === "string" ? ch.title : `Chapter ${ci + 1}`,
                words: Number(ch.words) || 0,
                expanded: ch.expanded !== false,
                sections: Array.isArray(ch.sections)
                  ? ch.sections.map((s, si) => ({
                      ...(typeof s === "object" ? s : {}),
                      id: s?.id || `sec-${ci}-${si}`,
                      title: typeof s?.title === "string" ? s.title : "Section",
                      words: Number(s?.words) || 0,
                      expanded: s?.expanded !== false,
                      subsections: Array.isArray(s?.subsections)
                        ? s.subsections.map((su, qi) => ({
                            ...(typeof su === "object" ? su : {}),
                            id: su?.id || `sub-${ci}-${si}-${qi}`,
                            title: typeof su?.title === "string" ? su.title : "Subsection",
                            words: Number(su?.words) || 0
                          }))
                        : []
                    }))
                  : []
              }
            : { id: `ch-${ci}`, title: `Chapter ${ci + 1}`, words: 0, expanded: true, sections: [] }
          )
        : [],
      conclusion: {
        id: typeof conclRaw?.id === "string" ? conclRaw.id : "concl",
        title: typeof conclRaw?.title === "string" ? conclRaw.title : "Conclusion",
        words: typeof conclRaw?.words === "number" && !Number.isNaN(conclRaw.words) ? conclRaw.words : 0
      }
    };
  }

  if (!p.lessons || typeof p.lessons !== "object") {
    p.lessons = {};
  } else {
    const normalized = {};
    Object.entries(p.lessons).forEach(([key, val]) => {
      if (!val || typeof val !== "object") return;
      normalized[key] = {
        ...val,
        prose: typeof val.prose === "string" ? val.prose : ""
      };
    });
    p.lessons = normalized;
  }

  if (!p.bookMarketing || typeof p.bookMarketing !== "object") {
    p.bookMarketing = { ...emptyBookMarketing };
  } else {
    p.bookMarketing = {
      ...emptyBookMarketing,
      ...p.bookMarketing,
      shortHook: typeof p.bookMarketing.shortHook === "string" ? p.bookMarketing.shortHook : "",
      keywords: typeof p.bookMarketing.keywords === "string" ? p.bookMarketing.keywords : "",
      generatedAt: p.bookMarketing.generatedAt ?? null
    };
  }

  if (!p.bookCover || typeof p.bookCover !== "object") {
    p.bookCover = { ...emptyBookCover };
  } else {
    p.bookCover = {
      ...emptyBookCover,
      ...p.bookCover,
      subtitle: typeof p.bookCover.subtitle === "string" ? p.bookCover.subtitle : "",
      tagline: typeof p.bookCover.tagline === "string" ? p.bookCover.tagline : "",
      authorLine: typeof p.bookCover.authorLine === "string" ? p.bookCover.authorLine : "",
      layoutStyle: typeof p.bookCover.layoutStyle === "string" ? p.bookCover.layoutStyle : emptyBookCover.layoutStyle,
      primaryColor: typeof p.bookCover.primaryColor === "string" ? p.bookCover.primaryColor : emptyBookCover.primaryColor,
      accentColor: typeof p.bookCover.accentColor === "string" ? p.bookCover.accentColor : emptyBookCover.accentColor,
      textColor: typeof p.bookCover.textColor === "string" ? p.bookCover.textColor : emptyBookCover.textColor,
      designNotes: typeof p.bookCover.designNotes === "string" ? p.bookCover.designNotes : "",
      generatedAt: p.bookCover.generatedAt ?? null
    };
  }

  p.finishedAt = p.finishedAt ?? null;
  if (typeof p.description !== "string") p.description = "";

  return p;
}

const emptyProposedBookContent = {
  title: "",
  uniqueSellingProposition: "",
  differentiation: "",
  keySellingPoints: "",
  proposedAudience: "",
  proposedTone: "",
  proposedAuthorPersona: ""
};

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

/** Fresh book project; keeps author name, persona, and bio only. */
function resetProjectKeepingAuthor(current) {
  const authorName = String(current?.research?.authorName || "").trim();
  const keptPersona = cloneJson(current?.authorPersona || emptyAuthorPersona);
  const keptBio = cloneJson(current?.authorBio || emptyAuthorBio);

  const fresh = {
    ...baseProject,
    research: { ...emptyResearch, authorName },
    authorPersona: keptPersona,
    authorBio: keptBio,
    proposedBook: {
      ...emptyProposedBook,
      content: { ...emptyProposedBookContent }
    },
    wizard: { ...defaultWizard }
  };

  return migrateProject(fresh);
}

function validateResearch(research) {
  const errors = {};
  if (!research.authorName?.trim())   errors.authorName   = "Author name is required.";
  if (!research.mainNicheId?.trim())  errors.mainNicheId  = "Select a main niche.";
  if (!research.subNicheId?.trim())   errors.subNicheId   = "Select a sub-niche.";
  return errors;
}

function validateAnalysis(analysis) {
  if (!analysis?.books?.length) {
    return {
      form: "Add at least one reference title: run Search bestsellers for your niche and/or add a book URL at the bottom."
    };
  }
  return {};
}

function validateBookTitle(bookTitle) {
  if (!effectiveBookTitle(bookTitle)) {
    return { form: "Select one suggested title or enter your custom title." };
  }
  return {};
}

/** Step index 4 — require a persona with generated detail, or explicit “create new” with Generate done (saved persona). */
function validateAuthorPersona(authorPersona) {
  const ap = authorPersona || {};
  const saved = Array.isArray(ap.savedPersonas) ? ap.savedPersonas : [];
  const id = ap.selectedId;
  if (!id || id === CREATE_NEW_PERSONA) {
    if (!saved.length) {
      return { form: 'Use “Generate Persona” to save one, or pick an existing persona from the dropdown.' };
    }
    return { form: "Select a persona from Your Saved Personas, or generate a new one to continue." };
  }
  const picked = saved.find((p) => p.id === id);
  if (!picked?.voiceSummary) {
    return { form: "This persona isn’t finalized yet — click Generate Persona to produce the tone and style breakdown." };
  }
  return {};
}

const PROPOSED_BOOK_MIN_TAGS = 5;

function validateProposedBook(proposedBook) {
  const pb = proposedBook || {};
  const tags = Array.isArray(pb.focusTags) ? pb.focusTags.filter((t) => String(t || "").trim()) : [];
  if (tags.length < PROPOSED_BOOK_MIN_TAGS) {
    return { form: `Add at least ${PROPOSED_BOOK_MIN_TAGS} focus topics (recommended for positioning). You have ${tags.length}.` };
  }
  const c = pb.content && typeof pb.content === "object" ? pb.content : {};
  const needs =
    !(c.title && String(c.title).trim()) ||
    !(c.uniqueSellingProposition && String(c.uniqueSellingProposition).trim()) ||
    !(c.differentiation && String(c.differentiation).trim()) ||
    !(c.keySellingPoints && String(c.keySellingPoints).trim()) ||
    !(c.proposedAudience && String(c.proposedAudience).trim()) ||
    !(c.proposedTone && String(c.proposedTone).trim()) ||
    !(c.proposedAuthorPersona && String(c.proposedAuthorPersona).trim());

  if (needs || !pb.generatedAt) {
    return { form: `Click “Generate Proposed Book With Focus” once your tags are set, then refine each section if needed.` };
  }
  return {};
}

/** Proposed Book step: Next disabled until focus tags + generated prose exist. */
function isProposedBookStepReady(proposedBook) {
  const errs = validateProposedBook(proposedBook || {});
  return Object.keys(errs).length === 0;
}

function validateBookDetails(d) {
  const x = d || {};
  if (!x.wordCountRange?.trim()) return { form: "Select a word-count range for your manuscript." };
  const ch = Number(x.chapterCount);
  if (!Number.isFinite(ch) || ch < 5 || ch > 15) {
    return { form: "Pick a chapter count between 5 and 15." };
  }
  if (!x.title?.trim()) return { form: "Enter a working title (you can still fine-tune later)." };
  if (!x.structure?.trim()) return { form: "Select how the book is structured." };
  if (!x.genre?.trim()) return { form: "Choose a genre." };
  if (!x.tone?.trim()) return { form: "Pick the dominant tone." };
  if (!x.audience?.trim()) return { form: "Select the primary audience band." };
  if (!x.uniqueSellingProposition?.trim()) return { form: "Add a unique selling proposition—this anchors positioning." };
  if (!x.authorPersonaNotes?.trim()) return { form: "Add notes for your author persona (pre-filled when possible)." };
  return {};
}

function isBookDetailsReady(bookDetails) {
  return Object.keys(validateBookDetails(bookDetails || {})).length === 0;
}

function validateAuthorBio(authorBio) {
  const x = authorBio || {};
  const errs = {};
  if (!x.authorName?.trim()) errs.authorName = "Author name is required.";
  if (!x.professionalBackground?.trim()) errs.professionalBackground = "Professional background is required.";
  if (!x.generatedBio?.trim()) {
    errs.form = 'Click “Generate biography” to draft your bio—you can edit the text afterward.';
  }
  return errs;
}

function isAuthorBioReady(authorBio) {
  return Object.keys(validateAuthorBio(authorBio || {})).length === 0;
}

function validateBookOutline(o) {
  const x = o && typeof o === "object" ? o : {};
  const chapters = Array.isArray(x.chapters) ? x.chapters : [];
  if (!chapters.length) {
    return {
      form: "Outline needs at least one chapter — use Add chapter or revisit Details for chapter count."
    };
  }

  for (let ci = 0; ci < chapters.length; ci += 1) {
    const ch = chapters[ci];
    if (!String(ch.title || "").trim()) {
      return { form: `Chapter ${ci + 1}: add a title before continuing.` };
    }
    const secs = Array.isArray(ch.sections) ? ch.sections : [];
    for (let sj = 0; sj < secs.length; sj += 1) {
      const sec = secs[sj];
      if (!String(sec.title || "").trim()) {
        return { form: `Chapter ${ci + 1}, section ${sj + 1}: add a title (or trim empty rows).` };
      }
      const subs = Array.isArray(sec.subsections) ? sec.subsections : [];
      for (let q = 0; q < subs.length; q += 1) {
        if (!String(subs[q].title || "").trim()) {
          return {
            form: `Chapter ${ci + 1}, section ${sj + 1}, subsection ${q + 1}: needs a title.`
          };
        }
      }
    }
  }

  const introWords = Number(x.introduction?.words ?? 0);
  const outWords = Number(x.conclusion?.words ?? 0);
  if ((!Number.isFinite(introWords) || introWords < 0 || !Number.isFinite(outWords) || outWords < 0)) {
    return { form: "Introduction and conclusion word budgets must be valid non-negative numbers." };
  }

  return {};
}

function isOutlineReady(bookOutline) {
  return Object.keys(validateBookOutline(bookOutline || {})).length === 0;
}

function validateWrite(lessons, bookOutline) {
  const blocks = enumerateWriteBlocks(bookOutline || {});
  if (!blocks.length) {
    return { form: "Add chapters in Outline before drafting your manuscript." };
  }
  const written = blocks.filter((b) => blockHasContent(lessons, b.id));
  if (!written.length) {
    return { form: "Write at least one section to continue — you can finish the rest later." };
  }
  return {};
}

function isWriteReady(lessons, bookOutline) {
  return Object.keys(validateWrite(lessons, bookOutline)).length === 0;
}

function validateDescription(description) {
  const text = String(description || "").trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 80) {
    return {
      form: `Description needs at least ~80 words for a solid listing (currently ${words}). Generate or expand your copy.`
    };
  }
  return {};
}

function isDescriptionReady(description) {
  return Object.keys(validateDescription(description)).length === 0;
}

function validateBookCover(cover) {
  const c = cover && typeof cover === "object" ? cover : {};
  if (!String(c.subtitle || "").trim()) return { form: "Add a cover subtitle." };
  if (!String(c.authorLine || "").trim()) return { form: "Add the author line as it should appear on the cover." };
  if (!String(c.primaryColor || "").trim()) return { form: "Pick a primary cover color." };
  return {};
}

function isBookCoverReady(cover) {
  return Object.keys(validateBookCover(cover)).length === 0;
}

function canAccessStep(completedSteps, index) {
  if (index === 0) return true;
  for (let k = 0; k < index; k += 1) {
    if (!completedSteps[k]) return false;
  }
  return true;
}

export default function Dashboard() {
  const [project, setProject] = useState(() => migrateProject(baseProject));
  const [researchErrors, setResearchErrors] = useState({});
  const [analysisErrors, setAnalysisErrors] = useState({});
  const [bookTitleErrors, setBookTitleErrors] = useState({});
  const [authorPersonaErrors, setAuthorPersonaErrors] = useState({});
  const [proposedBookErrors, setProposedBookErrors] = useState({});
  const [bookDetailsErrors, setBookDetailsErrors] = useState({});
  const [authorBioErrors, setAuthorBioErrors] = useState({});
  const [outlineErrors, setOutlineErrors] = useState({});
  const [writeErrors, setWriteErrors] = useState({});
  const [descriptionErrors, setDescriptionErrors] = useState({});
  const [coverErrors, setCoverErrors] = useState({});

  const currentStep = project.wizard.currentStep;
  const completedSteps = project.wizard.completedSteps;
  const wizardComplete = completedSteps.every(Boolean);

  const stepMeta = BOOK_BUILDER_STEPS[currentStep];

  function patchWizard(patch) {
    setProject((p) => ({
      ...p,
      wizard: { ...p.wizard, ...patch }
    }));
  }

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("nonfiction-ai-project");
      if (stored) setProject(migrateProject(JSON.parse(stored)));
    } catch {
      setProject(migrateProject(baseProject));
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem("nonfiction-ai-project", JSON.stringify(project));
      } catch {
        console.warn("autosave failed");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [project]);

  function goToStep(index) {
    if (!canAccessStep(completedSteps, index)) return;
    patchWizard({ currentStep: index });
  }

  function handleResetBook() {
    const ok = window.confirm(
      "Reset this book? All steps will be cleared except your author name, persona, and biography. This cannot be undone."
    );
    if (!ok) return;
    setProject(resetProjectKeepingAuthor(project));
    setResearchErrors({});
    setAnalysisErrors({});
    setBookTitleErrors({});
    setAuthorPersonaErrors({});
    setProposedBookErrors({});
    setBookDetailsErrors({});
    setAuthorBioErrors({});
    setOutlineErrors({});
    setWriteErrors({});
    setDescriptionErrors({});
    setCoverErrors({});
  }

  function handleBack() {
    if (currentStep <= 0) return;
    patchWizard({ currentStep: currentStep - 1 });
  }

  function handleNext() {
    const completed = [...completedSteps];

    if (currentStep === 0) {
      const errs = validateResearch(project.research);
      setResearchErrors(errs);
      if (Object.keys(errs).length) return;
    }

    if (currentStep === 1) {
      const errs = validateAnalysis(project.analysis);
      setAnalysisErrors(errs);
      if (Object.keys(errs).length) return;
    }

    if (currentStep === 2) {
      const errs = validateBookTitle(project.bookTitle);
      setBookTitleErrors(errs);
      if (Object.keys(errs).length) return;
    }

    if (currentStep === 4) {
      const errs = validateAuthorPersona(project.authorPersona);
      setAuthorPersonaErrors(errs);
      if (Object.keys(errs).length) return;
    }

    if (currentStep === PROPOSED_BOOK_STEP) {
      const errs = validateProposedBook(project.proposedBook);
      setProposedBookErrors(errs);
      if (Object.keys(errs).length) return;
    }

    if (currentStep === DETAILS_STEP) {
      const errs = validateBookDetails(project.bookDetails);
      setBookDetailsErrors(errs);
      if (Object.keys(errs).length) return;
    }

    if (currentStep === AUTHOR_BIO_STEP) {
      const errs = validateAuthorBio(project.authorBio);
      setAuthorBioErrors(errs);
      if (Object.keys(errs).length) return;
    }

    if (currentStep === OUTLINE_STEP) {
      const errs = validateBookOutline(project.bookOutline);
      setOutlineErrors(errs);
      if (Object.keys(errs).length) return;
    }

    if (currentStep === WRITE_STEP) {
      const errs = validateWrite(project.lessons, project.bookOutline);
      setWriteErrors(errs);
      if (Object.keys(errs).length) return;
    }

    if (currentStep === DESCRIPTION_STEP) {
      const errs = validateDescription(project.description);
      setDescriptionErrors(errs);
      if (Object.keys(errs).length) return;
    }

    if (currentStep === COVER_STEP) {
      const errs = validateBookCover(project.bookCover);
      setCoverErrors(errs);
      if (Object.keys(errs).length) return;
    }

    completed[currentStep] = true;
    const atEnd = currentStep >= STEP_COUNT - 1;
    const nextStep = atEnd ? currentStep : currentStep + 1;

    setProject((p) => {
      const next = {
        ...p,
        wizard: { ...p.wizard, completedSteps: completed, currentStep: nextStep }
      };
      if (currentStep === 0) {
        const reg = loadNicheRegistry();
        const arch = resolveArchitecture(reg, p.research.mainNicheId, p.research.subNicheId);
        next.research = {
          ...p.research,
          mainNicheLabel: arch?.mainNicheLabel || p.research.mainNicheLabel,
          subNicheLabel: arch?.subNicheLabel || p.research.subNicheLabel,
          genre: arch?.mainNicheLabel || p.research.genre,
          architectureSnapshot: arch
        };
        next.idea = p.research.bookTopic?.trim() || "";
        next.title = p.research.bookTitle?.trim() || next.idea;
        next.audience = p.audience || "";
        next.tone = p.tone || "";
        const detailDefaults = architectureDefaultsForDetails(arch);
        if (detailDefaults.chapterCount || detailDefaults.wordCountRange) {
          next.bookDetails = {
            ...p.bookDetails,
            ...detailDefaults,
            chapterCount: detailDefaults.chapterCount || p.bookDetails.chapterCount,
            wordCountRange: detailDefaults.wordCountRange || p.bookDetails.wordCountRange
          };
        }
      }
      if (currentStep === 1) {
        const intel = p.analysis?.intelligence;
        if (intel) {
          // targetAudience is an object in the new format — extract readable string
          const ta = intel.targetAudience;
          const taStr = typeof ta === "string"
            ? ta
            : (ta?.primary || Object.values(ta || {}).filter(Boolean)[0] || "");

          // author guidance lives in authorPersonaGuidance in the new format
          const apg = intel.authorPersonaGuidance || {};
          const toneStr = apg.tone || "";
          const toneArr = toneStr ? [toneStr] : (Array.isArray(intel.authorTones) ? intel.authorTones : []);

          // transformation promise lives in titleInsights in the new format
          const corePromise =
            intel.titleInsights?.recommendedTransformationPromise ||
            intel.transformationPromise ||
            p.research.corePromise || "";

          next.audience = taStr || p.audience || "";
          next.tone     = toneStr || p.tone || "";
          next.research = {
            ...p.research,
            targetAudience: taStr       || p.research.targetAudience || "",
            authorTones:    toneArr.length ? toneArr : p.research.authorTones || [],
            energyStyle:    apg.writingApproach || intel.energyStyle || p.research.energyStyle || "",
            corePromise:    corePromise,
          };
        }
      }
      if (currentStep === 2) {
        const finalT = effectiveBookTitle(p.bookTitle);
        next.title = finalT;
        next.titles = Array.isArray(p.bookTitle.suggestions) ? p.bookTitle.suggestions : [];
      }
      if (currentStep === FINISH_STEP && !p.finishedAt) {
        next.finishedAt = new Date().toISOString();
      }
      return next;
    });

    if (!atEnd) {
      setResearchErrors({});
      setAnalysisErrors({});
      setBookTitleErrors({});
      setAuthorPersonaErrors({});
      setProposedBookErrors({});
      setBookDetailsErrors({});
      setAuthorBioErrors({});
      setOutlineErrors({});
      setWriteErrors({});
      setDescriptionErrors({});
      setCoverErrors({});
    }
  }

  function markProjectComplete() {
    setProject((p) => ({ ...p, finishedAt: new Date().toISOString() }));
  }

  const stepAllowsNext =
    (currentStep !== PROPOSED_BOOK_STEP || isProposedBookStepReady(project.proposedBook)) &&
    (currentStep !== DETAILS_STEP || isBookDetailsReady(project.bookDetails)) &&
    (currentStep !== AUTHOR_BIO_STEP || isAuthorBioReady(project.authorBio)) &&
    (currentStep !== OUTLINE_STEP || isOutlineReady(project.bookOutline)) &&
    (currentStep !== WRITE_STEP || isWriteReady(project.lessons, project.bookOutline)) &&
    (currentStep !== DESCRIPTION_STEP || isDescriptionReady(project.description)) &&
    (currentStep !== COVER_STEP || isBookCoverReady(project.bookCover));

  return (
    <div className="book-builder flex h-screen min-h-0 flex-col overflow-hidden bg-slate-50 text-slate-900 [background-image:radial-gradient(ellipse_125%_80%_at_50%_-28%,rgba(14,165,233,0.11),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_0%,rgba(99,102,241,0.05),transparent_45%)]">
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/85 px-4 py-3 shadow-sm backdrop-blur-md md:gap-8 md:px-8 md:py-3.5 supports-[backdrop-filter]:bg-white/70">
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 0}
            className="shrink-0 rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50/80 disabled:text-slate-400 disabled:opacity-55 disabled:shadow-none"
          >
            Back
          </button>
          <ProviderStatusBadge />
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-2 text-center">
          <h1 className="font-serif text-[1.05rem] font-bold leading-snug tracking-tight text-slate-900 md:text-xl">
            {stepMeta.label}
          </h1>
          {stepMeta.id === "research" && (
            <p className="mt-1 max-w-xl text-[11px] leading-snug text-slate-600 md:text-xs">
              Enter your niche and concept — AI extracts market intelligence, audience, and tone automatically in Step 2.
            </p>
          )}
          {stepMeta.id === "authorPersona" && (
            <p className="mt-1 max-w-xl text-[11px] leading-snug text-slate-600 md:text-xs">
              Create or select a writing persona to influence your book&apos;s tone, voice, and style.
            </p>
          )}
          {stepMeta.id === "proposedBook" && (
            <p className="mt-1 max-w-xl text-[11px] leading-snug text-slate-600 md:text-xs">
              Choose focus pillars, generate a packaged proposal, then refine each editable block before continuing.
            </p>
          )}
          {stepMeta.id === "details" && (
            <p className="mt-1 max-w-xl text-[11px] leading-snug text-slate-600 md:text-xs">
              Nail scope, scaffolding, positioning, and persona notes—everything pre-fills from earlier steps whenever
              possible.
            </p>
          )}
          {stepMeta.id === "authorBio" && (
            <p className="mt-1 max-w-xl text-[11px] leading-snug text-slate-600 md:text-xs">
              Capture credibility signals—then generate an editable bio you can refine before moving on.
            </p>
          )}
          {stepMeta.id === "outline" && (
            <p className="mt-1 max-w-xl text-[11px] leading-snug text-slate-600 md:text-xs">
              Tune chapter scaffolding, subsection depth, and per-block word budgets before you draft.
            </p>
          )}
          {stepMeta.id === "write" && (
            <p className="mt-1 max-w-xl text-[11px] leading-snug text-slate-600 md:text-xs">
              Generate each outline block with continuity-aware AI, refine in place, then continue when every section
              has a draft.
            </p>
          )}
          {stepMeta.id === "description" && (
            <p className="mt-1 max-w-xl text-[11px] leading-snug text-slate-600 md:text-xs">
              Generate Amazon-ready listing copy and keywords grounded in your manuscript—then edit until it sounds like
              you.
            </p>
          )}
          {stepMeta.id === "bookCover" && (
            <p className="mt-1 max-w-xl text-[11px] leading-snug text-slate-600 md:text-xs">
              Define subtitle, palette, and designer notes; preview the hierarchy before you export assets.
            </p>
          )}
          {stepMeta.id === "finish" && (
            <p className="mt-1 max-w-xl text-[11px] leading-snug text-slate-600 md:text-xs">
              Export your manuscript and publishing pack, then mark the project complete when you are ready.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleNext}
          disabled={currentStep < STEP_COUNT - 1 && !stepAllowsNext}
          className="shrink-0 rounded-full bg-gradient-to-r from-sky-600 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-600/28 transition hover:from-sky-700 hover:to-sky-600 hover:shadow-lg hover:shadow-sky-600/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none disabled:opacity-50"
        >
          {currentStep >= STEP_COUNT - 1 ? "Finish" : "Next"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex min-h-0 w-[252px] shrink-0 flex-col border-r border-slate-200/80 bg-white/90 px-3 py-4 shadow-[inset_-1px_0_0_rgba(15,23,42,0.04)] backdrop-blur-md md:w-[268px] md:px-5 md:py-5">
          <p className="shrink-0 leading-snug text-xs font-semibold tracking-tight text-slate-700 md:text-[13px]">
            Step {currentStep + 1} of {STEP_COUNT}: {BOOK_BUILDER_STEPS[currentStep].label}
          </p>
          <nav className="relative mt-4 shrink-0 pt-0.5">
            <div className="absolute bottom-2 left-[17px] top-10 w-px bg-gradient-to-b from-slate-200 via-sky-100/70 to-emerald-100/70" aria-hidden />
            <ul className="relative space-y-1 md:space-y-1.5">
              {BOOK_BUILDER_STEPS.map((s, idx) => {
                const reachable = canAccessStep(completedSteps, idx);
                const isActive = idx === currentStep;
                const isDone = completedSteps[idx];

                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={!reachable}
                      onClick={() => goToStep(idx)}
                      className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-200 ${
                        isActive
                          ? "bg-sky-50/95 ring-1 ring-inset ring-sky-200/55 shadow-sm shadow-sky-500/10"
                          : "hover:bg-slate-50/90"
                      } disabled:cursor-not-allowed disabled:opacity-35`}
                    >
                      <span
                        className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold leading-none shadow-sm transition md:h-[26px] md:w-[26px] md:text-xs ${
                          isDone
                            ? "border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/35"
                            : isActive
                              ? "border-sky-600 bg-white text-sky-800 ring-[3px] ring-sky-400/35 ring-offset-1 ring-offset-white"
                              : "border-slate-300/95 bg-white text-slate-400"
                        }`}
                      >
                        {isDone ? "✓" : idx + 1}
                      </span>
                      <span
                        className={`text-[13px] leading-snug md:text-sm ${isActive ? "font-semibold text-sky-950" : "font-medium text-slate-600"}`}
                      >
                        {s.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-auto flex shrink-0 flex-col gap-2 md:mt-10">
            <button
              type="button"
              onClick={handleResetBook}
              title="Clears book progress but keeps your author name, persona, and biography"
              className="flex items-center justify-center gap-2 rounded-xl border border-amber-200/90 bg-amber-50/80 px-3 py-3 text-sm font-semibold text-amber-950 shadow-sm transition hover:border-amber-300 hover:bg-amber-100/90 md:py-3.5"
            >
              <span className="text-base" aria-hidden>
                ↺
              </span>
              Reset book
            </button>
            <Link
              href="/"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white/80 px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/50 hover:text-sky-900 md:py-3.5"
            >
              <span className="text-lg" aria-hidden>
                ⌂
              </span>
              Exit book
            </Link>
          </div>
        </aside>

        <main className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-16 pt-7 sm:px-7 md:px-12 md:pb-20 md:pt-11">
          {currentStep === 0 && (
            <ResearchStep
              research={project.research}
              setResearch={(patch) =>
                setProject((p) => ({
                  ...p,
                  research: typeof patch === "function" ? patch(p.research) : { ...p.research, ...patch }
                }))
              }
              errors={researchErrors}
              fullProject={project}
            />
          )}

          {currentStep === 1 && (
            <AnalysisStep
              research={project.research}
              analysis={project.analysis}
              errors={analysisErrors}
              updateAnalysis={(fn) =>
                setProject((p) => ({
                  ...p,
                  analysis: typeof fn === "function" ? fn(p.analysis) : { ...p.analysis, ...fn }
                }))
              }
              patchBook={(id, patch) =>
                setProject((p) => ({
                  ...p,
                  analysis: {
                    ...p.analysis,
                    books: p.analysis.books.map((b) => (b.id === id ? { ...b, ...patch } : b))
                  }
                }))
              }
              removeBook={(id) =>
                setProject((p) => ({
                  ...p,
                  analysis: {
                    ...p.analysis,
                    books: p.analysis.books.filter((b) => b.id !== id)
                  }
                }))
              }
              updateResearch={(patch) =>
                setProject((p) => ({
                  ...p,
                  research: typeof patch === "function" ? patch(p.research) : { ...p.research, ...patch }
                }))
              }
            />
          )}

          {currentStep === 2 && (
            <BookTitleStep
              research={project.research}
              analysis={project.analysis}
              bookTitle={project.bookTitle}
              errors={bookTitleErrors}
              setBookTitleBlock={(partial) =>
                setProject((p) => ({
                  ...p,
                  bookTitle:
                    typeof partial === "function" ? partial(p.bookTitle) : { ...p.bookTitle, ...partial }
                }))
              }
            />
          )}

          {currentStep === 3 && (
            <ResourcesStep
              fullProject={project}
              resources={project.resources}
              setResources={(partial) =>
                setProject((p) => ({
                  ...p,
                  resources:
                    typeof partial === "function" ? partial(p.resources) : { ...p.resources, ...partial }
                }))
              }
            />
          )}

          {currentStep === 4 && (
            <>
              <AuthorPersonaStep
                authorPersona={project.authorPersona}
                setAuthorPersona={(partial) =>
                  setProject((p) => ({
                    ...p,
                    authorPersona:
                      typeof partial === "function"
                        ? partial(p.authorPersona || emptyAuthorPersona)
                        : { ...(p.authorPersona || emptyAuthorPersona), ...partial }
                  }))
                }
                fullProject={project}
              />
              {authorPersonaErrors.form && (
                <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-red-600">{authorPersonaErrors.form}</p>
              )}
            </>
          )}

          {currentStep === PROPOSED_BOOK_STEP && (
            <>
              <ProposedBookStep
                proposedBook={project.proposedBook}
                setProposedBook={(partial) =>
                  setProject((p) => ({
                    ...p,
                    proposedBook:
                      typeof partial === "function"
                        ? partial(p.proposedBook || emptyProposedBook)
                        : { ...(p.proposedBook || emptyProposedBook), ...partial }
                  }))
                }
                fullProject={project}
              />
              {proposedBookErrors.form && (
                <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-red-600">{proposedBookErrors.form}</p>
              )}
            </>
          )}

          {currentStep === DETAILS_STEP && (
            <>
              <BookDetailsStep
                bookDetails={project.bookDetails}
                setBookDetails={(partial) =>
                  setProject((p) => ({
                    ...p,
                    bookDetails:
                      typeof partial === "function"
                        ? partial(p.bookDetails || emptyBookDetails)
                        : { ...(p.bookDetails || emptyBookDetails), ...partial }
                  }))
                }
                fullProject={project}
                currentStep={currentStep}
                detailsStepIndex={DETAILS_STEP}
              />
              {bookDetailsErrors.form && (
                <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-red-600">{bookDetailsErrors.form}</p>
              )}
            </>
          )}

          {currentStep === AUTHOR_BIO_STEP && (
            <>
              <AuthorBioStep
                authorBio={project.authorBio}
                setAuthorBio={(partial) =>
                  setProject((p) => ({
                    ...p,
                    authorBio:
                      typeof partial === "function"
                        ? partial(p.authorBio || emptyAuthorBio)
                        : { ...(p.authorBio || emptyAuthorBio), ...partial }
                  }))
                }
                research={project.research}
                currentStep={currentStep}
                authorBioStepIndex={AUTHOR_BIO_STEP}
                errors={authorBioErrors}
              />
              {authorBioErrors.form && (
                <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-red-600">{authorBioErrors.form}</p>
              )}
            </>
          )}

          {currentStep === OUTLINE_STEP && (
            <>
              <OutlineStep
                bookOutline={project.bookOutline}
                setBookOutline={(partial) =>
                  setProject((p) => ({
                    ...p,
                    bookOutline:
                      typeof partial === "function"
                        ? partial(p.bookOutline || emptyBookOutline)
                        : { ...(p.bookOutline || emptyBookOutline), ...partial }
                  }))
                }
                bookDetails={project.bookDetails}
                fullProject={project}
                currentStep={currentStep}
                outlineStepIndex={OUTLINE_STEP}
              />
              {outlineErrors.form && (
                <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-red-600">{outlineErrors.form}</p>
              )}
            </>
          )}

          {currentStep === WRITE_STEP && (
            <WriteStep
              bookOutline={project.bookOutline}
              lessons={project.lessons}
              setLessons={(partial) =>
                setProject((p) => ({
                  ...p,
                  lessons: typeof partial === "function" ? partial(p.lessons || {}) : { ...(p.lessons || {}), ...partial }
                }))
              }
              fullProject={project}
              currentStep={currentStep}
              writeStepIndex={WRITE_STEP}
              errors={writeErrors}
            />
          )}

          {currentStep === DESCRIPTION_STEP && (
            <DescriptionStep
              description={project.description}
              setDescription={(val) =>
                setProject((p) => ({
                  ...p,
                  description: typeof val === "function" ? val(p.description) : val
                }))
              }
              bookMarketing={project.bookMarketing}
              setBookMarketing={(partial) =>
                setProject((p) => ({
                  ...p,
                  bookMarketing:
                    typeof partial === "function"
                      ? partial(p.bookMarketing || emptyBookMarketing)
                      : { ...(p.bookMarketing || emptyBookMarketing), ...partial }
                }))
              }
              fullProject={project}
              errors={descriptionErrors}
            />
          )}

          {currentStep === COVER_STEP && (
            <BookCoverStep
              bookCover={project.bookCover}
              setBookCover={(partial) =>
                setProject((p) => ({
                  ...p,
                  bookCover:
                    typeof partial === "function"
                      ? partial(p.bookCover || emptyBookCover)
                      : { ...(p.bookCover || emptyBookCover), ...partial }
                }))
              }
              fullProject={project}
              description={project.description}
              errors={coverErrors}
            />
          )}

          {currentStep === FINISH_STEP && (
            <FinishStep
              project={project}
              onMarkComplete={markProjectComplete}
              bookOutline={project.bookOutline}
              lessons={project.lessons}
              setLessons={(partial) =>
                setProject((p) => ({
                  ...p,
                  lessons: typeof partial === "function" ? partial(p.lessons || {}) : { ...(p.lessons || {}), ...partial }
                }))
              }
              fullProject={project}
            />
          )}
        </main>
      </div>
    </div>
  );
}
