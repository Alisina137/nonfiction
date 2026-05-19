import { enumerateWriteBlocks } from "@/lib/writeBlocks";
import { resolveAuthorName, resolveBookTitle } from "@/lib/projectMeta";

export function countManuscriptWords(project) {
  const lessons = project?.lessons && typeof project.lessons === "object" ? project.lessons : {};
  const blocks = enumerateWriteBlocks(project?.bookOutline);
  let total = 0;
  blocks.forEach((b) => {
    const prose = String(lessons[b.id]?.prose || "").trim();
    if (!prose) return;
    total += prose.split(/\s+/).filter(Boolean).length;
  });
  return total;
}

export function buildManuscriptPlainText(project) {
  const title = resolveBookTitle(project);
  const author = resolveAuthorName(project);
  const lessons = project?.lessons && typeof project.lessons === "object" ? project.lessons : {};
  const blocks = enumerateWriteBlocks(project?.bookOutline);

  const lines = [title.toUpperCase(), `By ${author}`, ""];

  if (project?.description?.trim()) {
    lines.push("— MARKETING DESCRIPTION —", project.description.trim(), "");
  }

  blocks.forEach((block) => {
    const prose = String(lessons[block.id]?.prose || "").trim();
    if (!prose) return;
    lines.push(block.label.toUpperCase(), block.breadcrumb, "", prose, "", "---", "");
  });

  return lines.join("\n").trim();
}

export function buildManuscriptMarkdown(project) {
  const title = resolveBookTitle(project);
  const author = resolveAuthorName(project);
  const lessons = project?.lessons && typeof project.lessons === "object" ? project.lessons : {};
  const blocks = enumerateWriteBlocks(project?.bookOutline);

  const parts = [`# ${title}`, "", `*By ${author}*`, ""];

  if (project?.description?.trim()) {
    parts.push("> " + project.description.trim().replace(/\n/g, "\n> "), "", "---", "");
  }

  blocks.forEach((block) => {
    const prose = String(lessons[block.id]?.prose || "").trim();
    if (!prose) return;
    parts.push(`## ${block.label}`, "", `*${block.breadcrumb}*`, "", prose, "", "---", "");
  });

  return parts.join("\n").trim();
}

export function buildPublishingBundle(project) {
  const cover = project?.bookCover && typeof project.bookCover === "object" ? project.bookCover : {};
  const marketing = project?.bookMarketing && typeof project.bookMarketing === "object" ? project.bookMarketing : {};

  return {
    title: resolveBookTitle(project),
    author: resolveAuthorName(project),
    description: project?.description?.trim() || "",
    shortHook: marketing.shortHook?.trim() || "",
    keywords: marketing.keywords?.trim() || "",
    cover: {
      subtitle: cover.subtitle?.trim() || "",
      tagline: cover.tagline?.trim() || "",
      authorLine: cover.authorLine?.trim() || "",
      layoutStyle: cover.layoutStyle?.trim() || "",
      primaryColor: cover.primaryColor || "#0c4a6e",
      accentColor: cover.accentColor || "#38bdf8",
      designNotes: cover.designNotes?.trim() || ""
    },
    wordCount: countManuscriptWords(project),
    sectionCount: enumerateWriteBlocks(project?.bookOutline).length
  };
}
