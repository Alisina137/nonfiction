import { AnimatePresence, motion } from "framer-motion";
import {
  AlignLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleDot,
  FileText,
  Layers3,
  Network,
  PenLine,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const SCENES = [
  { id: "idea", label: "Idea" },
  { id: "research", label: "Research" },
  { id: "architecture", label: "Architecture" },
  { id: "write", label: "Write" },
  { id: "normalize", label: "Normalize" },
  { id: "publish", label: "Publish" },
];

const SCENE_DURATIONS = [4100, 5200, 5000, 5600, 4700, 5600];
const TOTAL_DURATION = SCENE_DURATIONS.reduce((sum, duration) => sum + duration, 0);
const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;

const ease = [0.16, 1, 0.3, 1] as const;
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.72, ease } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.36, ease: [0.4, 0, 1, 1] as const } },
};

function BrandMark() {
  return (
    <div className="brand-mark" aria-label="Nonfiction AI Studio">
      <span className="brand-mark-symbol"><span /></span>
      <span className="brand-mark-name">NONFICTION <b>AI STUDIO</b></span>
    </div>
  );
}

function ProgressRail({ scene }: { scene: number }) {
  return (
    <div className="progress-rail" aria-hidden="true">
      {SCENES.map((item, index) => (
        <div className={`progress-step ${index <= scene ? "is-active" : ""}`} key={item.id}>
          <span className="progress-dot" />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function CornerStamp({ children }: { children: string }) {
  return <div className="corner-stamp">{children}</div>;
}

function PaperGrid() {
  return (
    <div className="paper-grid" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, index) => <i key={index} />)}
    </div>
  );
}

function SceneIdea() {
  return (
    <motion.div className="scene scene-idea" initial="initial" animate="animate" exit="exit">
      <motion.div className="idea-image" variants={fadeUp} transition={{ delay: 0.08 }}>
        <img src={asset("video-editorial-desk.jpg")} alt="" />
        <div className="image-wash" />
        <div className="scribble scribble-one" />
        <div className="scribble scribble-two" />
      </motion.div>
      <motion.div className="idea-copy" variants={fadeUp} transition={{ delay: 0.26 }}>
        <div className="eyebrow">01 / BEGIN WITH A QUESTION</div>
        <h1>Turn the<br /><em>hunch</em> into<br />a book.</h1>
        <p>A focused space for the ideas that keep returning.</p>
      </motion.div>
      <motion.div className="idea-note" variants={fadeUp} transition={{ delay: 0.6 }}>
        <PenLine size={13} />
        <span>What do you know that deserves a clearer shape?</span>
      </motion.div>
      <motion.div className="idea-orbit" animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: "linear" }} />
      <CornerStamp>PROJECT / 001</CornerStamp>
    </motion.div>
  );
}

function ResearchCard({ title, meta, tone = "cream", delay = 0 }: { title: string; meta: string; tone?: string; delay?: number }) {
  return (
    <motion.div className={`research-card ${tone}`} variants={fadeUp} transition={{ delay }}>
      <div className="research-card-top"><FileText size={14} /><span>{meta}</span><ArrowUpRight size={12} /></div>
      <h3>{title}</h3>
      <div className="research-lines"><i /><i /><i /></div>
    </motion.div>
  );
}

function SceneResearch() {
  return (
    <motion.div className="scene scene-research" initial="initial" animate="animate" exit="exit">
      <div className="research-header">
        <motion.div variants={fadeUp}>
          <div className="eyebrow">02 / RESEARCH, WITHOUT THE RABBIT HOLE</div>
          <h2>Find the<br /><em>signal.</em></h2>
        </motion.div>
        <motion.div className="search-orb" animate={{ scale: [1, 1.07, 1], rotate: [0, 8, 0] }} transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}>
          <Search size={18} />
        </motion.div>
      </div>
      <div className="research-cards">
        <ResearchCard title="The overlooked middle" meta="SOURCE NOTE / 07" delay={0.22} />
        <ResearchCard title="A pattern in the margins" meta="INTERVIEW / 12" tone="sage" delay={0.4} />
        <ResearchCard title="Why this matters now" meta="FIELD NOTE / 19" tone="rust" delay={0.58} />
      </div>
      <motion.div className="research-thread" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.62, duration: 0.9, ease }} />
      <motion.div className="research-footer" variants={fadeUp} transition={{ delay: 0.85 }}>
        <span className="status-pip" /> 19 sources connected
        <span className="footer-arrow"><ChevronRight size={14} /></span>
      </motion.div>
      <CornerStamp>KNOWLEDGE GRAPH / LIVE</CornerStamp>
    </motion.div>
  );
}

