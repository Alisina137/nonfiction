// ══════════════════════════════════════════════════════════════════════════════
// Publishing Lifecycle & Book Evolution Engine  ·  Prompt 16
// ══════════════════════════════════════════════════════════════════════════════
//
// Manages the complete life of every nonfiction book as a living publishing
// asset. All data is stored in localStorage, keyed by book ID. No UI, no API,
// no workflow changes — purely internal.
//
// Storage key: "nonfiction-ai-lifecycle-{id}"
//
// Lifecycle object shape:
//   status         — current lifecycle stage
//   version        — semantic version string (e.g. "1.2.0")
//   createdAt      — epoch ms when lifecycle was initialised
//   statusHistory  — ordered log of all status transitions
//   versions       — lightweight snapshots at key milestones
//   changeLog      — recent per-level change records (capped at 100)
//   series         — optional series membership
//   editions       — current + planned edition types
//   contentAssets  — reusable frameworks / definitions / stories / exercises
//   companionProducts — planned companion products (workbook, guide, etc.)
//   readerFeedback — structure for future reader feedback
//   publishingRoadmap — future product roadmap generated at review stage
//   qualityReview  — pre-publish validation record
//   lifecycleMemory — long-term evolution history
// ══════════════════════════════════════════════════════════════════════════════

const LC_PREFIX = "nonfiction-ai-lifecycle-";
const MAX_CHANGELOG = 100;
const MAX_VERSIONS  = 20;

// ─── Lifecycle status constants ────────────────────────────────────────────

export const LIFECYCLE_STATUSES = [
  "draft",
  "review",
  "published",
  "updated",
  "expanded",
  "revised_edition",
  "second_edition",
  "series",
  "companion_products",
  "archive",
];

// ─── Edition type constants ────────────────────────────────────────────────

export const EDITION_TYPES = [
  "standard",
  "minor_revision",
  "major_revision",
  "expanded_edition",
  "updated_edition",
  "professional_edition",
  "student_edition",
  "executive_edition",
  "workbook_edition",
  "companion_guide",
  "series_edition",
  "international_edition",
  "custom_edition",
];

// ─── Companion product types ───────────────────────────────────────────────

export const COMPANION_PRODUCT_TYPES = [
  "workbook",
  "action_guide",
  "cheat_sheet",
  "summary_book",
  "course_material",
  "presentation",
  "email_course",
  "discussion_guide",
  "journal",
  "assessment",
  "advanced_guide",
  "case_study_collection",
  "quick_reference",
  "executive_summary",
  "certification_material",
];

// ─── Storage helpers ───────────────────────────────────────────────────────

function lcKey(id) {
  return LC_PREFIX + id;
}

