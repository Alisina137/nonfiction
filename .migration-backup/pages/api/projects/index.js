import { createProject, listProjects, updateProject } from "@/lib/db";
import { getUserFromRequest } from "@/lib/supabaseServer";

export default async function handler(req, res) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "GET") {
      const projects = await listProjects(user.id);
      return res.status(200).json({ projects });
    }

    if (req.method === "POST") {
      const created = await createProject(user.id, req.body);
      return res.status(200).json({ project: created });
    }

    if (req.method === "PUT") {
      const { id, ...patch } = req.body;
      const updated = await updateProject(user.id, id, patch);
      return res.status(200).json({ project: updated });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error" });
  }
}
