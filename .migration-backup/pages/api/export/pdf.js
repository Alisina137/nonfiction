import { getProject } from "@/lib/db";
import { buildBookPdf } from "@/lib/pdf";
import { getUserFromRequest } from "@/lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const id = req.query.id;
    const project = await getProject(user.id, id);
    const bytes = await buildBookPdf(project);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${(project.title || "book").replace(/[^a-z0-9]/gi, "-")}.pdf"`
    );
    return res.status(200).send(Buffer.from(bytes));
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to export PDF" });
  }
}
