import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { BOOK_BUILDER_STEPS } from "../lib/constants";

export default function HomePage() {
  const [, setLocation] = useLocation();
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("start") === "1") setLocation("/dashboard");
  }, [setLocation]);

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-studio-900/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-studio-300">Nonfiction AI Studio</p>
            <p className="text-sm text-slate-400">Professional nonfiction writing system</p>
          </div>
          <nav className="flex items-center gap-2">
            <a href="#features" className="btn-secondary">Features</a>
            <a href="#process" className="btn-secondary">How it works</a>
            <button className="btn-primary" onClick={() => setLocation("/dashboard")}>Enter Studio</button>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-6 pb-16 pt-12 md:grid-cols-[1.2fr_0.8fr] md:pt-20">
        <div>
          <p className="inline-flex rounded-full border border-studio-400/40 bg-studio-400/10 px-3 py-1 text-xs text-studio-300">
            Built for business, productivity, and money-making books
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-tight md:text-6xl">
            Turn a raw idea into a structured, transformation-driven nonfiction book.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">
            This is not bulk text generation. It is an AI-guided editorial system that builds your
            manuscript progressively through strategy, frameworks, and execution-ready thinking.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button className="btn-primary" onClick={() => { setStarting(true); setLocation("/dashboard"); }}>
              {starting ? "Opening..." : "Start building your book"}
            </button>
            <a href="#process" className="btn-secondary">
              Explore the workflow
            </a>
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

      <section id="process" className="mx-auto w-full max-w-7xl px-6 pb-16">
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

      <section id="start" className="mx-auto w-full max-w-3xl px-6 pb-20">
        <div className="panel p-6 shadow-glow">
          <h3 className="text-xl font-semibold">Personal mode enabled</h3>
          <p className="mt-1 text-sm text-slate-300">
            Authentication is currently disabled for personal use. Your work autosaves locally in this browser.
          </p>
          <button className="btn-primary mt-4 w-full" onClick={() => setLocation("/dashboard")}>
            Open Book Builder
          </button>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-slate-400">
        Nonfiction AI Studio - Structured thinking. Practical transformation.
      </footer>
    </main>
  );
}
