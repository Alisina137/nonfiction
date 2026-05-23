// Multi-provider AI router: Gemini → Groq → HuggingFace

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const HF_URL =
  "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2";

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
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gemini failed with status ${res.status}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

async function tryGroq(prompt: string, system?: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const messages: any[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.7, max_tokens: 8192 })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Groq failed with status ${res.status}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty response");
  return text;
}

async function tryHuggingFace(prompt: string, system?: string): Promise<string> {
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) throw new Error("HF_API_KEY not configured");

  const fullPrompt = system ? `<s>[INST] ${system}\n\n${prompt} [/INST]` : `<s>[INST] ${prompt} [/INST]`;

  const res = await fetch(HF_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ inputs: fullPrompt, parameters: { max_new_tokens: 4096, temperature: 0.7 } })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (Array.isArray(data) ? data[0]?.error : data?.error) || `HuggingFace failed with status ${res.status}`
    );
  }

  const text = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
  if (!text) throw new Error("HuggingFace returned empty response");

  // Strip the prompt echo that Mistral sometimes returns
  const marker = "[/INST]";
  const idx = text.lastIndexOf(marker);
  return idx !== -1 ? text.slice(idx + marker.length).trim() : text.trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Long-form generation: Gemini first → Groq fallback → HuggingFace last resort
 */
export async function generateContent(prompt: string, system?: string): Promise<string> {
  const errors: string[] = [];
  for (const fn of [tryGemini, tryGroq, tryHuggingFace]) {
    try {
      return await fn(prompt, system);
    } catch (e: any) {
      errors.push(e.message || String(e));
    }
  }
  throw new Error(`All AI providers failed:\n${errors.join("\n")}`);
}

/**
 * Fast/short generation: Groq first → Gemini fallback → HuggingFace last resort
 */
export async function generateContentFast(prompt: string, system?: string): Promise<string> {
  const errors: string[] = [];
  for (const fn of [tryGroq, tryGemini, tryHuggingFace]) {
    try {
      return await fn(prompt, system);
    } catch (e: any) {
      errors.push(e.message || String(e));
    }
  }
  throw new Error(`All AI providers failed:\n${errors.join("\n")}`);
}

/**
 * Extract the first JSON object or array from an AI response string.
 */
export function extractJSON(text: string): any {
  const t = String(text || "");

  // Try to find a JSON block (```json ... ``` or ``` ... ```)
  const fenceMatch = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* fall through */ }
  }

  // Try the first { ... } or [ ... ] block
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
