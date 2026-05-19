import { Router } from "express";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const router = Router();

function wrapLines(text: string, maxChars = 92): string[] {
  const raw = String(text || "");
  return raw.split(/\n/).flatMap((paragraph) => {
    const trimmed = paragraph.trim();
    if (!trimmed) return [""];
    const chunks = trimmed.match(new RegExp(`.{1,${maxChars}}(\\s|$)|.{1,${maxChars}}`, "g")) || [trimmed];
    return chunks.map((c) => c.trim()).filter(Boolean);
  });
}

function resolveBookTitle(project: any): string {
  const d = project?.bookDetails?.title?.trim();
  if (d) return d;
  const bt = project?.bookTitle;
  const custom = (bt?.customTitle || "").trim();
  const ai = (bt?.pickedFromAi || "").trim();
  return custom || ai || (project?.title || project?.research?.bookTitle || project?.idea || "Untitled Book").trim();
}

function resolveAuthorName(project: any): string {
  return (
    project?.authorBio?.authorName?.trim() ||
    project?.research?.authorName?.trim() ||
    "Author"
  );
}

function enumerateBlocks(bookOutline: any): any[] {
  const o = bookOutline && typeof bookOutline === "object" ? bookOutline : {};
  const blocks: any[] = [];
  const intro = o.introduction;
  if (intro?.id) blocks.push({ id: intro.id, label: intro.title || "Introduction", breadcrumb: "Front matter" });
  const chapters = Array.isArray(o.chapters) ? o.chapters : [];
  chapters.forEach((ch: any, ci: number) => {
    const sections = Array.isArray(ch.sections) ? ch.sections : [];
    sections.forEach((sec: any, si: number) => {
      const subs = Array.isArray(sec.subsections) ? sec.subsections : [];
      if (subs.length === 0) {
        blocks.push({ id: sec.id || `sec-${ci}-${si}`, label: sec.title || "Section", breadcrumb: `${ch.title || `Chapter ${ci + 1}`} › ${sec.title || "Section"}` });
        return;
      }
      subs.forEach((sub: any, qi: number) => {
        blocks.push({ id: sub.id || `sub-${ci}-${si}-${qi}`, label: sub.title || "Subsection", breadcrumb: `${ch.title || `Chapter ${ci + 1}`} › ${sec.title || "Section"} › ${sub.title || "Subsection"}` });
      });
    });
  });
  const concl = o.conclusion;
  if (concl?.id) blocks.push({ id: concl.id, label: concl.title || "Conclusion", breadcrumb: "Back matter" });
  return blocks;
}

async function buildBookPdf(project: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const title = resolveBookTitle(project);
  const author = resolveAuthorName(project);

  function addTextPage(heading: string, bodyLines: string[]) {
    const page = pdf.addPage([595, 842]);
    page.drawText(heading.slice(0, 120), { x: 50, y: 790, size: 18, font: bold, color: rgb(0.05, 0.1, 0.2) });
    let y = 758;
    bodyLines.forEach((line) => {
      const chunks = wrapLines(line, 95);
      chunks.forEach((chunk) => {
        if (y < 60) return;
        page.drawText(chunk, { x: 50, y, size: 11, font, color: rgb(0.12, 0.12, 0.14) });
        y -= 15;
      });
      y -= 6;
    });
  }

  addTextPage(title, [`By ${author}`, "", project.description ? "Description" : "", project.description || ""]);

  const lessons = project?.lessons && typeof project.lessons === "object" ? project.lessons : {};
  const blocks = enumerateBlocks(project?.bookOutline);
  blocks.forEach((block) => {
    const prose = String(lessons[block.id]?.prose || "").trim();
    if (!prose) return;
    addTextPage(block.label, [block.breadcrumb, "", prose]);
  });

  return pdf.save();
}

router.post("/book", async (req, res) => {
  try {
    const project = req.body?.project;
    if (!project || typeof project !== "object") return res.status(400).json({ error: "Missing project payload" });
    const bytes = await buildBookPdf(project);
    const title = (project.bookDetails?.title || project.title || "book").replace(/[^a-z0-9]/gi, "-");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${title || "book"}.pdf"`);
    return res.status(200).send(Buffer.from(bytes));
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to export PDF" });
  }
});

export default router;
