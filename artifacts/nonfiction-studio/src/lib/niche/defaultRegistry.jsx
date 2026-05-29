/** Default 6 × 10 niche catalog — user-editable at runtime via localStorage */

function sub(id, label, blueprintKey, extra = {}) {
  return { id, label, blueprintKey, ...extra };
}

export const DEFAULT_NICHE_REGISTRY = {
  version: 1,
  mainNiches: [
    {
      id: "self-help",
      label: "Self-Help",
      description: "Transformation, habits, mindset, and practical life upgrade systems.",
      tones: ["Direct & practical", "Empathetic", "Authoritative", "Minimalist", "Reflective"],
      audiences: [
        "Busy professionals",
        "Students",
        "Creators rebuilding habits",
        "Burned-out achievers",
        "First-time self-improvement readers"
      ],
      publishingGoals: ["Amazon KDP bestseller", "Authority building", "Course funnel", "Newsletter growth"],
      subNiches: [
        sub("productivity", "Productivity", "self-help-transformation"),
        sub("habit-building", "Habit Building", "self-help-transformation"),
        sub("mental-toughness", "Mental Toughness", "self-help-transformation"),
        sub("confidence", "Confidence", "self-help-transformation"),
        sub("stoicism", "Stoicism", "self-help-transformation"),
        sub("anxiety-overthinking", "Anxiety & Overthinking", "self-help-transformation"),
        sub("discipline", "Discipline", "self-help-transformation"),
        sub("motivation", "Motivation", "self-help-transformation"),
        sub("emotional-intelligence", "Emotional Intelligence", "self-help-transformation"),
        sub("life-transformation", "Life Transformation", "self-help-transformation")
      ]
    },
    {
      id: "business",
      label: "Business",
      description: "Income, systems, branding, and scalable operator playbooks.",
      tones: ["Practical", "Strategic", "Persuasive", "Direct & analytical", "Execution-focused"],
      audiences: [
        "Entrepreneurs",
        "Freelancers",
        "Creators",
        "Side-hustle builders",
        "Startup operators",
        "Students learning business skills"
      ],
      publishingGoals: ["Amazon KDP bestseller", "Lead generation", "High-ticket coaching", "Personal brand authority"],
      subNiches: [
        sub("affiliate-marketing", "Affiliate Marketing", "business-framework"),
        sub("ai-business", "AI Business", "business-framework"),
        sub("one-person-business", "One-Person Business", "business-framework"),
        sub("freelancing", "Freelancing", "business-framework"),
        sub("youtube-automation", "YouTube Automation", "business-framework"),
        sub("creator-economy", "Creator Economy", "business-framework"),
        sub("personal-branding", "Personal Branding", "business-framework"),
        sub("digital-products", "Digital Products", "business-framework"),
        sub("online-income", "Online Income", "business-framework"),
        sub("startup-growth", "Startup Growth", "business-framework")
      ]
    },
    {
      id: "romance",
      label: "Romance",
      description: "Emotion-forward fiction with relationship arcs and trope-aware pacing.",
      tones: ["Emotional", "Seductive", "Intense", "Passionate", "Witty", "Narrative"],
      audiences: [
        "Women 18–25",
        "BookTok romance readers",
        "Romance binge readers",
        "New adult readers",
        "Trope-specific fandoms"
      ],
      publishingGoals: ["Series launch", "KU page-reads", "BookTok virality", "Newsletter magnet"],
      subNiches: [
        sub("enemies-to-lovers", "Enemies-to-Lovers", "romance-escalation"),
        sub("dark-romance", "Dark Romance", "romance-dark"),
        sub("billionaire-romance", "Billionaire Romance", "romance-escalation"),
        sub("small-town-romance", "Small-Town Romance", "romance-escalation"),
        sub("romantasy", "Romantasy", "romantasy-hybrid"),
        sub("sports-romance", "Sports Romance", "romance-escalation"),
        sub("mafia-romance", "Mafia Romance", "romance-dark"),
        sub("college-romance", "College Romance", "romance-escalation"),
        sub("slow-burn-romance", "Slow Burn Romance", "romance-escalation", {
          overrides: { pacingType: "slow-burn" }
        }),
        sub("paranormal-romance", "Paranormal Romance", "romantasy-hybrid")
      ]
    },
    {
      id: "thriller",
      label: "Thriller",
      description: "Suspense, mystery, and high-stakes tension with escalation discipline.",
      tones: ["Dark", "Suspenseful", "Fast-paced", "Psychological", "Direct & analytical"],
      audiences: [
        "Suspense readers",
        "Mystery lovers",
        "Crime fiction readers",
        "True-crime crossover fans",
        "Audio thriller listeners"
      ],
      publishingGoals: ["Series hook", "KU thriller binge", "Film/TV pitch package", "Standalone breakout"],
      subNiches: [
        sub("psychological-thriller", "Psychological Thriller", "thriller-psychological"),
        sub("detective-thriller", "Detective Thriller", "thriller-procedural"),
        sub("domestic-suspense", "Domestic Suspense", "thriller-psychological"),
        sub("tech-ai-thriller", "Tech/AI Thriller", "scifi-speculative"),
        sub("legal-thriller", "Legal Thriller", "thriller-procedural"),
        sub("crime-thriller", "Crime Thriller", "thriller-procedural"),
        sub("serial-killer-thriller", "Serial Killer Thriller", "thriller-psychological"),
        sub("spy-thriller", "Spy Thriller", "thriller-procedural"),
        sub("medical-thriller", "Medical Thriller", "thriller-procedural"),
        sub("conspiracy-thriller", "Conspiracy Thriller", "thriller-psychological")
      ]
    },
    {
      id: "fantasy-scifi",
      label: "Fantasy / Sci-Fi",
      description: "Speculative worlds, power curves, and epic or conceptual stakes.",
      tones: ["Cinematic", "Epic", "Mythic", "Atmospheric", "Strategic"],
      audiences: [
        "Epic fantasy fans",
        "Progression / LitRPG readers",
        "Sci-fi concept readers",
        "YA crossover readers",
        "Series completionists"
      ],
      publishingGoals: ["Series bible launch", "KU fantasy binge", "Worldbuilding IP", "Cross-genre breakout"],
      subNiches: [
        sub("epic-fantasy", "Epic Fantasy", "fantasy-epic"),
        sub("dark-fantasy", "Dark Fantasy", "fantasy-epic"),
        sub("progression-fantasy", "Progression Fantasy", "fantasy-progression"),
        sub("litrpg", "LitRPG", "fantasy-progression"),
        sub("cyberpunk", "Cyberpunk", "scifi-speculative"),
        sub("ai-dystopia", "AI Dystopia", "scifi-speculative"),
        sub("post-apocalyptic", "Post-Apocalyptic", "scifi-speculative"),
        sub("space-opera", "Space Opera", "fantasy-epic"),
        sub("time-travel", "Time Travel", "scifi-speculative"),
        sub("mythology-retelling", "Mythology Retelling", "fantasy-epic")
      ]
    },
    {
      id: "story",
      label: "Story",
      description: "Narrative-first fiction and parable collections optimized for emotional immersion.",
      tones: ["Narrative", "Emotional", "Reflective", "Immersive", "Warm"],
      audiences: [
        "Children",
        "Teen readers",
        "Family readers",
        "Inspirational fiction readers",
        "Gift-book buyers"
      ],
      publishingGoals: ["Gift market", "School / library", "Anthology volume", "Audio bedtime market"],
      subNiches: [
        sub("inspirational-stories", "Inspirational Stories", "story-narrative"),
        sub("moral-stories", "Moral Stories", "story-narrative"),
        sub("adventure-stories", "Adventure Stories", "story-narrative"),
        sub("survival-stories", "Survival Stories", "story-narrative"),
        sub("emotional-drama", "Emotional Drama", "story-narrative"),
        sub("family-stories", "Family Stories", "story-narrative"),
        sub("historical-stories", "Historical Stories", "story-narrative"),
        sub("mystery-stories", "Mystery Stories", "thriller-procedural"),
        sub("war-stories", "War Stories", "story-narrative"),
        sub("slice-of-life", "Slice of Life", "story-narrative")
      ]
    }
  ]
};
