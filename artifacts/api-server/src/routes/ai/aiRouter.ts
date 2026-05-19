/**
 * Multi-provider AI router
 *
 * Priority for long-form content (chapters, outlines, lessons):
 *   Gemini → Groq → HuggingFace
 *
 * Priority for fast / short generation (titles, improvement):
 *   Groq → Gemini → HuggingFace
 */

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const HF_URL =
  "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2";

// ─── Individual providers ────────────────────────────────────────────────────

async function tryGemini(prompt: string, system?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const body: any = {
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  };
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.error?.message || `Gemini failed with status ${res.status}`
    );
  }

  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

async function tryGroq(prompt: string, system?: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.error?.message || `Groq failed with status ${res.status}`
    );
  }

  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty response");
  return text;
}

async function tryHuggingFace(prompt: string, system?: string): Promise<string> {
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) throw new Error("HF_API_KEY not configured");

  const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;

  const res = await fetch(HF_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: fullPrompt,
      parameters: { max_new_tokens: 2048, return_full_text: false }
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.error || `HuggingFace failed with status ${res.status}`
    );
  }

  const text: string | undefined = Array.isArray(data)
    ? data[0]?.generated_text
    : data?.generated_text;
  if (!text) throw new Error("HuggingFace returned empty response");
  return text.trim();
}

// ─── Routed entry points ─────────────────────────────────────────────────────

/**
 * Long-form generation (chapters, outlines, lessons).
 * Tries Gemini first, then Groq, then HuggingFace.
 */
export async function generateContent(
  prompt: string,
  system?: string
): Promise<string> {
  const errors: string[] = [];

  try {
    return await tryGemini(prompt, system);
  } catch (e: any) {
    errors.push(`Gemini: ${e.message}`);
  }

  try {
    return await tryGroq(prompt, system);
  } catch (e: any) {
    errors.push(`Groq: ${e.message}`);
  }

  try {
    return await tryHuggingFace(prompt, system);
  } catch (e: any) {
    errors.push(`HuggingFace: ${e.message}`);
  }

  throw new Error(`All AI providers failed:\n${errors.join("\n")}`);
}

/**
 * Fast / short generation (titles, improvement, brief copy).
 * Tries Groq first, then Gemini, then HuggingFace.
 */
export async function generateContentFast(
  prompt: string,
  system?: string
): Promise<string> {
  const errors: string[] = [];

  try {
    return await tryGroq(prompt, system);
  } catch (e: any) {
    errors.push(`Groq: ${e.message}`);
  }

  try {
    return await tryGemini(prompt, system);
  } catch (e: any) {
    errors.push(`Gemini: ${e.message}`);
  }

  try {
    return await tryHuggingFace(prompt, system);
  } catch (e: any) {
    errors.push(`HuggingFace: ${e.message}`);
  }

  throw new Error(`All AI providers failed:\n${errors.join("\n")}`);
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Extract a JSON value from an AI text response.
 * Handles markdown code fences and raw JSON objects/arrays.
 */
export function extractJSON(text: string): any {
  const t = text.trim();

  // Direct parse
  try {
    return JSON.parse(t);
  } catch {}

  // Markdown code fence: ```json ... ``` or ``` ... ```
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {}
  }

  // First {...} block
  const obj = t.match(/(\{[\s\S]*\})/);
  if (obj) {
    try {
      return JSON.parse(obj[1]);
    } catch {}
  }

  // First [...] block
  const arr = t.match(/(\[[\s\S]*\])/);
  if (arr) {
    try {
      return JSON.parse(arr[1]);
    } catch {}
  }

  throw new Error(
    `Could not parse JSON from AI response: ${t.slice(0, 300)}`
  );
}
