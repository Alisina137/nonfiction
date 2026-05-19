import { AI } from "@/lib/ai";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { idea } = req.body;
    const data = await AI.getTitles(idea);
    return res.status(200).json({ titles: data.titles || [] });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to generate titles" });
  }
}
