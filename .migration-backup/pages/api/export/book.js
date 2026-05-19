import { buildBookPdf } from "@/lib/pdf";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const project = req.body?.project;
    if (!project || typeof project !== "object") {
      return res.status(400).json({ error: "Missing project payload" });
    }
    const bytes = await buildBookPdf(project);
    const title = (project.bookDetails?.title || project.title || "book").replace(/[^a-z0-9]/gi, "-");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${title || "book"}.pdf"`);
    return res.status(200).send(Buffer.from(bytes));
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to export PDF" });
  }
}
