const XAI_BASE_URL = "https://api.x.ai/v1";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function createChatCompletion(messages: ChatMessage[], responseFormat?: { type: "json_object" }) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY not configured");

  const res = await fetch(`${XAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "grok-3-mini",
      messages,
      ...(responseFormat ? { response_format: responseFormat } : {})
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || data?.error || data?.message || `xAI request failed with status ${res.status}`;
    throw new Error(message);
  }

  return data;
}
