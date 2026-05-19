import { effectiveBookTitle } from "@/lib/proposedBook";

export function resolveBookTitle(project) {
  const d = project?.bookDetails?.title?.trim();
  if (d) return d;
  const t = effectiveBookTitle(project?.bookTitle);
  if (t) return t;
  return (project?.title || project?.research?.bookTitle || project?.idea || "Untitled Book").trim();
}

export function resolveAuthorName(project) {
  return (
    project?.authorBio?.authorName?.trim() ||
    project?.research?.authorName?.trim() ||
    "Author"
  );
}

export function resolveIdea(project) {
  return (
    project?.research?.bookTopic?.trim() ||
    project?.idea?.trim() ||
    resolveBookTitle(project)
  );
}

export function resolveAudience(project) {
  const d = project?.bookDetails?.audience?.trim();
  if (d) return d;
  return project?.research?.targetAudience?.trim() || project?.audience?.trim() || "";
}

export function resolveTone(project) {
  const d = project?.bookDetails?.tone?.trim();
  if (d) return d;
  const tones = project?.research?.authorTones;
  if (Array.isArray(tones) && tones.length) return tones.join("; ");
  return project?.tone?.trim() || "Direct & practical";
}

export function resolveGenre(project) {
  return (
    project?.bookDetails?.genre?.trim() ||
    project?.research?.mainNicheLabel?.trim() ||
    project?.research?.genre?.trim() ||
    ""
  );
}

export function resolveSubNiche(project) {
  return project?.research?.subNicheLabel?.trim() || "";
}

export function resolveArchitectureFromProject(project) {
  if (project?.research?.architectureSnapshot) return project.research.architectureSnapshot;
  return null;
}

export function resolveUsp(project) {
  return (
    project?.bookDetails?.uniqueSellingProposition?.trim() ||
    project?.proposedBook?.content?.uniqueSellingProposition?.trim() ||
    ""
  );
}
