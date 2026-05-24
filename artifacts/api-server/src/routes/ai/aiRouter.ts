// Multi-provider AI router with permission-gated fallback chain.
//
//   Long-form (generateContent):   OpenAI → Claude (auto) → Grok (user-approved)
//   Short-form (generateContentFast): Gemini → OpenAI → Claude (auto) → Grok (user-approved)
//
// "Short-form" is reserved for titles, subtitles, hooks, outlines, sections,
// and subsections per product spec.

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";
const ANTHROPIC_VERSION = "2023-06-01";

const XAI_URL = "https://api.x.ai/v1/chat/completions";
const XAI_MODEL = process.env.XAI_MODEL || "grok-3-mini";

export type ProviderId = "openai" | "anthropic" | "xai" | "gemini";

export interface GenOptions {
  /** User explicitly approved using Grok as a final fallback. */
  allowGrok?: boolean;
  /** Notified each time the chain advances past a provider. */
  onFallback?: (info: { from: ProviderId; to: ProviderId; reason: string }) => void;
  /** Notified with the provider that actually produced the result. */
  onSuccess?: (provider: ProviderId) => void;
}

export class GrokApprovalRequiredError extends Error {
  needsApproval = "grok" as const;
  attempted: Array<{ provider: ProviderId; error: string }>;
  constructor(attempted: Array<{ provider: ProviderId; error: string }>) {
    super("Grok approval required: OpenAI and Claude both unavailable.");
    this.name = "GrokApprovalRequiredError";
    this.attempted = attempted;
  }
}

/** Heuristic: detect rate-limit / daily-quota / unavailability errors. */
export function isLimitOrUnavailable(msg: string): boolean {
  return /rate.?limit|quota|daily.?limit|exceeded|insufficient|429|503|overload|unavailable|temporarily/i.test(
    msg || ""
  );
}

// ─── Providers ────────────────────────────────────────────────────────────────

async function tryGemini(prompt: string, system?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const contents: any[] = [];
  if (system) {
    contents.push({ role: "user", parts: [{ text: `SYSTEM INSTRUCTIONS:\n${system}` }] });
    contents.push({ role: "model", parts: [{ text: "Understood. I will follow these instructions." }] });
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 8192 } })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Gemini failed with status ${res.status}`);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

async function tryOpenAI(prompt: string, system?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  const messages: any[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: OPENAI_MODEL, messages, temperature: 0.7, max_tokens: 4096 })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI failed with status ${res.status}`);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned empty response");
  return text;
}

async function tryClaude(prompt: string, system?: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      temperature: 0.7,
      system: system || undefined,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Claude failed with status ${res.status}`);
  const text = Array.isArray(data?.content)
    ? data.content.map((b: any) => b?.text || "").join("")
    : "";
  if (!text) throw new Error("Claude returned empty response");
  return text;
}

async function tryGrok(prompt: string, system?: string): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY not configured");
  const messages: any[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const body = {
    model: XAI_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 4096,
    stream: false
  };

  const res = await fetch(XAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  // Read body as text first so we can log the raw error response even when
  // it's not valid JSON (xAI sometimes returns plain text on 4xx/5xx).
  const rawText = await res.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { _raw: rawText };
  }

  if (!res.ok) {
    const detail =
      data?.error?.message ||
      data?.error ||
      data?._raw ||
      `status ${res.status}`;
    // Detailed diagnostic logging — surfaces in api-server logs so the exact
    // status, model, endpoint, and response body are visible.
    console.error("[xai] request failed", {
      endpoint: XAI_URL,
      model: XAI_MODEL,
      status: res.status,
      statusText: res.statusText,
      responseBody: typeof detail === "string" ? detail.slice(0, 1000) : detail
    });
    throw new Error(
      `Grok (${XAI_MODEL}) failed with status ${res.status}: ${
        typeof detail === "string" ? detail : JSON.stringify(detail)
      }`
    );
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    console.error("[xai] empty response", {
      endpoint: XAI_URL,
      model: XAI_MODEL,
      data
    });
    throw new Error(`Grok (${XAI_MODEL}) returned empty response`);
  }
  return text;
}

// ─── Chain runner ─────────────────────────────────────────────────────────────

const FN_BY_PROVIDER: Record<ProviderId, (p: string, s?: string) => Promise<string>> = {
  gemini: tryGemini,
  openai: tryOpenAI,
  anthropic: tryClaude,
  xai: tryGrok
};

async function runChain(
  prompt: string,
  system: string | undefined,
  chain: ProviderId[],
  opts: GenOptions
): Promise<{ text: string; usedProvider: ProviderId }> {
  const attempts: Array<{ provider: ProviderId; error: string }> = [];
  let lastFromProvider: ProviderId | null = null;

  for (const provider of chain) {
    // Gate Grok behind user approval — if not approved, surface the gate to the caller.
    if (provider === "xai" && !opts.allowGrok) {
      throw new GrokApprovalRequiredError(attempts);
    }
    try {
      const text = await FN_BY_PROVIDER[provider](prompt, system);
      opts.onSuccess?.(provider);
      return { text, usedProvider: provider };
    } catch (e: any) {
      const msg = e?.message || String(e);
      attempts.push({ provider, error: msg });
      if (lastFromProvider) {
        opts.onFallback?.({ from: lastFromProvider, to: provider, reason: msg });
      }
      lastFromProvider = provider;
      // Continue to next provider regardless of error type — we always try the chain.
    }
  }
  throw new Error(`All AI providers failed:\n${attempts.map((a) => `${a.provider}: ${a.error}`).join("\n")}`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Long-form generation: OpenAI → Claude → Grok (with approval).
 * Used for lessons, descriptions, improvements, cover briefs, etc.
 */
export async function generateContent(
  prompt: string,
  system?: string,
  opts: GenOptions = {}
): Promise<{ text: string; usedProvider: ProviderId }> {
  return runChain(prompt, system, ["openai", "anthropic", "xai"], opts);
}

/**
 * Short-form generation: Gemini → OpenAI → Claude → Grok (with approval).
 * Used for titles, subtitles, hooks, outlines, sections, subsections.
 */
export async function generateContentFast(
  prompt: string,
  system?: string,
  opts: GenOptions = {}
): Promise<{ text: string; usedProvider: ProviderId }> {
  return runChain(prompt, system, ["gemini", "openai", "anthropic", "xai"], opts);
}

/**
 * Extract the first JSON object or array from an AI response string.
 */
export function extractJSON(text: string): any {
  const t = String(text || "");
  const fenceMatch = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* fall through */ }
  }
  const objMatch = t.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch { /* fall through */ }
  }
  const arrMatch = t.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch { /* fall through */ }
  }
  throw new Error(`Could not parse JSON from AI response: ${t.slice(0, 200)}`);
}
