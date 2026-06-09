// ─── Startup environment validator ────────────────────────────────────────────
//
// Called once at process start (before app.listen).
// Prints a clear, structured report of missing / present secrets and exits
// with a non-zero code if any REQUIRED variable is absent.
//
// Rules:
//   REQUIRED   — app cannot start without these
//   AI_CHAIN   — at least one must be present, or AI generation is fully broken
//   AMAZON     — at least one must be present, or research is fully broken

interface EnvVar {
  key:         string;
  description: string;
  required:    boolean;
  group:       string;
}

const ENV_VARS: EnvVar[] = [
  { key: "DATABASE_URL",       description: "PostgreSQL connection string",           required: true,  group: "Database"  },
  { key: "GEMINI_API_KEY",     description: "Gemini 2.5 Flash (primary AI)",          required: false, group: "AI chain"  },
  { key: "GROQ_API_KEY",       description: "Groq Llama 3.3 70B (AI fallback #2)",   required: false, group: "AI chain"  },
  { key: "XAI_API_KEY",        description: "xAI / Grok (AI fallback #3)",            required: false, group: "AI chain"  },
  { key: "OPENROUTER_API_KEY", description: "OpenRouter (AI last-resort fallback)",   required: false, group: "AI chain"  },
  { key: "RAINFOREST_API_KEY", description: "Rainforest API (Amazon data, primary)",  required: false, group: "Amazon"    },
  { key: "SCALE_SERP_API_KEY", description: "Scale SERP (Amazon data, fallback)",     required: false, group: "Amazon"    },
];

export function validateEnv(): void {
  const missing: EnvVar[] = [];
  const present: EnvVar[] = [];

  for (const v of ENV_VARS) {
    if (process.env[v.key]) {
      present.push(v);
    } else {
      missing.push(v);
    }
  }

  const requiredMissing  = missing.filter((v) => v.required);
  const aiKeys           = ENV_VARS.filter((v) => v.group === "AI chain");
  const amazonKeys       = ENV_VARS.filter((v) => v.group === "Amazon");
  const aiPresent        = aiKeys.some((v)     => Boolean(process.env[v.key]));
  const amazonPresent    = amazonKeys.some((v)  => Boolean(process.env[v.key]));

  console.log("════════════════════════════════════════");
  console.log("  Environment validation");
  console.log("════════════════════════════════════════");

  for (const v of ENV_VARS) {
    const ok  = Boolean(process.env[v.key]);
    const tag = ok ? "✓" : (v.required ? "✗ MISSING" : "– not set");
    console.log(`  [${v.group.padEnd(10)}] ${tag.padEnd(14)} ${v.key}`);
  }

  console.log("────────────────────────────────────────");

  const warnings: string[] = [];

  if (!aiPresent) {
    warnings.push(
      "NO AI PROVIDER KEYS are set. All AI generation will fail.\n" +
      "  Set at least one of: GEMINI_API_KEY, GROQ_API_KEY, XAI_API_KEY, OPENROUTER_API_KEY"
    );
  }
  if (!amazonPresent) {
    warnings.push(
      "NO AMAZON PROVIDER KEYS are set. Book research (competitor lookup) will fail.\n" +
      "  Set at least one of: RAINFOREST_API_KEY, SCALE_SERP_API_KEY"
    );
  }

  for (const w of warnings) {
    console.warn(`  ⚠ WARNING: ${w}`);
  }

  if (requiredMissing.length > 0) {
    console.error("\n  ✗ FATAL: The following REQUIRED variables are missing:");
    for (const v of requiredMissing) {
      console.error(`      ${v.key} — ${v.description}`);
    }
    console.error("\n  Set these in your Replit Secrets (or .env for local dev) and restart.\n");
    console.log("════════════════════════════════════════");
    process.exit(1);
  }

  console.log("  Status: ready");
  console.log("════════════════════════════════════════");
}