function SceneArchitecture() {
  const chapters = ["The premise", "The hidden system", "A new practice", "The way forward"];
  return (
    <motion.div className="scene scene-architecture" initial="initial" animate="animate" exit="exit">
      <motion.div className="arch-copy" variants={fadeUp}>
        <div className="eyebrow">03 / BOOK ARCHITECTURE</div>
        <h2>Give the<br /><em>idea</em><br />a spine.</h2>
        <p>A living outline that keeps the argument honest.</p>
      </motion.div>
      <div className="outline-window">
        <div className="outline-window-bar"><Layers3 size={13} /><span>MANUSCRIPT / OUTLINE</span><span className="window-count">04 CHAPTERS</span></div>
        {chapters.map((chapter, index) => (
          <motion.div className={`outline-row ${index === 1 ? "is-focus" : ""}`} key={chapter} variants={fadeUp} transition={{ delay: 0.18 + index * 0.12 }}>
            <span className="chapter-number">0{index + 1}</span>
            <span>{chapter}</span>
            <span className="chapter-line" />
            <ChevronRight size={13} />
          </motion.div>
        ))}
        <motion.div className="outline-beam" animate={{ x: ["0%", "340%"] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }} />
      </div>
      <motion.div className="arch-badge" variants={fadeUp} transition={{ delay: 0.88 }}>
        <Network size={15} />
        <span>Thesis coherence</span>
        <strong>92</strong>
      </motion.div>
      <CornerStamp>ARCHITECTURE / v1.8</CornerStamp>
    </motion.div>
  );
}

function CursorLine() {
  return <motion.span className="cursor-line" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} />;
}

function SceneWrite() {
  return (
    <motion.div className="scene scene-write" initial="initial" animate="animate" exit="exit">
      <div className="write-top">
        <motion.div variants={fadeUp}>
          <div className="eyebrow">04 / AI-ASSISTED WRITING</div>
          <h2>Keep your<br /><em>voice.</em></h2>
        </motion.div>
        <motion.div className="write-spark" animate={{ rotate: [0, -10, 0], scale: [1, 1.12, 1] }} transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}><Sparkles size={19} /></motion.div>
      </div>
      <motion.div className="editor-window" variants={fadeUp} transition={{ delay: 0.25 }}>
        <div className="editor-bar"><span>CHAPTER 02 / THE HIDDEN SYSTEM</span><span className="editor-live"><i /> WRITING</span></div>
        <div className="editor-body">
          <div className="editor-number">14</div>
          <p>The pattern is easy to miss when you are<br />standing too close to it<span className="highlight">.</span><CursorLine /></p>
          <div className="editor-suggestion">
            <Wand2 size={13} />
            <span>Continue in your established cadence</span>
            <span className="suggestion-key">TAB</span>
          </div>
        </div>
      </motion.div>
      <motion.div className="voice-tags" variants={fadeUp} transition={{ delay: 0.65 }}>
        <span>VOICE PROFILE</span><b>observant</b><b>grounded</b><b>precise</b>
      </motion.div>
      <CornerStamp>AUTHOR IN THE LOOP</CornerStamp>
    </motion.div>
  );
}

function SceneNormalize() {
  const providers = [
    { name: "OpenAI", mark: "O", state: "mapped" },
    { name: "Anthropic", mark: "A", state: "mapped" },
    { name: "Local model", mark: "L", state: "mapped" },
  ];
  return (
    <motion.div className="scene scene-normalize" initial="initial" animate="animate" exit="exit">
      <motion.div className="normalize-title" variants={fadeUp}>
        <div className="eyebrow">05 / PROVIDER-NEUTRAL BY DESIGN</div>
        <h2>One clear<br /><em>manuscript.</em></h2>
        <p>Different engines. Same editorial standard.</p>
      </motion.div>
      <div className="normalize-map">
        <div className="provider-stack">
          {providers.map((provider, index) => (
            <motion.div className="provider-row" key={provider.name} variants={fadeUp} transition={{ delay: 0.22 + index * 0.16 }}>
              <span className="provider-mark">{provider.mark}</span><span>{provider.name}</span><span className="mapped-tag"><Check size={10} /> {provider.state}</span>
            </motion.div>
          ))}
        </div>
        <motion.div className="map-lines" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.4, repeat: Infinity }}>
          <i /><i /><i />
        </motion.div>
        <motion.div className="normalized-doc" variants={fadeUp} transition={{ delay: 0.72 }}>
          <div className="doc-seal"><CircleDot size={15} /></div>
          <span>NONFICTION<br />MANUSCRIPT</span>
          <small>normalized</small>
        </motion.div>
      </div>
      <motion.div className="normalize-note" variants={fadeUp} transition={{ delay: 1 }}>
        <AlignLeft size={14} /> context preserved / provider detail abstracted
      </motion.div>
      <CornerStamp>CONTENT LAYER / STABLE</CornerStamp>
    </motion.div>
  );
}

