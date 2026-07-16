import {
  initLifecycle,
  updateLifecycle,
  removeLifecycle,
  migrateLifecycleForExistingBooks,
} from "./bookLifecycle.js";

const LIBRARY_KEY = "nonfiction-ai-library";
const BOOK_PREFIX  = "nonfiction-ai-book-";
const LEGACY_KEY   = "nonfiction-ai-project";

export function loadLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function _saveLibrary(books) {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(books));
  } catch {}
}

export function loadBook(id) {
  try {
    const raw = localStorage.getItem(BOOK_PREFIX + id);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function saveBook(id, project) {
  // Load previous version for change detection before overwriting
  const oldProject = loadBook(id);

  try {
    localStorage.setItem(BOOK_PREFIX + id, JSON.stringify(project));
  } catch {}

  // ── Publishing Lifecycle Engine hook ──────────────────────────────────────
  try {
    updateLifecycle(id, oldProject, project);
  } catch { /* lifecycle is non-critical — never block a save */ }
  // ─────────────────────────────────────────────────────────────────────────

  const library = loadLibrary();
  const title =
    (project?.bookDetails?.title && String(project.bookDetails.title).trim()) ||
    (project?.bookTitle?.customTitle && String(project.bookTitle.customTitle).trim()) ||
    (project?.bookTitle?.pickedFromAi && String(project.bookTitle.pickedFromAi).trim()) ||
    (project?.research?.topic && String(project.research.topic).trim()) ||
    "Untitled Book";
  const step = project?.wizard?.currentStep ?? 0;
  const idx = library.findIndex((b) => b.id === id);
  const entry = { id, title, updatedAt: Date.now(), currentStep: step };
  if (idx >= 0) {
    library[idx] = { ...library[idx], ...entry };
  } else {
    library.unshift({ ...entry, createdAt: Date.now() });
  }
  _saveLibrary(library);
}

export function createBook() {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const library = loadLibrary();
  library.unshift({ id, title: "New Book", createdAt: Date.now(), updatedAt: Date.now(), currentStep: 0 });
  _saveLibrary(library);

  // ── Publishing Lifecycle Engine hook ──────────────────────────────────────
  try {
    initLifecycle(id, {});
  } catch { /* non-critical */ }
  // ─────────────────────────────────────────────────────────────────────────

  return id;
}

export function deleteBook(id) {
  try { localStorage.removeItem(BOOK_PREFIX + id); } catch {}

  // ── Publishing Lifecycle Engine hook ──────────────────────────────────────
  try {
    removeLifecycle(id);
  } catch { /* non-critical */ }
  // ─────────────────────────────────────────────────────────────────────────

  _saveLibrary(loadLibrary().filter((b) => b.id !== id));
}

export function migrateLegacy() {
  const library = loadLibrary();
  if (library.length > 0) {
    // ── Migrate lifecycle for pre-existing books ───────────────────────────
    try {
      migrateLifecycleForExistingBooks(library);
    } catch { /* non-critical */ }
    // ──────────────────────────────────────────────────────────────────────
    return;
  }

  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return;
  try {
    const project = JSON.parse(raw);
    const id = "legacy";
    const title =
      (project?.bookDetails?.title && String(project.bookDetails.title).trim()) ||
      (project?.bookTitle?.customTitle && String(project.bookTitle.customTitle).trim()) ||
      (project?.bookTitle?.pickedFromAi && String(project.bookTitle.pickedFromAi).trim()) ||
      (project?.research?.topic && String(project.research.topic).trim()) ||
      "My Book";
    localStorage.setItem(BOOK_PREFIX + id, raw);
    _saveLibrary([{ id, title, createdAt: Date.now(), updatedAt: Date.now(), currentStep: project?.wizard?.currentStep ?? 0 }]);

    // ── Init lifecycle for migrated legacy book ────────────────────────────
    try {
      initLifecycle(id, project);
    } catch { /* non-critical */ }
    // ──────────────────────────────────────────────────────────────────────
  } catch {}
}
