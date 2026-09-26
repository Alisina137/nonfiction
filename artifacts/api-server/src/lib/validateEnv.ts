// ─── Startup environment validator ────────────────────────────────────────────
//
// Called once at process start (before app.listen).
// Prints a clear, structured report of missing / present secrets and exits
// with a non-zero code if any REQUIRED variable is absent.
//
// Rules:
//   No external service is required just to start the private/local app.
//   AI_CHAIN   — at least one key is needed only when using AI generation.
//   AMAZON     — optional; Open Library is the public metadata fallback.
//   DATABASE   — optional for the current localStorage-based personal workflow.

interface EnvVar {
  key:         string;
  description: string;
  required:    boolean;
  group:       string;
}

const ENV_VARS: EnvVar[] = [
  { key: "DATABASE_URL",       description: "Optional PostgreSQL connection string",   required: false, group: "Database"  },
  { key: "GEMINI_API_KEY",     description: "Gemini 2.5 Flash/Pro/Lite — primary AI",        required: false, group: "AI chain"  },
  { key: "GROQ_API_KEY",       description: "Groq GPT-OSS 120B — fast inference fallback",  required: false, group: "AI chain"  },
  { key: "OPENROUTER_API_KEY", description: "OpenRouter — DeepSeek R1, Qwen, Maverick pool", required: false, group: "AI chain"  },
  { key: "SAMBANOVA_API_KEY",  description: "SambaNova Cloud — last-resort fallback",         required: false, group: "AI chain"  },
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
      "  Set at least one of: GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, SAMBANOVA_API_KEY"
    );
  }
  if (!amazonPresent) {
    warnings.push(
      "NO AMAZON PROVIDER KEYS are set. Live Amazon lookup is disabled; Open Library fallback remains available.\n" +
      "  Optional: set RAINFOREST_API_KEY or SCALE_SERP_API_KEY for live Amazon data."
    );
  }

  for (const w of warnings) {
    console.warn(`  ⚠ WARNING: ${w}`);
  }

  console.log("  Status: ready");
  console.log("════════════════════════════════════════");
}