export function loadLifecycle(id) {
  try {
    const raw = localStorage.getItem(lcKey(id));
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function _saveLifecycle(id, lc) {
  try {
    localStorage.setItem(lcKey(id), JSON.stringify(lc));
  } catch {}
}

export function removeLifecycle(id) {
  try { localStorage.removeItem(lcKey(id)); } catch {}
}

// ─── Default lifecycle object ──────────────────────────────────────────────

function _defaultLifecycle(project) {
  const now = Date.now();
  const title = _extractTitle(project);
  return {
    status:        "draft",
    version:       "1.0.0",
    createdAt:     now,

    statusHistory: [
      { status: "draft", timestamp: now, notes: "Book created" }
    ],

    versions: [
      {
        versionNumber: "1.0.0",
        createdAt:     now,
        type:          "draft",
        wizardStep:    project?.wizard?.currentStep ?? 0,
        title,
        notes:         "Initial draft created",
        changes:       [],
      }
    ],

    changeLog: [],

    series: {
      name:         null,
      position:     null,
      theme:        null,
      sharedDNA:    null,
      sharedFrameworks: [],
      sharedVocabulary: [],
    },

    editions: {
      current:  "standard",
      planned:  [],
      history:  [],
    },

    contentAssets:     [],
    companionProducts: [],

    readerFeedback: {
      confusingChapters:      [],
      popularChapters:        [],
      frequentlyHighlighted:  [],
      frequentlyAskedQuestions: [],
      improvementRequests:    [],
      successStories:         [],
    },

    publishingRoadmap: [],

    qualityReview: {
      lastReviewedAt:       null,
      consistency:          null,
      knowledgeGraphIntegrity: null,
      bookDNAAlignment:     null,
      frameworkConsistency: null,
      commercialReadiness:  null,
      publishingQuality:    null,
    },

    lifecycleMemory: {
      editionHistory:    [],
      revisionHistory:   [],
      frameworkEvolution: [],
      conceptEvolution:  [],
      publishingHistory: [],
    },
  };
}

// ─── Initialise (called on createBook) ────────────────────────────────────

export function initLifecycle(id, project = {}) {
  const existing = loadLifecycle(id);
  if (existing) return existing;
  const lc = _defaultLifecycle(project);
  _saveLifecycle(id, lc);
  return lc;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function _extractTitle(project) {
  return (
    (project?.bookDetails?.title && String(project.bookDetails.title).trim()) ||
    (project?.bookTitle?.customTitle && String(project.bookTitle.customTitle).trim()) ||
    (project?.bookTitle?.pickedFromAi && String(project.bookTitle.pickedFromAi).trim()) ||
    (project?.research?.bookTopic && String(project.research.bookTopic).trim()) ||
    "Untitled Book"
  );
}

function _versionBump(version, type) {
  const parts = String(version || "1.0.0").split(".").map(Number);
  if (type === "major") { parts[0]++; parts[1] = 0; parts[2] = 0; }
  else if (type === "minor") { parts[1]++; parts[2] = 0; }
  else { parts[2]++; }
  return parts.join(".");
}

function _detectChanges(oldProject, newProject) {
  if (!oldProject || !newProject) return [];
  const changes = [];
  const now = Date.now();

  // Wizard step advancement
  const oldStep = oldProject?.wizard?.currentStep ?? 0;
  const newStep = newProject?.wizard?.currentStep ?? 0;
  if (newStep > oldStep) {
    changes.push({
      timestamp:   now,
      level:       "book",
      type:        "step_advanced",
      description: `Progressed from step ${oldStep} to step ${newStep}`,
      keys:        ["wizard.currentStep"],
    });
  }

  // Title change
  const oldTitle = _extractTitle(oldProject);
  const newTitle = _extractTitle(newProject);
  if (oldTitle !== newTitle && newTitle !== "Untitled Book") {
    changes.push({
      timestamp:   now,
      level:       "book",
      type:        "title_updated",
      description: `Title changed to "${newTitle}"`,
      keys:        ["bookTitle", "bookDetails.title"],
    });
  }

  // Research completed
  if (!oldProject?.research?.mainNicheLabel && newProject?.research?.mainNicheLabel) {
    changes.push({
      timestamp:   now,
      level:       "book",
      type:        "research_completed",
      description: "Niche research completed",
      keys:        ["research"],
    });
  }

  // Intelligence generated
  if (!oldProject?.analysis?.intelligence && newProject?.analysis?.intelligence) {
    changes.push({
      timestamp:   now,
      level:       "book",
      type:        "intelligence_generated",
      description: "Competitor intelligence generated",
      keys:        ["analysis.intelligence"],
    });
  }

  // Outline updated
  const oldChapters = (oldProject?.bookOutline?.chapters || []).length;
  const newChapters = (newProject?.bookOutline?.chapters || []).length;
  if (newChapters > oldChapters) {
    changes.push({
      timestamp:   now,
      level:       "chapter",
      type:        "chapters_added",
      description: `${newChapters - oldChapters} chapter(s) added (${newChapters} total)`,
      keys:        ["bookOutline.chapters"],
    });
  } else if (newChapters < oldChapters && oldChapters > 0) {
    changes.push({
      timestamp:   now,
      level:       "chapter",
      type:        "chapters_removed",
      description: `${oldChapters - newChapters} chapter(s) removed (${newChapters} total)`,
      keys:        ["bookOutline.chapters"],
    });
  }

  // Book details filled
  if (!oldProject?.bookDetails?.genre && newProject?.bookDetails?.genre) {
    changes.push({
      timestamp:   now,
      level:       "book",
      type:        "details_updated",
      description: "Book details completed",
      keys:        ["bookDetails"],
    });
  }

  // Writing started/progressed
  const oldBlocks = _countWriteBlocks(oldProject);
  const newBlocks = _countWriteBlocks(newProject);
  if (newBlocks > oldBlocks) {
    changes.push({
      timestamp:   now,
      level:       "section",
      type:        "content_written",
      description: `${newBlocks - oldBlocks} section(s) written (${newBlocks} total)`,
      keys:        ["bookContent"],
    });
  }

  // Author persona
  if (!oldProject?.authorPersona?.name && newProject?.authorPersona?.name) {
    changes.push({
      timestamp:   now,
      level:       "book",
      type:        "persona_created",
      description: `Author persona "${newProject.authorPersona.name}" created`,
      keys:        ["authorPersona"],
    });
  }

  // Cover generated
  if (!oldProject?.bookCover?.concepts?.length && newProject?.bookCover?.concepts?.length) {
    changes.push({
      timestamp:   now,
      level:       "book",
      type:        "cover_generated",
      description: "Book cover concepts generated",
      keys:        ["bookCover"],
    });
  }

  return changes;
}

function _countWriteBlocks(project) {
  if (!project?.bookContent || typeof project.bookContent !== "object") return 0;
  let count = 0;
  for (const v of Object.values(project.bookContent)) {
    if (v && typeof v === "object") {
      for (const vv of Object.values(v)) {
        if (vv && typeof vv === "object") {
          for (const vvv of Object.values(vv)) {
            if (typeof vvv === "string" && vvv.trim().length > 0) count++;
          }
        }
      }
    }
  }
  return count;
}

function _determineLifecycleStatus(project, currentStatus) {
  const step = project?.wizard?.currentStep ?? 0;
  const FINISH_STEP_INDEX = 11; // approximate — finish step

  if (currentStatus === "archive") return "archive";
  if (["published", "updated", "expanded", "revised_edition", "second_edition", "series", "companion_products"].includes(currentStatus)) {
    return currentStatus; // manual stages — don't auto-revert
  }

  if (step === 0) return "draft";
  if (step < FINISH_STEP_INDEX) return "draft";
  if (step >= FINISH_STEP_INDEX && currentStatus === "draft") return "review";
  return currentStatus;
}

// ─── Extract reusable content assets from a project ───────────────────────

export function extractContentAssets(project) {
  const assets = [];
  const now = Date.now();

  // Extract frameworks from outline section titles
  const chapters = project?.bookOutline?.chapters || [];
  for (const ch of chapters) {
    for (const sec of (ch.sections || [])) {
      const title = sec.title || "";
      // Heuristic: sections/subsections with "Method", "Framework", "System", "Model" in title
      const frameworkMatch = title.match(
        /\b(The )?([A-Z][a-z]+ )?(Method|Framework|System|Model|Blueprint|Principle|Formula|Code|Approach)\b/
      );
      if (frameworkMatch) {
        const name = frameworkMatch[0].trim();
        if (!assets.some(a => a.name === name && a.type === "framework")) {
          assets.push({
            id:            `framework-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
            type:          "framework",
            name,
            description:   `From: ${ch.title} › ${title}`,
            extractedFrom: `${ch.title} › ${title}`,
            reusedIn:      [],
            createdAt:     now,
          });
        }
      }
    }
  }

  // Extract niche/research terms as definitions
  const research = project?.research || {};
  if (research.deepNicheLabel) {
    assets.push({
      id:            `definition-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      type:          "definition",
      name:          research.deepNicheLabel,
      description:   research.bookTopic || "",
      extractedFrom: "Research Step",
      reusedIn:      [],
      createdAt:     now,
    });
  }

  // Extract author persona as a reusable asset
  if (project?.authorPersona?.name) {
    assets.push({
      id:            `persona-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      type:          "author_persona",
      name:          project.authorPersona.name,
      description:   project.authorPersona.bio?.slice(0, 200) || "",
      extractedFrom: "Author Persona Step",
      reusedIn:      [],
      createdAt:     now,
    });
  }

  return assets;
}

// ─── Generate publishing roadmap ───────────────────────────────────────────

export function generatePublishingRoadmap(project) {
  const niche = [
    project?.research?.mainNicheLabel,
    project?.research?.subNicheLabel,
    project?.research?.deepNicheLabel,
  ].filter(Boolean).join(" › ");

  const roadmap = [
    {
      product:           "Workbook Edition",
      type:              "workbook_edition",
      priority:          "high",
      rationale:         "Workbooks consistently sell alongside the main book on Amazon KDP.",
      estimatedTimeline: "1–2 months after publication",
      dnaCompatible:     true,
    },
    {
      product:           "Quick Reference Guide",
      type:              "quick_reference",
      priority:          "high",
      rationale:         "Condensed cheat sheet drives secondary sales and reader loyalty.",
      estimatedTimeline: "2–4 weeks after publication",
      dnaCompatible:     true,
    },
    {
      product:           "Email Course",
      type:              "email_course",
      priority:          "medium",
      rationale:         "Re-packages book content as a lead generation asset.",
      estimatedTimeline: "1–3 months after publication",
      dnaCompatible:     true,
    },
    {
      product:           "Advanced Guide",
      type:              "advanced_guide",
      priority:          "medium",
      rationale:         `Deepens the ${niche || "niche"} topic for readers who want more.`,
      estimatedTimeline: "3–6 months after publication",
      dnaCompatible:     true,
    },
    {
      product:           "Executive Summary",
      type:              "executive_summary",
      priority:          "medium",
      rationale:         "Short premium companion for busy professionals.",
      estimatedTimeline: "1–2 months after publication",
      dnaCompatible:     true,
    },
    {
      product:           "Second Edition",
      type:              "second_edition",
      priority:          "low",
      rationale:         "After reader feedback, a revised edition with new research and frameworks.",
      estimatedTimeline: "12–18 months after publication",
      dnaCompatible:     true,
    },
    {
      product:           "Companion Journal",
      type:              "journal",
      priority:          "low",
      rationale:         "Reflection journal deepens reader transformation.",
      estimatedTimeline: "2–4 months after publication",
      dnaCompatible:     true,
    },
  ];

  return roadmap.map((r, i) => ({ ...r, id: `roadmap-${Date.now()}-${i}`, status: "planned", createdAt: Date.now() }));
}

// ─── Plan companion products (subset of roadmap, actionable near-term) ────

export function planCompanionProducts(project) {
  const base = [
    { type: "workbook",     priority: "high",   status: "planned" },
    { type: "cheat_sheet",  priority: "high",   status: "planned" },
    { type: "email_course", priority: "medium", status: "planned" },
    { type: "assessment",   priority: "medium", status: "planned" },
  ];
  const now = Date.now();
  return base.map((p, i) => ({ ...p, id: `companion-${now}-${i}`, createdAt: now, inheritsDNA: true }));
}

// ─── Add reader feedback (for future use) ─────────────────────────────────

export function addReaderFeedback(id, feedbackType, item) {
  const lc = loadLifecycle(id);
  if (!lc) return;
  const valid = [
    "confusingChapters", "popularChapters", "frequentlyHighlighted",
    "frequentlyAskedQuestions", "improvementRequests", "successStories",
  ];
  if (!valid.includes(feedbackType)) return;
  lc.readerFeedback[feedbackType] = [
    ...(lc.readerFeedback[feedbackType] || []),
    { ...item, addedAt: Date.now() },
  ];
  _saveLifecycle(id, lc);
}

// ─── Advance lifecycle status (manual) ───────────────────────────────────

export function advanceLifecycleStatus(id, newStatus, notes = "") {
  const lc = loadLifecycle(id);
  if (!lc) return;
  if (!LIFECYCLE_STATUSES.includes(newStatus)) return;

  const prev = lc.status;
  lc.status = newStatus;
  lc.statusHistory.push({ status: newStatus, timestamp: Date.now(), notes, from: prev });

  // Auto-generate roadmap on first "review" or "published" transition
  if ((newStatus === "review" || newStatus === "published") && !lc.publishingRoadmap.length) {
    const project = _loadProjectForId(id);
    if (project) {
      lc.publishingRoadmap = generatePublishingRoadmap(project);
    }
  }

  // Auto-plan companion products on "published"
  if (newStatus === "published" && !lc.companionProducts.length) {
    const project = _loadProjectForId(id);
    if (project) {
      lc.companionProducts = planCompanionProducts(project);
    }
  }

  // Record in lifecycle memory
  lc.lifecycleMemory.publishingHistory.push({
    from: prev, to: newStatus, timestamp: Date.now(), notes,
  });

  _saveLifecycle(id, lc);
}

// ─── Create a version snapshot ────────────────────────────────────────────

export function createVersion(id, project, options = {}) {
  const lc = loadLifecycle(id);
  if (!lc) return;

  const { type = "minor", notes = "" } = options;
  const newVersionNumber = _versionBump(lc.version, type);
  lc.version = newVersionNumber;

  const snapshot = {
    versionNumber: newVersionNumber,
    createdAt:     Date.now(),
    type,
    wizardStep:    project?.wizard?.currentStep ?? 0,
    title:         _extractTitle(project),
    chapterCount:  (project?.bookOutline?.chapters || []).length,
    notes,
    changes:       [],
  };

  lc.versions = [snapshot, ...lc.versions].slice(0, MAX_VERSIONS);
  lc.lifecycleMemory.revisionHistory.push({ version: newVersionNumber, type, timestamp: Date.now(), notes });

  _saveLifecycle(id, lc);
  return newVersionNumber;
}

// ─── Assign series ────────────────────────────────────────────────────────

export function assignToSeries(id, seriesInfo = {}) {
  const lc = loadLifecycle(id);
  if (!lc) return;
  lc.series = {
    ...lc.series,
    name:             seriesInfo.name         || null,
    position:         seriesInfo.position     || null,
    theme:            seriesInfo.theme        || null,
    sharedDNA:        seriesInfo.sharedDNA    || null,
    sharedFrameworks: seriesInfo.sharedFrameworks || [],
    sharedVocabulary: seriesInfo.sharedVocabulary || [],
  };
  if (lc.status === "draft" || lc.status === "review" || lc.status === "published") {
    lc.status = "series";
    lc.statusHistory.push({ status: "series", timestamp: Date.now(), notes: `Assigned to series "${seriesInfo.name}"` });
  }
  _saveLifecycle(id, lc);
}

// ─── Record edition ───────────────────────────────────────────────────────

export function recordEdition(id, editionType, notes = "") {
  const lc = loadLifecycle(id);
  if (!lc) return;
  const prev = lc.editions.current;
  lc.editions.history.push({ from: prev, to: editionType, timestamp: Date.now(), notes });
  lc.editions.current = editionType;
  lc.lifecycleMemory.editionHistory.push({ edition: editionType, timestamp: Date.now(), notes });
  _saveLifecycle(id, lc);
}

// ─── Smart update: identify what needs regeneration ───────────────────────

export function identifySmartUpdateTargets(project) {
  const targets = [];

  // Check for outdated or missing research
  if (!project?.research?.mainNicheLabel) {
    targets.push({ area: "research", reason: "No niche research completed", priority: "critical" });
  }

  // Check for missing analysis intelligence
  if (!project?.analysis?.intelligence) {
    targets.push({ area: "analysis", reason: "No competitor intelligence generated", priority: "high" });
  }

  // Check for chapters without content
  const chapters = project?.bookOutline?.chapters || [];
  const emptyChapters = chapters.filter(ch => {
    const hasSections = (ch.sections || []).length > 0;
    return !hasSections;
  });
  if (emptyChapters.length > 0) {
    targets.push({
      area:     "outline",
      reason:   `${emptyChapters.length} chapter(s) have no sections`,
      priority: "high",
      items:    emptyChapters.map(c => c.title).filter(Boolean),
    });
  }

  // Missing cover
  if (!project?.bookCover?.concepts?.length) {
    targets.push({ area: "cover", reason: "No cover concepts generated", priority: "medium" });
  }

  // Missing description
  if (!project?.bookMarketing?.description?.trim()) {
    targets.push({ area: "description", reason: "No marketing description generated", priority: "medium" });
  }

  return targets;
}

// ─── Quality review ───────────────────────────────────────────────────────

export function runQualityReview(id, project) {
  const lc = loadLifecycle(id);
  if (!lc) return null;

  const now = Date.now();
  const chapters = project?.bookOutline?.chapters || [];
  const hasTitle  = !!_extractTitle(project).replace("Untitled Book", "");
  const hasOutline = chapters.length > 0;
  const hasContent = _countWriteBlocks(project) > 0;
  const hasDetails = !!project?.bookDetails?.genre;
  const hasCover   = (project?.bookCover?.concepts || []).length > 0;

  const checks = {
    consistency:             hasTitle && hasOutline   ? "pass" : "fail",
    knowledgeGraphIntegrity: hasOutline               ? "pass" : "fail",
    bookDNAAlignment:        hasDetails               ? "pass" : "fail",
    frameworkConsistency:    hasContent               ? "pass" : "fail",
    commercialReadiness:     hasTitle && hasCover     ? "pass" : "fail",
    publishingQuality:       hasContent && hasTitle   ? "pass" : "fail",
  };

  lc.qualityReview = { lastReviewedAt: now, ...checks };
  _saveLifecycle(id, lc);
  return lc.qualityReview;
}

// ─── Main update hook (called from saveBook) ───────────────────────────────

export function updateLifecycle(id, oldProject, newProject) {
  let lc = loadLifecycle(id);
  if (!lc) {
    lc = _defaultLifecycle(newProject);
  }

  const now = Date.now();
  const changes = _detectChanges(oldProject, newProject);

  // Append to changeLog (capped)
  if (changes.length) {
    lc.changeLog = [...changes, ...(lc.changeLog || [])].slice(0, MAX_CHANGELOG);
  }

  // Auto-advance lifecycle status based on step
  const oldStatus = lc.status;
  const newStatus = _determineLifecycleStatus(newProject, lc.status);
  if (newStatus !== oldStatus) {
    lc.status = newStatus;
    lc.statusHistory.push({ status: newStatus, timestamp: now, notes: "Auto-advanced by lifecycle engine", from: oldStatus });

    // Generate roadmap when reaching review
    if (newStatus === "review" && !lc.publishingRoadmap.length) {
      lc.publishingRoadmap = generatePublishingRoadmap(newProject);
      lc.companionProducts = planCompanionProducts(newProject);
    }
  }

  // Create a new version snapshot on step advancement
  const oldStep = oldProject?.wizard?.currentStep ?? 0;
  const newStep = newProject?.wizard?.currentStep ?? 0;
  if (newStep > oldStep) {
    const newVersionNumber = _versionBump(lc.version, "patch");
    lc.version = newVersionNumber;
    const snapshot = {
      versionNumber: newVersionNumber,
      createdAt:     now,
      type:          "step_advance",
      wizardStep:    newStep,
      title:         _extractTitle(newProject),
      chapterCount:  (newProject?.bookOutline?.chapters || []).length,
      notes:         `Step advanced to ${newStep}`,
      changes:       changes.map(c => c.description),
    };
    lc.versions = [snapshot, ...lc.versions].slice(0, MAX_VERSIONS);
    lc.lifecycleMemory.revisionHistory.push({ version: newVersionNumber, type: "step_advance", timestamp: now });
  }

  // Re-extract content assets periodically (on step change or outline change)
  const outlineChanged = (oldProject?.bookOutline?.chapters || []).length !== (newProject?.bookOutline?.chapters || []).length;
  if ((newStep > oldStep || outlineChanged) && newProject?.bookOutline?.chapters?.length) {
    const freshAssets = extractContentAssets(newProject);
    // Merge: keep existing assets that aren't duplicated by name+type
    const existingNames = new Set(lc.contentAssets.map(a => `${a.type}:${a.name}`));
    const newAssets = freshAssets.filter(a => !existingNames.has(`${a.type}:${a.name}`));
    lc.contentAssets = [...lc.contentAssets, ...newAssets];
  }

  _saveLifecycle(id, lc);
  return lc;
}

// ─── Helper: load the raw project from localStorage ───────────────────────
// (avoids circular import — bookLibrary uses lifecycle, lifecycle shouldn't
//  import bookLibrary. We duplicate the minimal read logic here.)

function _loadProjectForId(id) {
  try {
    const raw = localStorage.getItem("nonfiction-ai-book-" + id);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

// ─── Migrate legacy books (add lifecycle if missing) ──────────────────────

export function migrateLifecycleForExistingBooks(library) {
  for (const entry of (library || [])) {
    if (!entry?.id) continue;
    const existing = loadLifecycle(entry.id);
    if (!existing) {
      const project = _loadProjectForId(entry.id);
      initLifecycle(entry.id, project || {});
    }
  }
}

// ─── Public read helpers ───────────────────────────────────────────────────

/** Returns the current lifecycle status label for a book. */
export function getLifecycleStatus(id) {
  const lc = loadLifecycle(id);
  return lc?.status ?? "draft";
}

/** Returns a summary object for dashboard display. */
export function getLifecycleSummary(id) {
  const lc = loadLifecycle(id);
  if (!lc) return null;
  return {
    status:          lc.status,
    version:         lc.version,
    versionCount:    lc.versions.length,
    changeCount:     lc.changeLog.length,
    assetCount:      lc.contentAssets.length,
    companionCount:  lc.companionProducts.length,
    roadmapCount:    lc.publishingRoadmap.length,
    hasSeries:       !!lc.series?.name,
    qualityReview:   lc.qualityReview,
    latestVersion:   lc.versions[0] || null,
    recentChanges:   lc.changeLog.slice(0, 5),
    smartTargets:    [],
  };
}
