import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { enumerateWriteBlocks } from "@/lib/writeBlocks";
import { resolveAuthorName, resolveBookTitle } from "@/lib/projectMeta";

export async function buildBookPdf(project) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const title = resolveBookTitle(project);
  const author = resolveAuthorName(project);

  function wrapLines(text, maxChars = 92) {
    const raw = String(text || "");
    return raw.split(/\n/).flatMap((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return [""];
      const chunks = trimmed.match(new RegExp(`.{1,${maxChars}}(\\s|$)|.{1,${maxChars}}`, "g")) || [trimmed];
      return chunks.map((c) => c.trim()).filter(Boolean);
    });
  }

  function addTextPage(heading, bodyLines) {
    const page = pdf.addPage([595, 842]);
    page.drawText(heading.slice(0, 120), {
      x: 50,
      y: 790,
      size: 18,
      font: bold,
      color: rgb(0.05, 0.1, 0.2)
    });
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

  addTextPage(title, [
    `By ${author}`,
    "",
    project.description ? "Description" : "",
    project.description || "",
    "",
    `Approx. ${countWordsInProject(project)} words in manuscript body`
  ]);

  const lessons = project.lessons && typeof project.lessons === "object" ? project.lessons : {};
  const blocks = enumerateWriteBlocks(project.bookOutline);

  blocks.forEach((block) => {
    const prose = String(lessons[block.id]?.prose || "").trim();
    if (!prose) return;
    addTextPage(block.label, [block.breadcrumb, "", prose]);
  });

  return pdf.save();
}

function countWordsInProject(project) {
  const lessons = project?.lessons && typeof project.lessons === "object" ? project.lessons : {};
  let n = 0;
  enumerateWriteBlocks(project?.bookOutline).forEach((b) => {
    const prose = String(lessons[b.id]?.prose || "").trim();
    if (prose) n += prose.split(/\s+/).filter(Boolean).length;
  });
  return n;
}
