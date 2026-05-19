import OpenAI from "openai";
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
  titlesPrompt
} from "@/lib/prompts";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function chatJSON(userPrompt) {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt }
    ]
  });
  return JSON.parse(completion.choices?.[0]?.message?.content || "{}");
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
        { role: "user", content: nicheOutlinePrompt({ research, architecture, title, description }) }
      ]
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
        { role: "user", content: improvementPrompt({ action, currentText, tone }) }
      ]
    });
    return completion.choices?.[0]?.message?.content || "";
  }
};
