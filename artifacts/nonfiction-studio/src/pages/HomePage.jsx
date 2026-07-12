import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { BOOK_BUILDER_STEPS } from "../lib/constants";
import { loadLibrary, createBook, deleteBook, migrateLegacy } from "../lib/bookLibrary";

const STEP_COUNT = BOOK_BUILDER_STEPS.length;

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function HomePage() {
  const [, setLocation] = useLocation();
  const [books, setBooks] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    migrateLegacy();
    setBooks(loadLibrary());
  }, []);

  function handleNewBook() {
    const id = createBook();
    setLocation(`/dashboard?bookId=${id}`);
  }

  function handleOpen(id) {
    setLocation(`/dashboard?bookId=${id}`);
  }

  function handleDelete(id) {
    deleteBook(id);
    setBooks(loadLibrary());
    setConfirmDelete(null);
  }

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-studio-900/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-studio-300">Nonfiction AI Studio</p>
            <p className="text-sm text-slate-400">Professional nonfiction writing system</p>
          </div>
          <nav className="flex items-center gap-2">
            <a href="#features" className="btn-secondary">Features</a>
            <a href="#process" className="btn-secondary">How it works</a>
            <button className="btn-primary" onClick={handleNewBook}>+ New Book</button>
          </nav>
        </div>
      </header>

      {/* Books library */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-8 pt-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Your Books</h2>
            <p className="mt-1 text-sm text-slate-400">
              {books.length === 0
                ? "No books yet — create your first one below."
                : `${books.length} book${books.length === 1 ? "" : "s"} in your library`}
            </p>
          </div>
          <button className="btn-primary" onClick={handleNewBook}>+ New Book</button>
        </div>

        {books.length > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((book) => {
              const pct = Math.round(((book.currentStep + 1) / STEP_COUNT) * 100);
              const stepLabel = BOOK_BUILDER_STEPS[book.currentStep]?.label ?? "Step 1";
              return (
                <div
                  key={book.id}
                  className="panel flex flex-col gap-3 p-5 transition hover:shadow-glow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-white leading-snug">{book.title}</h3>
                      <p className="mt-0.5 text-xs text-slate-400">{timeAgo(book.updatedAt)}</p>
                    </div>
                    <button
                      onClick={() => setConfirmDelete(book.id)}
                      className="shrink-0 rounded p-1 text-slate-500 transition hover:bg-red-900/30 hover:text-red-400"
                      title="Delete book"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                      <span>{stepLabel}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/60">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <button
                    className="btn-primary mt-1 w-full text-sm"
                    onClick={() => handleOpen(book.id)}
                  >
                    Continue writing →
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {books.length === 0 && (
          <div className="panel mt-6 flex flex-col items-center gap-4 py-14 text-center">
            <p className="text-4xl">📖</p>
            <p className="text-lg font-semibold text-slate-200">No books yet</p>
            <p className="max-w-sm text-sm text-slate-400">
              Start your first nonfiction book — the studio guides you step-by-step through research, outline, writing, and export.
            </p>
            <button className="btn-primary" onClick={handleNewBook}>
              Start your first book
            </button>
          </div>
        )}
      </section>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-7xl gap-8 px-6 pb-16 pt-4 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="inline-flex rounded-full border border-studio-400/40 bg-studio-400/10 px-3 py-1 text-xs text-studio-300">
            Built for business, productivity, and money-making books
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-tight md:text-5xl">
            Turn a raw idea into a structured, transformation-driven nonfiction book.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">
            An AI-guided editorial system that builds your manuscript progressively through strategy, frameworks, and execution-ready thinking.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button className="btn-primary" onClick={handleNewBook}>
              Start a new book
            </button>
            <a href="#process" className="btn-secondary">Explore the workflow</a>
          </div>
        </div>

        <div className="panel p-5 shadow-glow">
          <p className="text-sm font-semibold text-studio-300">Transformation Logic</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            <li>1. Reader pain and confusion mapped clearly</li>
            <li>2. New clarity through strategic reframing</li>
            <li>3. Systems and models introduced progressively</li>
            <li>4. Practical execution plans for real outcomes</li>
            <li>5. No fluff, no repetition, no vague advice</li>
          </ul>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-7xl px-6 pb-16">
        <h2 className="text-3xl font-bold">Premium writing studio experience</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="panel p-5">
            <h3 className="font-semibold">Strategic AI editor</h3>
            <p className="mt-2 text-sm text-slate-300">
              Every output is reviewed through a nonfiction strategist lens, replacing weak writing with frameworks.
            </p>
          </article>
          <article className="panel p-5">
            <h3 className="font-semibold">Progressive chapter architecture</h3>
            <p className="mt-2 text-sm text-slate-300">
              Build chapter-by-chapter from pain to transformation, with layered concept depth and continuity.
            </p>
          </article>
          <article className="panel p-5">
            <h3 className="font-semibold">Execution-ready outputs</h3>
            <p className="mt-2 text-sm text-slate-300">
              Each lesson includes examples, mental models, and practical execution steps your readers can apply.
            </p>
          </article>
        </div>
      </section>

      <section id="process" className="mx-auto w-full max-w-7xl px-6 pb-20">
        <h2 className="text-3xl font-bold">How the system builds your book</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {BOOK_BUILDER_STEPS.map((item, i) => (
            <div key={item.id} className="panel p-4 text-sm text-slate-200">
              <span className="font-medium text-studio-300">{i + 1}. </span>
              {item.label}
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-slate-400">
        Nonfiction AI Studio — Structured thinking. Practical transformation.
      </footer>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="panel mx-4 max-w-sm p-6">
            <h3 className="font-semibold text-white">Delete this book?</h3>
            <p className="mt-2 text-sm text-slate-300">
              This will permanently remove the book and all its content. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                onClick={() => handleDelete(confirmDelete)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
