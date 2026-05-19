import OpenAI from "openai";
import { nicheOutlinePrompt, nicheSystemPrompt } from "@/lib/prompts";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { research, architecture, title, description } = req.body || {};
    if (!architecture?.subNicheLabel) {
      return res.status(400).json({ error: "Missing niche architecture" });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: nicheSystemPrompt(architecture) },
        {
          role: "user",
          content: nicheOutlinePrompt({ research, architecture, title, description })
        }
      ]
    });

    const data = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to generate niche outline" });
  }
}