function ScenePublish() {
  return (
    <motion.div className="scene scene-publish" initial="initial" animate="animate" exit="exit">
      <motion.div className="publish-glow" animate={{ scale: [1, 1.07, 1], opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="publish-title" variants={fadeUp}>
        <div className="eyebrow">06 / READY FOR THE WORLD</div>
        <h2>From first<br />thought to<br /><em>finished book.</em></h2>
      </motion.div>
      <motion.div className="book-stage" variants={fadeUp} transition={{ delay: 0.35 }}>
        <div className="book-shadow" />
        <motion.img src={asset("video-book-cover.jpg")} alt="" animate={{ y: [0, -8, 0], rotate: [-3, -2, -3] }} transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }} />
        <div className="book-side">THE LONG WAY HOME</div>
      </motion.div>
      <motion.div className="publish-checklist" variants={fadeUp} transition={{ delay: 0.75 }}>
        <span><Check size={12} /> structure locked</span>
        <span><Check size={12} /> voice consistent</span>
        <span><Check size={12} /> export ready</span>
      </motion.div>
      <motion.div className="final-lockup" variants={fadeUp} transition={{ delay: 1.08 }}>
        <BrandMark />
        <span className="final-rule" />
        <span className="final-line">Make the work legible.</span>
      </motion.div>
      <CornerStamp>NONFICTION AI STUDIO / COMPLETE</CornerStamp>
    </motion.div>
  );
}

function SceneContent({ scene }: { scene: number }) {
  switch (SCENES[scene].id) {
    case "research": return <SceneResearch />;
    case "architecture": return <SceneArchitecture />;
    case "write": return <SceneWrite />;
    case "normalize": return <SceneNormalize />;
    case "publish": return <ScenePublish />;
    default: return <SceneIdea />;
  }
}

export default function VideoDemo() {
  const [scene, setScene] = useState(0);
  const [cycle, setCycle] = useState(0);
  const sceneStart = useMemo(() => SCENE_DURATIONS.slice(0, scene).reduce((sum, duration) => sum + duration, 0), [scene]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (scene === SCENES.length - 1) {
        setScene(0);
        setCycle((value) => value + 1);
      } else {
        setScene((value) => value + 1);
      }
    }, SCENE_DURATIONS[scene]);
    return () => window.clearTimeout(timer);
  }, [scene, cycle]);

  return (
    <main className="video-shell">
      <div className="video-frame" key={cycle} style={{ ["--total-progress" as string]: `${(sceneStart / TOTAL_DURATION) * 100}%` }}>
        <div className="video-background">
          <div className="background-aurora aurora-a" />
          <div className="background-aurora aurora-b" />
          <PaperGrid />
          <div className="film-grain" />
        </div>
        <header className="video-header">
          <BrandMark />
          <span className="header-counter">A SHORT HISTORY OF AN IDEA <b>06</b></span>
        </header>
        <ProgressRail scene={scene} />
        <div className="scene-window">
          <AnimatePresence mode="sync">
            <SceneContent key={`${SCENES[scene].id}-${cycle}`} scene={scene} />
          </AnimatePresence>
        </div>
        <div className="video-progress"><motion.i key={`${scene}-${cycle}`} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: SCENE_DURATIONS[scene] / 1000, ease: "linear" }} /></div>
        <footer className="video-footer">
          <span>IDEA → MANUSCRIPT</span>
          <span className="footer-page">0{scene + 1} / 06</span>
        </footer>
      </div>
    </main>
  );
}