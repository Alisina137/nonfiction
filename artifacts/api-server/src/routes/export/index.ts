import { Router } from "express";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  PageBreak
} from "docx";

const router = Router();

// ─── Shared helpers ───────────────────────────────────────────────────────────

function resolveBookTitle(project: any): string {
  const d = project?.bookDetails?.title?.trim();
  if (d) return d;
  const bt = project?.bookTitle;
  const custom = (bt?.customTitle || "").trim();
  const ai = (bt?.pickedFromAi || "").trim();
  return (
    custom ||
    ai ||
    (project?.title || project?.research?.bookTitle || project?.idea || "Untitled Book").trim()
  );
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
  if (intro?.id)
    blocks.push({
      id: intro.id,
      label: intro.title || "Introduction",
      breadcrumb: "Front matter"
    });
  const chapters = Array.isArray(o.chapters) ? o.chapters : [];
  chapters.forEach((ch: any, ci: number) => {
    const sections = Array.isArray(ch.sections) ? ch.sections : [];
    sections.forEach((sec: any, si: number) => {
      const subs = Array.isArray(sec.subsections) ? sec.subsections : [];
      if (subs.length === 0) {
        blocks.push({
          id: sec.id || `sec-${ci}-${si}`,
          label: sec.title || "Section",
          breadcrumb: `${ch.title || `Chapter ${ci + 1}`} › ${sec.title || "Section"}`
        });
        return;
      }
      subs.forEach((sub: any, qi: number) => {
        blocks.push({
          id: sub.id || `sub-${ci}-${si}-${qi}`,
          label: sub.title || "Subsection",
          breadcrumb: `${ch.title || `Chapter ${ci + 1}`} › ${sec.title || "Section"} › ${
            sub.title || "Subsection"
          }`
        });
      });
    });
  });
  const concl = o.conclusion;
  if (concl?.id)
    blocks.push({
      id: concl.id,
      label: concl.title || "Conclusion",
      breadcrumb: "Back matter"
    });
  return blocks;
}

// ─── PDF export ───────────────────────────────────────────────────────────────

function wrapLines(text: string, maxChars = 92): string[] {
  return String(text || "")
    .split(/\n/)
    .flatMap((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return [""];
      const chunks =
        trimmed.match(new RegExp(`.{1,${maxChars}}(\\s|$)|.{1,${maxChars}}`, "g")) || [trimmed];
      return chunks.map((c) => c.trim()).filter(Boolean);
    });
}

async function buildBookPdf(project: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bookTitle = resolveBookTitle(project);
  const author = resolveAuthorName(project);

  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN = 50;
  const HEADING_SIZE = 18;
  const BODY_SIZE = 11;
  const LINE_H = 16;
  const PARA_GAP = 8;
  const BOTTOM_MARGIN = 60;

  function addSection(heading: string, lines: string[]) {
    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    // Draw heading
    page.drawText(heading.slice(0, 110), {
      x: MARGIN,
      y,
      size: HEADING_SIZE,
      font: bold,
      color: rgb(0.05, 0.1, 0.2)
    });
    y -= HEADING_SIZE + 12;

    for (const line of lines) {
      const chunks = wrapLines(line, 95);
      for (const chunk of chunks) {
        if (!chunk) {
          y -= PARA_GAP;
          continue;
        }
        // Overflow → new page
        if (y < BOTTOM_MARGIN) {
          page = pdf.addPage([PAGE_W, PAGE_H]);
          y = PAGE_H - MARGIN;
        }
        page.drawText(chunk, {
          x: MARGIN,
          y,
          size: BODY_SIZE,
          font,
          color: rgb(0.12, 0.12, 0.14)
        });
        y -= LINE_H;
      }
      y -= PARA_GAP;
    }
  }

  // Title page
  addSection(bookTitle, [
    `By ${author}`,
    "",
    ...(project.description ? ["— Description —", "", project.description] : [])
  ]);

  // Content pages
  const lessons =
    project?.lessons && typeof project.lessons === "object" ? project.lessons : {};
  const blocks = enumerateBlocks(project?.bookOutline);

  for (const block of blocks) {
    const prose = String(lessons[block.id]?.prose || "").trim();
    if (!prose) continue;
    addSection(block.label, [block.breadcrumb, "", prose]);
  }

  return pdf.save();
}

// ─── DOCX export ─────────────────────────────────────────────────────────────

async function buildBookDocx(project: any): Promise<Buffer> {
  const bookTitle = resolveBookTitle(project);
  const author = resolveAuthorName(project);
  const lessons =
    project?.lessons && typeof project.lessons === "object" ? project.lessons : {};
  const blocks = enumerateBlocks(project?.bookOutline);

  const children: Paragraph[] = [];

  // Title page
  children.push(
    new Paragraph({
      text: bookTitle,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `By ${author}`, size: 28, italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );

  if (project.description) {
    children.push(
      new Paragraph({
        text: "Description",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 }
      }),
      new Paragraph({
        text: project.description,
        spacing: { after: 400 }
      })
    );
  }

  // Track current chapter for heading grouping
  let currentChapter = "";

  for (const block of blocks) {
    const prose = String(lessons[block.id]?.prose || "").trim();
    if (!prose) continue;

    // Insert a chapter heading when the breadcrumb starts a new chapter
    const chapPart = block.breadcrumb.split(" › ")[0];
    if (chapPart && chapPart !== currentChapter && chapPart !== "Front matter" && chapPart !== "Back matter") {
      currentChapter = chapPart;
      children.push(
        new Paragraph({
          text: chapPart,
          heading: HeadingLevel.HEADING_1,
          pageBreakBefore: children.length > 3,
          spacing: { before: 400, after: 200 }
        })
      );
    }

    // Section subheading
    children.push(
      new Paragraph({
        text: block.label,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 }
      })
    );

    // Body paragraphs — split on double newlines
    const paras = prose.split(/\n{2,}/);
    for (const para of paras) {
      const clean = para.replace(/\n/g, " ").trim();
      if (clean) {
        children.push(
          new Paragraph({
            text: clean,
            spacing: { after: 120 }
          })
        );
      }
    }
  }

  const doc = new Document({
    creator: author,
    title: bookTitle,
    sections: [{ children }]
  });

  return Packer.toBuffer(doc);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post("/book", async (req, res) => {
  try {
    const project = req.body?.project;
    if (!project || typeof project !== "object")
      return res.status(400).json({ error: "Missing project payload" });
    const bytes = await buildBookPdf(project);
    const slug = (project.bookDetails?.title || project.title || "book").replace(/[^a-z0-9]/gi, "-");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${slug || "book"}.pdf"`);
    return res.status(200).send(Buffer.from(bytes));
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to export PDF" });
  }
});

router.post("/docx", async (req, res) => {
  try {
    const project = req.body?.project;
    if (!project || typeof project !== "object")
      return res.status(400).json({ error: "Missing project payload" });
    const buf = await buildBookDocx(project);
    const slug = (project.bookDetails?.title || project.title || "book").replace(/[^a-z0-9]/gi, "-");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${slug || "book"}.docx"`);
    return res.status(200).send(buf);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to export DOCX" });
  }
});

export default router;
