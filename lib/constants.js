/** 13-step book builder flow (order matches sidebar) */
export const BOOK_BUILDER_STEPS = [
  { id: "research", label: "Research" },
  { id: "analysis", label: "Analysis" },
  { id: "bookTitle", label: "Book Title" },
  { id: "resources", label: "Resources" },
  { id: "authorPersona", label: "Author Persona" },
  { id: "proposedBook", label: "Proposed Book" },
  { id: "details", label: "Details" },
  { id: "authorBio", label: "Author Bio" },
  { id: "outline", label: "Outline" },
  { id: "write", label: "Write" },
  { id: "description", label: "Description" },
  { id: "bookCover", label: "Book Cover" },
  { id: "finish", label: "Finish" }
];

/** Author tone — multi-select checklist (Research step) */
export const AUTHOR_TONE_OPTIONS = [
  "Conversational",
  "Academic",
  "Neutral",
  "Reflective",
  "Authoritative",
  "Witty",
  "Narrative",
  "Persuasive",
  "Minimalist",
  "Direct & practical"
];

/** General audience — single select */
export const GENERAL_AUDIENCE_OPTIONS = ["Adult", "Young adult", "Child", "Teen", "Senior"];

/** Genre dropdown (nonfiction-focused; extend as needed) */
export const GENRE_OPTIONS = [
  "Business",
  "Self-help",
  "Productivity",
  "Personal finance",
  "Entrepreneurship",
  "Leadership",
  "Investing",
  "Marketing",
  "Career development",
  "Philosophy / ideas",
  "Health & wellness",
  "Cookbooks & food writing",
  "Spirituality",
  "Parenting & family",
  "Technology",
  "Memoir / narrative nonfiction",
  "Other"
];

/** Details step — target length bands */
export const BOOK_WORD_COUNT_RANGES = [
  "10k–15k",
  "15k–20k",
  "20k–25k",
  "25k–30k",
  "30k–35k",
  "35k–40k",
  "40k–50k",
  "50k–70k",
  "70k–90k",
  "90k–120k"
];

/** Details step — chapter pickers span */
export const BOOK_CHAPTER_OPTIONS = Object.freeze(Array.from({ length: 11 }, (_, i) => i + 5));

/** Narrative / instructional architecture */
export const BOOK_STRUCTURE_OPTIONS = [
  "Chronological",
  "Comparative",
  "How-to",
  "List-based",
  "Modular",
  "Problem-solution",
  "Workbook",
  "Question and answer",
  "Thematic",
  "Hybrid / mixed",
  "Other"
];

/** Author Bio step — how the byline is presented */
export const AUTHOR_TYPE_OPTIONS = [
  "Personal name",
  "Pen name",
  "Organization / brand",
  "Collaborative / duo",
  "Anonymous",
  "Other"
];

/** Preset chips for Book Focus (dropdown). Mix of categories; users can still add customs. */
export const BOOK_FOCUS_PRESET_TAGS = [
  "Actionable frameworks",
  "Beginner-friendly",
  "Busy professionals",
  "Case studies",
  "Clarity over clutter",
  "Clutter Mindset Shift",
  "Confidence building",
  "Conversational guide",
  "Debt-free narratives",
  "Decision-making",
  "Differentiation playbook",
  "Energy management",
  "Evidence-based tactics",
  "Habit-building",
  "Healthspan focus",
  "Implementation checklists",
  "Lasting organization",
  "Leadership myths",
  "Micro-habits",
  "Morning routines",
  "No-fluff playbook",
  "Operational systems",
  "Parenting burnout",
  "Peer-reviewed insights",
  "Philosophical lens",
  "Productivity resets",
  "Realistic strategies",
  "Resistance reduction",
  "Story-driven lessons",
  "Stress-free living",
  "Structured exercises",
  "Systems thinking",
  "Time-saving tactics",
  "Values alignment",
  "Wellness resets",
  "Work-life boundaries",
  "Writer's voice coaching"
];

/** @deprecated Legacy — kept for API compatibility if needed elsewhere */
export const AUDIENCES = [
  "Young professionals (16-25)",
  "Early career professionals (25-35)",
  "Entrepreneurs starting out",
  "Side hustle builders",
  "Freelancers",
  "Students learning money skills",
  "Corporate employees seeking freedom",
  "Creators & influencers",
  "Business beginners",
  "Productivity-focused individuals"
];

/** @deprecated Legacy tones */
export const TONES = [
  "Direct & analytical",
  "Practical & no-fluff",
  "Strategic & business-focused",
  "Calm & authoritative",
  "Execution-focused",
  "Systems thinker",
  "Productivity engineer",
  "Financial strategist",
  "No-nonsense advisor",
  "Modern business mentor",
  "High-performance mindset",
  "Tactical coach tone",
  "Structured educator tone",
  "Minimalist clarity tone",
  "Data-driven thinker",
  "Decision architect",
  "Behavior design coach",
  "Lean operator voice",
  "Framework-first advisor",
  "Outcome-oriented strategist"
];

/** @deprecated Legacy step ids */
export const STEPS = [
  "idea",
  "title",
  "description",
  "audience",
  "tone",
  "outline",
  "structure",
  "lesson"
];
