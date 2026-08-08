import { useEffect, useState } from "react";
import { AlignLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Compass, Image, Library, ListTree, Menu, Pause, PenLine, Play, Search, Settings2, Sparkles, Type, UserRound, UserPen, X } from "lucide-react";
import { useLocation } from "wouter";
import { BOOK_BUILDER_STEPS } from "../lib/constants";
import { loadLibrary, createBook, deleteBook, migrateLegacy } from "../lib/bookLibrary";

const STEP_COUNT = BOOK_BUILDER_STEPS.length;

const features = [
  { icon: Compass, number: "01", title: "A clear point of view", text: "Shape the idea, audience, promise, and author voice before a single chapter is drafted." },
  { icon: PenLine, number: "02", title: "Progressive architecture", text: "Move from research to outline to finished pages in a sequence that protects the reader’s journey." },
  { icon: Sparkles, number: "03", title: "Useful by design", text: "Turn every concept into an example, framework, or next step your reader can actually use." },
];

const testimonials = [
  { quote: "The difference is not that it writes for me. It helps me think like the author my book requires.", name: "Maya Chen", role: "Leadership writer" },
  { quote: "I stopped staring at a blank document. There is always a thoughtful next decision to make.", name: "Jon Bell", role: "Independent consultant" },
  { quote: "My scattered notes became a real argument, with a beginning, middle, and reason to exist.", name: "Elena Brooks", role: "Founder and first-time author" },
];

const workflowDetails = [
  { icon: Search, description: ["Research workspace for exploring your book topic.", "Organizes evidence, context, and reader insight.", "Helps uncover the questions your audience cares about.", "Gives the manuscript a strong foundation before writing."], signal: "Gathering context" },
  { icon: Compass, description: ["Strategic analysis that clarifies your book’s direction.", "Reveals the strongest argument inside your research.", "Connects the audience’s need to your point of view.", "Turns scattered information into a focused editorial angle."], signal: "Finding the angle" },
  { icon: Type, description: ["Title generation for your book’s central promise.", "Creates memorable title and subtitle directions.", "Balances clarity, curiosity, and audience relevance.", "Gives you strong options before the manuscript takes shape."], signal: "Naming the promise" },
  { icon: Library, description: ["Resource library for keeping your supporting material together.", "Collects references, links, notes, and source ideas.", "Makes important research easier to find while writing.", "Keeps the book grounded in useful, organized information."], signal: "Collecting support" },
  { icon: UserRound, description: ["Author voice controls for shaping the manuscript’s tone.", "Helps your writing sound consistent and recognizable.", "Guides the AI toward your preferred style and perspective.", "Keeps every chapter aligned with the author you want to be."], signal: "Shaping the voice" },
  { icon: ListTree, description: ["Book proposal view for defining the project’s direction.", "Clarifies the reader promise and transformation.", "Shows how the idea can become a complete nonfiction book.", "Creates a shared plan before the detailed work begins."], signal: "Mapping the journey" },
  { icon: Settings2, description: ["Book blueprint settings for controlling the project.", "Defines audience, length, structure, focus, and rules.", "Sets the editorial boundaries for every later generation step.", "Keeps the final manuscript intentional instead of generic."], signal: "Setting the constraints" },
  { icon: UserPen, description: ["Author profile builder for creating your book identity.", "Shapes the byline and biography around your expertise.", "Adds context that helps readers understand your authority.", "Makes the finished book feel personal and credible."], signal: "Making it yours" },
  { icon: ListTree, description: ["Outline generator for planning the complete manuscript.", "Maps a coherent chapter sequence before long-form writing.", "Places ideas in the order readers need to understand them.", "Prevents repetition, gaps, and disconnected chapters."], signal: "Building the structure" },
  { icon: PenLine, description: ["Progressive writing workspace for drafting the manuscript.", "Builds connected chapters and sections step by step.", "Adds exercises, examples, frameworks, and practical takeaways.", "Keeps the reader’s transformation consistent from start to finish."], signal: "Writing the book" },
  { icon: AlignLeft, description: ["Book description generator for presenting the finished work.", "Turns the manuscript’s central argument into clear sales copy.", "Highlights the reader problem, promise, and practical outcome.", "Gives your book a compelling description for launch and sharing."], signal: "Clarifying the promise" },
  { icon: Image, description: ["Book cover creator for shaping the first impression.", "Develops a visual direction matched to title and audience.", "Uses the book’s subject and genre to guide the concept.", "Helps the finished project look as considered as it reads."], signal: "Designing the first impression" },
  { icon: CheckCircle2, description: ["Finalization and export tools for completing the project.", "Reviews the manuscript and its supporting book materials.", "Prepares a polished version ready to download and share.", "Turns the work inside the studio into a finished book."], signal: "Ready to share" },
];

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

