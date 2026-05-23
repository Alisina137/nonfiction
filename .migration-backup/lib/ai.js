import {
  contextualBookTitlesPrompt,
  coverBriefPrompt,
  descriptionPrompt,
  improvementPrompt,
  lessonPrompt,
  marketingDescriptionPrompt,
  nicheOutlinePrompt,
  nicheSystemPrompt,
  outlinePrompt,
  structurePrompt,
  systemPrompt,
  titlesPrompt,
} from "@/lib/prompts";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function chatJSON(userPrompt) {
  try {
    console.log("🔥 chatJSON called");

    const system =
      typeof systemPrompt === "function"
        ? systemPrompt()
        : systemPrompt ?? "";

    console.log("🔥 systemPrompt loaded");

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt }
      ]
    });

    console.log("🔥 OpenAI response received");

    const content = res.choices?.[0]?.message?.content;

    if (!content) {
      console.error("❌ EMPTY RESPONSE:", res);
      throw new Error("Empty AI response");
    }

    console.log("🔥 raw content:", content);

    return JSON.parse(content);

  } catch (err) {
    console.error("🔥 CHATJSON ERROR FULL:", err);
    throw err;
  }
}

export const AI = {
  getTitles: async (idea) => chatJSON(titlesPrompt(idea)),
  /** Titles conditioned on Research + Analysis competitor titles */
  getContextualTitles: async ({ research, competitorSummaries }) =>
    chatJSON(contextualBookTitlesPrompt({ research, competitorSummaries })),
  getDescription: async (payload) => {
    if (payload?.enriched) return chatJSON(marketingDescriptionPrompt(payload));
    return chatJSON(descriptionPrompt(payload));
  },
  getCoverBrief: async (payload) => chatJSON(coverBriefPrompt(payload)),
  getOutline: async (payload) => chatJSON(outlinePrompt(payload)),
  getNicheOutline: async ({ research, architecture, title, description }) => {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: nicheSystemPrompt(architecture) },
        {
          role: "user",
          content: nicheOutlinePrompt({
            research,
            architecture,
            title,
            description,
          }),
        },
      ],
    });
    return JSON.parse(completion.choices?.[0]?.message?.content || "{}");
  },
  getStructure: async (payload) => chatJSON(structurePrompt(payload)),
  getLesson: async (payload) => chatJSON(lessonPrompt(payload)),
  improveText: async ({ action, currentText, tone }) => {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt() },
        {
          role: "user",
          content: improvementPrompt({ action, currentText, tone }),
        },
      ],
    });
    return completion.choices?.[0]?.message?.content || "";
  },
};