function Logo() {
  return (
    <a href="#top" className="flex items-center gap-3" data-testid="link-logo">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--ink))] text-[hsl(var(--paper))]">
        <BookOpen size={17} strokeWidth={1.8} />
      </span>
      <span className="text-sm font-semibold tracking-[-0.02em]">Nonfiction <span className="text-[hsl(var(--accent))]">AI</span> Studio</span>
    </a>
  );
}

function LibrarySection({ books, onNewBook, onOpen, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  return (
    <section id="library" className="mx-auto w-full max-w-6xl px-5 pb-20 pt-14 sm:px-8" data-testid="section-library">
      <div className="editorial-rule mb-8 flex items-end justify-between gap-5 pt-5">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h2 className="display-serif mt-2 text-3xl sm:text-4xl">The books in progress</h2>
          <p className="mt-2 text-sm text-[hsl(var(--ink-muted))]">
            {books.length === 0 ? "Your next idea has a place to begin." : `${books.length} book${books.length === 1 ? "" : "s"} in your library`}
          </p>
        </div>
        <button className="btn-secondary hidden sm:inline-flex" onClick={onNewBook} data-testid="button-new-book-library">Start a new book <ArrowRight size={15} /></button>
      </div>
      {books.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {books.map((book) => {
            const pct = Math.round(((book.currentStep + 1) / STEP_COUNT) * 100);
            const stepLabel = BOOK_BUILDER_STEPS[book.currentStep]?.label ?? "Step 1";
            return (
              <article key={book.id} className="feature-card rounded-[1.35rem] p-5" data-testid={`card-book-${book.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent-soft))] text-[hsl(var(--accent))]"><BookOpen size={18} /></div>
                    <div className="min-w-0"><h3 className="truncate font-semibold">{book.title}</h3><p className="mt-1 text-xs text-[hsl(var(--ink-muted))]">{timeAgo(book.updatedAt)}</p></div>
                  </div>
                  <button className="rounded-full p-1.5 text-[hsl(var(--ink-muted))] transition hover:bg-[hsl(var(--accent-soft))] hover:text-[hsl(var(--accent))]" onClick={() => setConfirmDelete(book.id)} title="Delete book" aria-label={`Delete ${book.title}`} data-testid={`button-delete-book-${book.id}`}><X size={16} /></button>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs text-[hsl(var(--ink-muted))]"><span>{stepLabel}</span><span>{pct}%</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--paper-deep))]"><div className="h-full rounded-full bg-[hsl(var(--accent))] transition-all" style={{ width: `${pct}%` }} /></div>
                <button className="btn-primary mt-5 w-full text-sm" onClick={() => onOpen(book.id)} data-testid={`button-continue-book-${book.id}`}>Continue writing <ArrowRight size={15} /></button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[1.35rem] border border-dashed border-[hsl(var(--line))] bg-[hsl(var(--paper)/.35)] px-5 py-12 text-center" data-testid="empty-library">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--accent-soft))] text-[hsl(var(--accent))]"><BookOpen size={20} /></span>
          <h3 className="display-serif mt-4 text-2xl">No books yet</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--ink-muted))]">Start your first nonfiction book. The studio will guide you through research, outline, writing, and export.</p>
          <button className="btn-primary mt-6" onClick={onNewBook} data-testid="button-start-first-book">Start your first book <ArrowRight size={15} /></button>
        </div>
      )}
      <button className="btn-secondary mt-4 w-full sm:hidden" onClick={onNewBook} data-testid="button-new-book-library-mobile">Start a new book <ArrowRight size={15} /></button>
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--ink)/.45)] p-5 backdrop-blur-sm" role="dialog" aria-modal="true" data-testid="dialog-delete-book">
          <div className="w-full max-w-sm rounded-[1.35rem] bg-[hsl(var(--paper))] p-6 shadow-2xl">
            <p className="eyebrow">Permanent action</p><h3 className="display-serif mt-2 text-2xl">Delete this book?</h3>
            <p className="mt-3 text-sm leading-6 text-[hsl(var(--ink-muted))]">This will permanently remove the book and all its content. This cannot be undone.</p>
            <div className="mt-6 flex gap-3"><button className="btn-secondary flex-1" onClick={() => setConfirmDelete(null)} data-testid="button-cancel-delete">Cancel</button><button className="flex-1 rounded-full bg-[hsl(var(--accent))] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90" onClick={() => { onDelete(confirmDelete); setConfirmDelete(null); }} data-testid="button-confirm-delete">Delete book</button></div>
          </div>
        </div>
      )}
    </section>
  );
}

function HomePage() {
  const [, setLocation] = useLocation();
  const [books, setBooks] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);
  const [workflowResetKey, setWorkflowResetKey] = useState(0);
  const [workflowPaused, setWorkflowPaused] = useState(false);

  useEffect(() => {
    migrateLegacy();
    setBooks(loadLibrary());
  }, []);

  useEffect(() => {
    if (workflowPaused) return undefined;
    const timer = window.setTimeout(() => {
      setActiveWorkflowStep((current) => (current + 1) % BOOK_BUILDER_STEPS.length);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [activeWorkflowStep, workflowPaused, workflowResetKey]);

  function handleNewBook() {
    const id = createBook();
    setLocation(`/dashboard?bookId=${id}`);
  }

  function goToWorkflowStep(index) {
    const nextIndex = (index + BOOK_BUILDER_STEPS.length) % BOOK_BUILDER_STEPS.length;
    setActiveWorkflowStep(nextIndex);
    setWorkflowResetKey((current) => current + 1);
  }

  function toggleWorkflowPause() {
    setWorkflowPaused((paused) => {
      if (paused) setWorkflowResetKey((current) => current + 1);
      return !paused;
    });
  }

  function handleOpen(id) { setLocation(`/dashboard?bookId=${id}`); }
  function handleDelete(id) { deleteBook(id); setBooks(loadLibrary()); }
  function closeMenu() { setMenuOpen(false); }

  return (
    <main id="top" className="landing-page min-h-[100dvh]">
      <div className="landing-content">
        <header className="sticky top-0 z-40 border-b border-[hsl(var(--line)/.72)] bg-[hsl(var(--paper)/.8)] backdrop-blur-xl">
          <div className="mx-auto flex h-[4.5rem] w-full max-w-6xl items-center justify-between px-5 sm:px-8">
            <Logo />
            <nav className="hidden items-center gap-7 text-sm text-[hsl(var(--ink-muted))] md:flex" aria-label="Main navigation">
              <a href="#features" className="safe-link" data-testid="link-features-nav">Features</a>
              <a href="#process" className="safe-link" data-testid="link-process-nav">How it works</a>
              <a href="#pricing" className="safe-link" data-testid="link-pricing-nav">Pricing</a>
              <a href="#library" className="safe-link" data-testid="link-library-nav">Your books</a>
              <button className="btn-primary ml-2 px-4 py-2.5" onClick={handleNewBook} data-testid="button-new-book-nav">New book <ArrowRight size={14} /></button>
            </nav>
            <button className="rounded-full border border-[hsl(var(--line))] p-2.5 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"} data-testid="button-mobile-menu">{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
          </div>
          {menuOpen && <nav className="border-t border-[hsl(var(--line))] px-5 py-4 md:hidden" aria-label="Mobile navigation">
            <div className="flex flex-col gap-1 text-sm">
              {[["#features", "Features"], ["#process", "How it works"], ["#pricing", "Pricing"], ["#library", "Your books"]].map(([href, label]) => <a key={href} href={href} onClick={closeMenu} className="rounded-xl px-3 py-3 text-[hsl(var(--ink-muted))] hover:bg-[hsl(var(--paper-deep))]" data-testid={`link-mobile-${label.toLowerCase().replaceAll(" ", "-")}`}>{label}</a>)}
              <button className="btn-primary mt-2" onClick={() => { closeMenu(); handleNewBook(); }} data-testid="button-mobile-new-book">Start a new book <ArrowRight size={15} /></button>
            </div>
          </nav>}
        </header>

        <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-24 pt-20 sm:px-8 md:grid-cols-[1.05fr_.95fr] md:items-center md:pb-32 md:pt-28" data-testid="section-hero">
          <div>
            <div className="landing-reveal eyebrow flex items-center gap-2"><span className="h-px w-7 bg-[hsl(var(--accent))]" /> A quieter way to write a meaningful book</div>
            <h1 className="landing-reveal landing-delay-1 display-serif mt-6 max-w-3xl text-[3.65rem] leading-[.98] sm:text-6xl lg:text-[5.8rem]">Your ideas deserve <em className="text-[hsl(var(--accent))]">a real book.</em></h1>
            <p className="landing-reveal landing-delay-2 mt-7 max-w-xl text-lg leading-8 text-[hsl(var(--ink-muted))]">Nonfiction AI Studio is an editorial workspace for turning a sharp idea into a structured, transformation-driven nonfiction book.</p>
            <div className="landing-reveal landing-delay-3 mt-8 flex flex-wrap gap-3"><button className="btn-primary" onClick={handleNewBook} data-testid="button-hero-start">Start a new book <ArrowRight size={16} /></button><a href="#process" className="btn-secondary" data-testid="link-hero-workflow">See the workflow <ChevronDown size={16} /></a></div>
            <div className="landing-reveal landing-delay-4 mt-10 flex items-center gap-5 text-xs text-[hsl(var(--ink-muted))]"><span className="flex items-center gap-2"><Check size={14} className="text-[hsl(var(--sage))]" /> Built for serious nonfiction</span><span className="hidden h-4 w-px bg-[hsl(var(--line))] sm:block" /><span>From first thought to final page</span></div>
          </div>
          <div className="relative mx-auto w-full max-w-[30rem] md:max-w-none">
            <div className="absolute -inset-5 rounded-[2rem] bg-[hsl(var(--accent-soft)/.45)] blur-2xl" />
            <div className="floating-sheet relative rotate-[-2deg] rounded-[1.4rem] border border-[hsl(var(--line))] bg-[hsl(var(--paper))] p-5 shadow-[0_24px_60px_hsl(var(--ink)/.14)] sm:p-7">
              <div className="flex items-center justify-between border-b border-[hsl(var(--line))] pb-4"><span className="eyebrow">Manuscript / 01</span><span className="font-mono text-[10px] text-[hsl(var(--ink-muted))]">IN PROGRESS</span></div>
              <p className="mt-8 font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--ink-muted))]">Working title</p>
              <h2 className="display-serif mt-3 text-4xl leading-[.98] sm:text-5xl">The work<br /><em className="text-[hsl(var(--accent))]">beneath</em> the work</h2>
              <p className="mt-5 max-w-xs text-sm leading-6 text-[hsl(var(--ink-muted))]">A practical guide to building a life and business around the things that matter.</p>
              <div className="mt-10 border-t border-[hsl(var(--line))] pt-4"><div className="flex justify-between text-xs text-[hsl(var(--ink-muted))]"><span>Research</span><span className="font-mono">04 / 13</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-[hsl(var(--paper-deep))]"><div className="h-full w-[31%] rounded-full bg-[hsl(var(--accent))]" /></div></div>
            </div>
            <div className="absolute -bottom-5 -left-4 rounded-xl border border-[hsl(var(--line))] bg-[hsl(var(--paper))] px-4 py-3 shadow-lg sm:-left-8"><p className="eyebrow text-[.58rem]">Next decision</p><p className="mt-1 text-sm font-semibold">Define the reader’s shift</p></div>
          </div>
        </section>

        <LibrarySection books={books} onNewBook={handleNewBook} onOpen={handleOpen} onDelete={handleDelete} />

        <section id="features" className="mx-auto w-full max-w-6xl px-5 pb-28 sm:px-8" data-testid="section-features">
          <div className="grid gap-8 border-t border-[hsl(var(--line))] pt-8 md:grid-cols-[.8fr_1.2fr]"><div><p className="eyebrow">The studio approach</p><h2 className="display-serif mt-3 max-w-sm text-4xl leading-tight sm:text-5xl">Less prompting.<br /><em className="text-[hsl(var(--accent))]">More authorship.</em></h2></div><div className="grid gap-4 sm:grid-cols-3">{features.map(({ icon: Icon, number, title, text }) => <article key={number} className="feature-card rounded-[1.25rem] p-5" data-testid={`card-feature-${number}`}><div className="flex items-center justify-between"><Icon size={20} strokeWidth={1.5} className="text-[hsl(var(--accent))]" /><span className="font-mono text-xs text-[hsl(var(--ink-muted))]">{number}</span></div><h3 className="mt-10 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--ink-muted))]">{text}</p></article>)}</div></div>
        </section>

        <section id="process" className="bg-[hsl(var(--ink))] px-5 py-24 text-[hsl(var(--paper))] sm:px-8 md:py-32" data-testid="section-process">
          <div className="mx-auto w-full max-w-6xl">
            <div className="grid gap-12 md:grid-cols-[.72fr_1.28fr]">
              <div>
                <p className="eyebrow">How it works</p>
                <h2 className="display-serif mt-4 max-w-md text-5xl leading-[.98] sm:text-6xl">A book is built one <em className="text-[hsl(var(--accent))]">good decision</em> at a time.</h2>
                <p className="mt-7 max-w-sm text-sm leading-7 text-[hsl(var(--paper)/.64)]">The studio turns an overwhelming project into 13 clear, editorial choices. You stay in the driver’s seat while the manuscript takes shape.</p>
                <div className="mt-8 flex items-center gap-3 text-xs text-[hsl(var(--paper)/.52)]">
                  <span className="workflow-pulse h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />
                  <span>Live walkthrough</span>
                  <span className="font-mono text-[hsl(var(--accent))]">{String(activeWorkflowStep + 1).padStart(2, "0")} / {String(BOOK_BUILDER_STEPS.length).padStart(2, "0")}</span>
                </div>
              </div>

              <div className="workflow-panel">
                <div className="workflow-stage" key={BOOK_BUILDER_STEPS[activeWorkflowStep].id}>
                  <div className="flex items-start justify-between gap-4 border-b border-[hsl(var(--paper)/.14)] pb-5">
                    <div className="flex items-center gap-4">
                      {(() => {
                        const Icon = workflowDetails[activeWorkflowStep].icon;
                        return <span className="workflow-stage-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/.16)] text-[hsl(var(--accent))]"><Icon size={22} strokeWidth={1.6} /></span>;
                      })()}
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">Step {String(activeWorkflowStep + 1).padStart(2, "0")}</p>
                        <h3 className="display-serif mt-1 text-3xl">{BOOK_BUILDER_STEPS[activeWorkflowStep].label}</h3>
                      </div>
                    </div>
                    <span className="hidden rounded-full border border-[hsl(var(--paper)/.16)] px-3 py-1.5 font-mono text-[10px] text-[hsl(var(--paper)/.55)] sm:inline-flex">{workflowDetails[activeWorkflowStep].signal}</span>
                  </div>
                  <div className="mt-8 rounded-2xl border border-[hsl(var(--paper)/.12)] bg-[hsl(var(--paper)/.05)] p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--accent))]">Feature provided</p>
                    <p className="mt-3 space-y-1 text-sm leading-6 text-[hsl(var(--paper)/.72)]">
                      {workflowDetails[activeWorkflowStep].description.map((line) => <span key={line} className="block">{line}</span>)}
                    </p>
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-4">
                    <span className="text-xs text-[hsl(var(--paper)/.45)]">{workflowPaused ? "Paused — take your time" : "Auto-advances in 5 seconds"}</span>
                    <div className="flex items-center gap-2">
                      <button
                        className="workflow-arrow"
                        onClick={() => goToWorkflowStep(activeWorkflowStep - 1)}
                        aria-label="Go to previous workflow step"
                        data-testid="button-workflow-previous"
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <button
                        className="workflow-arrow"
                        onClick={toggleWorkflowPause}
                        aria-label={workflowPaused ? "Resume workflow animation" : "Pause workflow animation"}
                        aria-pressed={workflowPaused}
                        data-testid="button-workflow-pause"
                      >
                        {workflowPaused ? <Play size={15} /> : <Pause size={15} />}
                      </button>
                      <button
                        className="workflow-arrow"
                        onClick={() => goToWorkflowStep(activeWorkflowStep + 1)}
                        aria-label="Go to next workflow step"
                        data-testid="button-workflow-next"
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </div>
                  <div key={`timer-${workflowResetKey}-${activeWorkflowStep}`} className={`workflow-countdown mt-4 h-0.5 w-full rounded-full bg-[hsl(var(--paper)/.1)] ${workflowPaused ? "workflow-countdown-paused" : ""}`} aria-hidden="true" />
                </div>

                <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-1 border-t border-[hsl(var(--paper)/.14)] pt-5 sm:grid-cols-3 lg:grid-cols-4">
                  {BOOK_BUILDER_STEPS.map((step, index) => (
                    <button
                      key={step.id}
                      className={`workflow-step flex items-center gap-2 rounded-lg px-2 py-2.5 text-left text-xs transition ${index === activeWorkflowStep ? "workflow-step-active" : "text-[hsl(var(--paper)/.45)] hover:bg-[hsl(var(--paper)/.06)] hover:text-[hsl(var(--paper)/.8)]"}`}
                      onClick={() => goToWorkflowStep(index)}
                      aria-label={`Show step ${index + 1}: ${step.label}`}
                      aria-current={index === activeWorkflowStep ? "step" : undefined}
                      data-testid={`button-workflow-step-${step.id}`}
                    >
                      <span className="font-mono text-[10px]">{String(index + 1).padStart(2, "0")}</span>
                      <span className="truncate">{step.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="reviews" className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 md:py-32" data-testid="section-reviews">
          <div className="flex flex-col justify-between gap-5 border-t border-[hsl(var(--line))] pt-8 sm:flex-row sm:items-end"><div><p className="eyebrow">From the writing desk</p><h2 className="display-serif mt-3 text-4xl sm:text-5xl">Authors on finding<br /><em className="text-[hsl(var(--accent))]">their way through.</em></h2></div><p className="max-w-xs text-sm leading-6 text-[hsl(var(--ink-muted))]">A better writing experience is not louder. It is more considered.</p></div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">{testimonials.map((item, index) => <figure key={item.name} className={`rounded-[1.25rem] border border-[hsl(var(--line))] p-6 ${index === 1 ? "bg-[hsl(var(--accent-soft))]" : "bg-[hsl(var(--paper)/.5)]"}`} data-testid={`card-testimonial-${index}`}><div className="font-serif text-4xl leading-none text-[hsl(var(--accent))]">“</div><blockquote className="mt-3 font-serif text-xl leading-8">{item.quote}</blockquote><figcaption className="mt-8 border-t border-[hsl(var(--line))] pt-4 text-xs"><span className="font-semibold">{item.name}</span><span className="ml-2 text-[hsl(var(--ink-muted))]">{item.role}</span></figcaption></figure>)}</div>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-6xl px-5 pb-28 sm:px-8 md:pb-36" data-testid="section-pricing">
          <div className="rounded-[1.7rem] border border-[hsl(var(--line))] bg-[hsl(var(--paper-deep)/.45)] p-7 sm:p-10 md:flex md:items-center md:justify-between md:p-14"><div><p className="eyebrow">Simple by design</p><h2 className="display-serif mt-3 text-4xl sm:text-5xl">Make room for<br /><em className="text-[hsl(var(--accent))]">the book.</em></h2><p className="mt-5 max-w-md text-sm leading-7 text-[hsl(var(--ink-muted))]">Start shaping your idea in the studio today. No complicated plan to choose before you know what your book wants to become.</p></div><div className="mt-10 md:mt-0 md:w-64"><div className="border-y border-[hsl(var(--line))] py-5"><p className="text-xs text-[hsl(var(--ink-muted))]">Studio access</p><p className="mt-1 font-serif text-3xl">Free to begin</p><p className="mt-2 text-xs text-[hsl(var(--ink-muted))]">Build your first book, one step at a time.</p></div><button className="btn-primary mt-5 w-full" onClick={handleNewBook} data-testid="button-pricing-start">Start writing <ArrowRight size={15} /></button></div></div>
        </section>

        <section className="bg-[hsl(var(--accent))] px-5 py-24 text-center text-white sm:px-8 md:py-32" data-testid="section-cta"><p className="font-mono text-xs uppercase tracking-[.18em] text-white/70">The first page is a decision</p><h2 className="display-serif mx-auto mt-5 max-w-3xl text-5xl leading-[.95] sm:text-7xl">Give the idea a place to become real.</h2><button className="mt-9 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--ink))] px-6 py-3.5 text-sm font-semibold text-[hsl(var(--paper))] transition hover:-translate-y-0.5" onClick={handleNewBook} data-testid="button-cta-start">Start a new book <ArrowRight size={16} /></button></section>

        <footer className="bg-[hsl(var(--ink))] px-5 pb-8 pt-14 text-[hsl(var(--paper))] sm:px-8" data-testid="footer-main"><div className="mx-auto grid w-full max-w-6xl gap-12 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr]"><div><Logo /><p className="mt-5 max-w-xs text-sm leading-6 text-[hsl(var(--paper)/.55)]">A professional nonfiction writing system for ideas worth carrying forward.</p></div><div><p className="eyebrow text-[hsl(var(--accent))]">Explore</p><div className="mt-4 flex flex-col gap-3 text-sm text-[hsl(var(--paper)/.65)]"><a href="#features" className="hover:text-white" data-testid="link-footer-features">Features</a><a href="#process" className="hover:text-white" data-testid="link-footer-process">How it works</a><a href="#pricing" className="hover:text-white" data-testid="link-footer-pricing">Pricing</a></div></div><div><p className="eyebrow text-[hsl(var(--accent))]">Your studio</p><div className="mt-4 flex flex-col gap-3 text-sm text-[hsl(var(--paper)/.65)]"><a href="#library" className="hover:text-white" data-testid="link-footer-library">Your books</a><button className="w-fit hover:text-white" onClick={handleNewBook} data-testid="button-footer-new-book">New book</button></div></div><div><p className="eyebrow text-[hsl(var(--accent))]">A note</p><p className="mt-4 text-sm leading-6 text-[hsl(var(--paper)/.65)]">Good nonfiction changes what a reader believes they can do next.</p></div></div><div className="mx-auto mt-14 flex max-w-6xl flex-col gap-3 border-t border-[hsl(var(--paper)/.16)] pt-5 text-xs text-[hsl(var(--paper)/.42)] sm:flex-row sm:justify-between"><span>© {new Date().getFullYear()} Nonfiction AI Studio</span><a href="#top" className="hover:text-white" data-testid="link-back-top">Back to top ↑</a></div></footer>
      </div>
    </main>
  );
}

export default HomePage;