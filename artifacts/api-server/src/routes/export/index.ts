import { Router } from "express";
import { PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  Header,
  Footer,
  PageNumber,
  TableOfContents,
  SectionProperties,
  SectionType,
  NumberFormat,
  convertInchesToTwip,
  LevelFormat
} from "docx";

const router = Router();

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS: Record<string, any> = {
  thesis: {
    name: "Thesis Style",
    pageW: 612, pageH: 792,
    mTop: 72, mBot: 72, mLeft: 90, mRight: 72,
    titleSz: 26, chapterSz: 22, sectionSz: 16, subsectionSz: 13, bodySz: 11,
    lineH: 20, paraGap: 12, indent: 36,
    chapterPrefix: "Chapter",
    docxBody: "Times New Roman", docxHead: "Times New Roman",
    docxMLeft: 1440, docxMRight: 1152, docxMTop: 1152, docxMBot: 1152,
    useTimesRoman: true
  },
  academic: {
    name: "Academic Research",
    pageW: 595, pageH: 842,
    mTop: 85, mBot: 85, mLeft: 100, mRight: 85,
    titleSz: 24, chapterSz: 20, sectionSz: 15, subsectionSz: 12, bodySz: 11,
    lineH: 20, paraGap: 14, indent: 36,
    chapterPrefix: "Chapter",
    docxBody: "Times New Roman", docxHead: "Times New Roman",
    docxMLeft: 1600, docxMRight: 1360, docxMTop: 1360, docxMBot: 1360,
    useTimesRoman: true
  },
  nonfiction: {
    name: "Modern Nonfiction",
    pageW: 432, pageH: 648,
    mTop: 54, mBot: 54, mLeft: 60, mRight: 54,
    titleSz: 24, chapterSz: 20, sectionSz: 14, subsectionSz: 12, bodySz: 10.5,
    lineH: 17, paraGap: 10, indent: 0,
    chapterPrefix: "Chapter",
    docxBody: "Calibri", docxHead: "Calibri",
    docxMLeft: 960, docxMRight: 864, docxMTop: 864, docxMBot: 864,
    useTimesRoman: false
  },
  novel: {
    name: "Novel Style",
    pageW: 396, pageH: 612,
    mTop: 54, mBot: 54, mLeft: 54, mRight: 54,
    titleSz: 22, chapterSz: 18, sectionSz: 13, subsectionSz: 11, bodySz: 11,
    lineH: 18, paraGap: 0, indent: 36,
    chapterPrefix: "Chapter",
    docxBody: "Georgia", docxHead: "Georgia",
    docxMLeft: 864, docxMRight: 864, docxMTop: 864, docxMBot: 864,
    useTimesRoman: true
  },
  kdp: {
    name: "KDP Print Layout",
    pageW: 432, pageH: 648,
    mTop: 72, mBot: 72, mLeft: 72, mRight: 54,
    titleSz: 24, chapterSz: 20, sectionSz: 14, subsectionSz: 12, bodySz: 11,
    lineH: 18, paraGap: 8, indent: 18,
    chapterPrefix: "Chapter",
    docxBody: "Garamond", docxHead: "Garamond",
    docxMLeft: 1152, docxMRight: 864, docxMTop: 1152, docxMBot: 1152,
    useTimesRoman: true
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveBookTitle(p: any): string {
  const d = p?.bookDetails?.title?.trim();
  if (d) return d;
  const bt = p?.bookTitle;
  const custom = (bt?.customTitle || "").trim();
  const ai = (bt?.pickedFromAi || "").trim();
  return (custom || ai || (p?.title || p?.research?.bookTitle || p?.idea || "Untitled Book")).trim();
}

function resolveAuthorName(p: any): string {
  return (p?.authorBio?.authorName?.trim() || p?.research?.authorName?.trim() || "Author");
}

function sanitize(text: string): string {
  return String(text || "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "--")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x00-\x7E]/g, (c) => {
      try { return c; } catch { return "?"; }
    });
}

interface HChapter {
  chNum: number;
  title: string;
  sections: HSection[];
}

interface HSection {
  secNum: number;
  title: string;
  id: string;
  subsections: HSubsection[];
}

interface HSubsection {
  subNum: number;
  title: string;
  id: string;
}

function buildHierarchy(outline: any): {
  introduction: { id: string; title: string } | null;
  chapters: HChapter[];
  conclusion: { id: string; title: string } | null;
} {
  const o = outline && typeof outline === "object" ? outline : {};
  const intro = o.introduction?.id ? { id: o.introduction.id, title: o.introduction.title || "Introduction" } : null;
  const conclusion = o.conclusion?.id ? { id: o.conclusion.id, title: o.conclusion.title || "Conclusion" } : null;
  const chapters: HChapter[] = (Array.isArray(o.chapters) ? o.chapters : []).map((ch: any, ci: number): HChapter => ({
    chNum: ci + 1,
    title: ch.title || `Chapter ${ci + 1}`,
    sections: (Array.isArray(ch.sections) ? ch.sections : []).map((sec: any, si: number): HSection => ({
      secNum: si + 1,
      title: sec.title || `Section ${si + 1}`,
      id: sec.id || `sec-${ci}-${si}`,
      subsections: (Array.isArray(sec.subsections) ? sec.subsections : []).map((sub: any, qi: number): HSubsection => ({
        subNum: qi + 1,
        title: sub.title || `Subsection ${qi + 1}`,
        id: sub.id || `sub-${ci}-${si}-${qi}`
      }))
    }))
  }));
  return { introduction: intro, chapters, conclusion };
}

// ─── PDF BUILDER ─────────────────────────────────────────────────────────────

function wrapTextPdf(text: string, font: any, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const raw of String(text || "").split(/\n/)) {
    const para = raw.trim();
    if (!para) { lines.push(""); continue; }
    const words = para.split(/\s+/);
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      try {
        if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
          lines.push(current);
          current = word;
        } else {
          current = test;
        }
      } catch {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

async function buildBookPdf(project: any, options: any = {}): Promise<Uint8Array> {
  const preset = PRESETS[options.preset] || PRESETS.nonfiction;
  const P = preset;
  const pdf = await PDFDocument.create();

  const regularFont = await pdf.embedFont(P.useTimesRoman ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(P.useTimesRoman ? StandardFonts.TimesBold : StandardFonts.HelveticaBold);
  const italicFont = await pdf.embedFont(P.useTimesRoman ? StandardFonts.TimesRomanItalic : StandardFonts.HelveticaOblique);

  const bookTitle = sanitize(resolveBookTitle(project));
  const subtitle = sanitize(project?.bookCover?.subtitle || project?.bookDetails?.subtitle || "");
  const author = sanitize(resolveAuthorName(project));
  const description = sanitize(project?.description || "");
  const dedication = sanitize(options.dedication || "");
  const acknowledgments = sanitize(options.acknowledgments || "");
  const preface = sanitize(options.preface || "");

  const W = P.pageW, H = P.pageH;
  const ML = P.mLeft, MR = P.mRight, MT = P.mTop, MB = P.mBot;
  const textW = W - ML - MR;
  const BODY = P.bodySz;
  const LH = P.lineH;
  const PG = P.paraGap;

  const darkColor = rgb(0.05, 0.08, 0.15);
  const midColor = rgb(0.25, 0.28, 0.35);
  const accentColor = rgb(0.15, 0.3, 0.6);
  const lightGray = rgb(0.6, 0.6, 0.6);

  // Track pages for TOC
  const tocEntries: { label: string; pageNum: number }[] = [];
  let arabicPageNum = 0;

  function newPage(): PDFPage {
    return pdf.addPage([W, H]);
  }

  function drawRunningHeader(page: PDFPage, chapterLabel: string, pageN: number, isRoman = false) {
    const num = isRoman ? toRoman(pageN) : String(pageN);
    const headerY = H - MT + 20;
    const footerY = MB - 20;

    // Header line
    page.drawLine({ start: { x: ML, y: headerY - 2 }, end: { x: W - MR, y: headerY - 2 }, thickness: 0.5, color: lightGray });
    page.drawText(bookTitle.slice(0, 50), { x: ML, y: headerY + 4, size: 7.5, font: italicFont, color: lightGray });
    if (chapterLabel) {
      const cw = Math.min(italicFont.widthOfTextAtSize(chapterLabel, 7.5), textW * 0.5);
      page.drawText(chapterLabel.slice(0, 45), { x: W - MR - cw, y: headerY + 4, size: 7.5, font: italicFont, color: lightGray });
    }

    // Footer
    page.drawLine({ start: { x: ML, y: footerY + 2 }, end: { x: W - MR, y: footerY + 2 }, thickness: 0.5, color: lightGray });
    const pw = regularFont.widthOfTextAtSize(num, 8);
    page.drawText(num, { x: ML + textW / 2 - pw / 2, y: footerY - 10, size: 8, font: regularFont, color: lightGray });
  }

  function toRoman(n: number): string {
    const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
    const syms = ["m","cm","d","cd","c","xc","l","xl","x","ix","v","iv","i"];
    let r = "";
    for (let i = 0; i < vals.length; i++) { while (n >= vals[i]) { r += syms[i]; n -= vals[i]; } }
    return r;
  }

  // ── COVER PAGE ──
  {
    const page = newPage();
    let y = H * 0.42;

    // Decorative top bar
    page.drawRectangle({ x: ML, y: H - 40, width: textW, height: 4, color: accentColor });

    // Title
    const titleLines = wrapTextPdf(bookTitle, boldFont, P.titleSz, textW);
    const titleBlock = titleLines.length * (P.titleSz + 8);
    y = H * 0.5 + titleBlock / 2;
    for (const line of titleLines) {
      const tw = boldFont.widthOfTextAtSize(line, P.titleSz);
      page.drawText(line, { x: ML + (textW - tw) / 2, y, size: P.titleSz, font: boldFont, color: darkColor });
      y -= P.titleSz + 8;
    }

    // Rule
    y -= 16;
    page.drawRectangle({ x: ML + textW * 0.2, y, width: textW * 0.6, height: 1.5, color: accentColor });
    y -= 20;

    // Subtitle
    if (subtitle) {
      const stw = italicFont.widthOfTextAtSize(subtitle.slice(0, 80), P.sectionSz);
      page.drawText(subtitle.slice(0, 80), { x: ML + (textW - Math.min(stw, textW)) / 2, y, size: P.sectionSz, font: italicFont, color: midColor });
      y -= P.sectionSz + 16;
    }

    // Author
    const byLine = `by ${author}`;
    const aw = regularFont.widthOfTextAtSize(byLine, 14);
    page.drawText(byLine, { x: ML + (textW - aw) / 2, y: H * 0.22, size: 14, font: regularFont, color: midColor });

    // Bottom bar
    page.drawRectangle({ x: ML, y: 32, width: textW, height: 4, color: accentColor });
  }

  let romanPage = 1;

  // ── ABSTRACT (description) ──
  if (description) {
    romanPage++;
    const page = newPage();
    drawRunningHeader(page, "Abstract", romanPage, true);
    let y = H - MT - 10;

    page.drawText("Abstract", { x: ML, y, size: P.chapterSz, font: boldFont, color: darkColor });
    y -= P.chapterSz + 16;
    page.drawRectangle({ x: ML, y, width: 40, height: 2, color: accentColor });
    y -= 20;

    const lines = wrapTextPdf(description, regularFont, BODY, textW);
    for (const line of lines) {
      if (!line) { y -= PG; continue; }
      if (y < MB + 20) { y = H - MT - 10; }
      page.drawText(line, { x: ML + P.indent, y, size: BODY, font: regularFont, color: darkColor });
      y -= LH;
    }
  }

  // ── DEDICATION ──
  if (dedication) {
    romanPage++;
    const page = newPage();
    drawRunningHeader(page, "Dedication", romanPage, true);
    const dlines = wrapTextPdf(dedication, italicFont, 13, textW * 0.7);
    let y = H * 0.5 + (dlines.length * 20) / 2;
    for (const dl of dlines) {
      const dw = italicFont.widthOfTextAtSize(dl, 13);
      page.drawText(dl, { x: ML + (textW - dw) / 2, y, size: 13, font: italicFont, color: midColor });
      y -= 22;
    }
  }

  // ── ACKNOWLEDGMENTS ──
  if (acknowledgments) {
    romanPage++;
    const page = newPage();
    drawRunningHeader(page, "Acknowledgments", romanPage, true);
    let y = H - MT - 10;
    page.drawText("Acknowledgments", { x: ML, y, size: P.chapterSz, font: boldFont, color: darkColor });
    y -= P.chapterSz + 24;
    const lines = wrapTextPdf(acknowledgments, regularFont, BODY, textW);
    for (const line of lines) {
      if (!line) { y -= PG; continue; }
      if (y < MB + 20) { y = H - MT - 10; }
      page.drawText(line, { x: ML + P.indent, y, size: BODY, font: regularFont, color: darkColor });
      y -= LH;
    }
  }

  // ── TABLE OF CONTENTS (placeholder — filled in pass 2) ──
  romanPage++;
  const tocPage = newPage();
  drawRunningHeader(tocPage, "Contents", romanPage, true);
  const tocPageIndex = pdf.getPageCount() - 1;
  tocPage.drawText("Contents", { x: ML, y: H - MT - 10, size: P.chapterSz, font: boldFont, color: darkColor });
  tocPage.drawRectangle({ x: ML, y: H - MT - 10 - P.chapterSz - 12, width: 40, height: 2, color: accentColor });

  // ── PREFACE ──
  if (preface) {
    romanPage++;
    const page = newPage();
    drawRunningHeader(page, "Preface", romanPage, true);
    let y = H - MT - 10;
    page.drawText("Preface", { x: ML, y, size: P.chapterSz, font: boldFont, color: darkColor });
    y -= P.chapterSz + 24;
    const lines = wrapTextPdf(preface, regularFont, BODY, textW);
    for (const line of lines) {
      if (!line) { y -= PG; continue; }
      if (y < MB + 20) { y = H - MT - 10; }
      page.drawText(line, { x: ML + P.indent, y, size: BODY, font: regularFont, color: darkColor });
      y -= LH;
    }
  }

  // ── MAIN CONTENT ──
  const lessons = project?.lessons && typeof project.lessons === "object" ? project.lessons : {};
  const hier = buildHierarchy(project?.bookOutline);

  function drawChapterPage(chLabel: string, chTitle: string, chNum: number): PDFPage {
    arabicPageNum++;
    const page = newPage();
    drawRunningHeader(page, chNum === 0 ? "" : `${P.chapterPrefix} ${chNum}`, arabicPageNum, false);

    let y = H - MT - 40;

    if (chNum > 0) {
      const prefixTxt = `${P.chapterPrefix} ${chNum}`;
      page.drawText(prefixTxt, { x: ML, y, size: 11, font: regularFont, color: accentColor });
      y -= 18;
    }

    const titleLines = wrapTextPdf(chTitle, boldFont, P.chapterSz, textW);
    for (const tl of titleLines) {
      page.drawText(sanitize(tl), { x: ML, y, size: P.chapterSz, font: boldFont, color: darkColor });
      y -= P.chapterSz + 6;
    }
    y -= 4;
    page.drawRectangle({ x: ML, y, width: 50, height: 2.5, color: accentColor });
    y -= 24;

    return page;
  }

  function drawBodyText(page: PDFPage, prose: string, startY: number, currentChNum: number): PDFPage {
    let y = startY;
    let currentPage = page;

    const paragraphs = prose.split(/\n{2,}/);
    for (const para of paragraphs) {
      const clean = sanitize(para.replace(/\n/g, " ").trim());
      if (!clean) { y -= PG; continue; }
      const lines = wrapTextPdf(clean, regularFont, BODY, textW - P.indent);
      for (const line of lines) {
        if (y < MB + 20) {
          arabicPageNum++;
          currentPage = newPage();
          drawRunningHeader(currentPage, currentChNum > 0 ? `${P.chapterPrefix} ${currentChNum}` : "", arabicPageNum, false);
          y = H - MT;
        }
        currentPage.drawText(line, { x: ML + P.indent, y, size: BODY, font: regularFont, color: darkColor });
        y -= LH;
      }
      y -= PG;
    }
    return currentPage;
  }

  // Introduction
  if (hier.introduction) {
    const intro = hier.introduction;
    const prose = String(lessons[intro.id]?.prose || "").trim();
    if (prose) {
      tocEntries.push({ label: sanitize(intro.title), pageNum: arabicPageNum + 1 });
      const page = drawChapterPage("", sanitize(intro.title), 0);
      drawBodyText(page, prose, H - MT - 40 - P.chapterSz * 2 - 50, 0);
    }
  }

  // Chapters
  for (const ch of hier.chapters) {
    let chPageStarted = false;
    let currentChPage: PDFPage | null = null;
    let chBodyY = 0;

    for (const sec of ch.sections) {
      const secLabel = `${ch.chNum}.${sec.secNum}`;

      if (sec.subsections.length === 0) {
        // Leaf section
        const prose = String(lessons[sec.id]?.prose || "").trim();
        if (!prose) continue;

        if (!chPageStarted) {
          tocEntries.push({ label: `${sanitize(ch.title)}`, pageNum: arabicPageNum + 1 });
          chPageStarted = true;
          currentChPage = drawChapterPage(`${P.chapterPrefix} ${ch.chNum}`, sanitize(ch.title), ch.chNum);
          chBodyY = H - MT - 40 - P.chapterSz * 2 - 50;
        }

        // Section heading
        if (chBodyY < MB + 60) {
          arabicPageNum++;
          currentChPage = newPage();
          drawRunningHeader(currentChPage!, `${P.chapterPrefix} ${ch.chNum}`, arabicPageNum, false);
          chBodyY = H - MT;
        }
        tocEntries.push({ label: `  ${secLabel} ${sanitize(sec.title)}`, pageNum: arabicPageNum });
        currentChPage!.drawText(`${secLabel}  ${sanitize(sec.title)}`, { x: ML, y: chBodyY, size: P.sectionSz, font: boldFont, color: darkColor });
        chBodyY -= P.sectionSz + 14;
        currentChPage = drawBodyText(currentChPage!, prose, chBodyY, ch.chNum);
        chBodyY = MB; // force section heading on fresh check next iter

      } else {
        // Has subsections
        let secStarted = false;

        for (const sub of sec.subsections) {
          const subLabel = `${ch.chNum}.${sec.secNum}.${sub.subNum}`;
          const prose = String(lessons[sub.id]?.prose || "").trim();
          if (!prose) continue;

          if (!chPageStarted) {
            tocEntries.push({ label: sanitize(ch.title), pageNum: arabicPageNum + 1 });
            chPageStarted = true;
            currentChPage = drawChapterPage(`${P.chapterPrefix} ${ch.chNum}`, sanitize(ch.title), ch.chNum);
            chBodyY = H - MT - 40 - P.chapterSz * 2 - 50;
          }

          if (!secStarted) {
            secStarted = true;
            if (chBodyY < MB + 60) {
              arabicPageNum++;
              currentChPage = newPage();
              drawRunningHeader(currentChPage!, `${P.chapterPrefix} ${ch.chNum}`, arabicPageNum, false);
              chBodyY = H - MT;
            }
            tocEntries.push({ label: `  ${secLabel} ${sanitize(sec.title)}`, pageNum: arabicPageNum });
            currentChPage!.drawText(`${secLabel}  ${sanitize(sec.title)}`, { x: ML, y: chBodyY, size: P.sectionSz, font: boldFont, color: darkColor });
            chBodyY -= P.sectionSz + 14;
          }

          // Subsection heading
          if (chBodyY < MB + 60) {
            arabicPageNum++;
            currentChPage = newPage();
            drawRunningHeader(currentChPage!, `${P.chapterPrefix} ${ch.chNum}`, arabicPageNum, false);
            chBodyY = H - MT;
          }
          currentChPage!.drawText(`${subLabel}  ${sanitize(sub.title)}`, { x: ML, y: chBodyY, size: P.subsectionSz, font: boldFont, color: midColor });
          chBodyY -= P.subsectionSz + 10;
          currentChPage = drawBodyText(currentChPage!, prose, chBodyY, ch.chNum);
          chBodyY = MB;
        }
      }
    }
  }

  // Conclusion
  if (hier.conclusion) {
    const concl = hier.conclusion;
    const prose = String(lessons[concl.id]?.prose || "").trim();
    if (prose) {
      tocEntries.push({ label: sanitize(concl.title), pageNum: arabicPageNum + 1 });
      const page = drawChapterPage("", sanitize(concl.title), 0);
      drawBodyText(page, prose, H - MT - 40 - P.chapterSz * 2 - 50, 0);
    }
  }

  // ── PASS 2: Fill TOC ──
  {
    let ty = H - MT - 10 - P.chapterSz - 40;
    const lineStep = 18;
    for (const entry of tocEntries) {
      if (ty < MB + 20) break;
      const isTop = !entry.label.startsWith("  ");
      const font = isTop ? boldFont : regularFont;
      const sz = isTop ? 11 : 9.5;
      const x = ML + (entry.label.startsWith("    ") ? 28 : entry.label.startsWith("  ") ? 14 : 0);
      const label = entry.label.trim().slice(0, 60);
      const pg = String(entry.pageNum);

      tocPage.drawText(label, { x, y: ty, size: sz, font, color: isTop ? darkColor : midColor });
      const pgW = regularFont.widthOfTextAtSize(pg, sz);
      tocPage.drawText(pg, { x: W - MR - pgW, y: ty, size: sz, font: regularFont, color: midColor });

      // Dot leader
      const labelEnd = x + font.widthOfTextAtSize(label, sz) + 4;
      const pgStart = W - MR - pgW - 4;
      if (pgStart > labelEnd + 8) {
        const dots = Math.floor((pgStart - labelEnd) / 4);
        let dx = labelEnd;
        for (let d = 0; d < dots; d++) {
          tocPage.drawText(".", { x: dx, y: ty, size: sz, font: regularFont, color: rgb(0.7, 0.7, 0.7) });
          dx += 4;
        }
      }

      ty -= isTop ? lineStep + 3 : lineStep;
    }
  }

  return pdf.save();
}

// ─── DOCX BUILDER ─────────────────────────────────────────────────────────────

async function buildBookDocx(project: any, options: any = {}): Promise<Buffer> {
  const preset = PRESETS[options.preset] || PRESETS.nonfiction;
  const P = preset;
  const bookTitle = resolveBookTitle(project);
  const subtitle = project?.bookCover?.subtitle || project?.bookDetails?.subtitle || "";
  const author = resolveAuthorName(project);
  const description = project?.description || "";
  const dedication = options.dedication || "";
  const acknowledgments = options.acknowledgments || "";
  const preface = options.preface || "";
  const lessons = project?.lessons && typeof project.lessons === "object" ? project.lessons : {};
  const hier = buildHierarchy(project?.bookOutline);

  const spacing = { before: 120, after: 120, line: 276, lineRule: "auto" as any };
  const bodyFont = P.docxBody;
  const headFont = P.docxHead;

  function bodyPara(text: string, extra?: any): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text, font: bodyFont, size: P.bodySz * 2 })],
      alignment: AlignmentType.BOTH,
      indent: { firstLine: P.indent > 0 ? convertInchesToTwip(P.indent / 72) : 0 },
      spacing: { after: P.paraGap * 20, line: P.lineH * 15, lineRule: "auto" as any },
      ...extra
    });
  }

  function headingPara(text: string, level: HeadingLevel, extra?: any): Paragraph {
    return new Paragraph({
      text,
      heading: level,
      children: undefined,
      spacing: { before: 240, after: 120 },
      ...extra
    });
  }

  function sectionBreak(): Paragraph {
    return new Paragraph({ children: [new TextRun({ break: 1 } as any)], spacing: { before: 0, after: 0 } });
  }

  const frontMatterChildren: Paragraph[] = [];

  // Cover
  frontMatterChildren.push(
    new Paragraph({ children: [new TextRun({ text: bookTitle, font: headFont, size: P.titleSz * 2.2, bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 200 } }),
  );
  if (subtitle) {
    frontMatterChildren.push(new Paragraph({ children: [new TextRun({ text: subtitle, font: headFont, size: P.sectionSz * 2, italics: true })], alignment: AlignmentType.CENTER, spacing: { before: 120, after: 200 } }));
  }
  frontMatterChildren.push(
    new Paragraph({ children: [new TextRun({ text: `by ${author}`, font: bodyFont, size: 28 })], alignment: AlignmentType.CENTER, spacing: { before: 600, after: 3000 } }),
    new Paragraph({ children: [], pageBreakBefore: true })
  );

  // Abstract
  if (description) {
    frontMatterChildren.push(
      headingPara("Abstract", HeadingLevel.HEADING_1),
      ...description.split(/\n{2,}/).filter(Boolean).map((t: string) => bodyPara(t.replace(/\n/g, " "))),
      new Paragraph({ children: [], pageBreakBefore: true })
    );
  }

  // Dedication
  if (dedication) {
    frontMatterChildren.push(
      new Paragraph({ children: [new TextRun({ text: dedication, font: bodyFont, size: 26, italics: true })], alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 2400 } }),
      new Paragraph({ children: [], pageBreakBefore: true })
    );
  }

  // Acknowledgments
  if (acknowledgments) {
    frontMatterChildren.push(
      headingPara("Acknowledgments", HeadingLevel.HEADING_1),
      ...acknowledgments.split(/\n{2,}/).filter(Boolean).map((t: string) => bodyPara(t.replace(/\n/g, " "))),
      new Paragraph({ children: [], pageBreakBefore: true })
    );
  }

  // TOC
  frontMatterChildren.push(
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-3"
    } as any),
    new Paragraph({ children: [], pageBreakBefore: true })
  );

  // Preface
  if (preface) {
    frontMatterChildren.push(
      headingPara("Preface", HeadingLevel.HEADING_1),
      ...preface.split(/\n{2,}/).filter(Boolean).map((t: string) => bodyPara(t.replace(/\n/g, " "))),
      new Paragraph({ children: [], pageBreakBefore: true })
    );
  }

  // Main content
  const mainChildren: Paragraph[] = [];

  function addProse(prose: string) {
    const paras = prose.split(/\n{2,}/);
    for (const para of paras) {
      const clean = para.replace(/\n/g, " ").trim();
      if (clean) mainChildren.push(bodyPara(clean));
    }
  }

  // Introduction
  if (hier.introduction) {
    const prose = String(lessons[hier.introduction.id]?.prose || "").trim();
    if (prose) {
      mainChildren.push(headingPara(hier.introduction.title, HeadingLevel.HEADING_1, { pageBreakBefore: false }));
      addProse(prose);
    }
  }

  // Chapters
  let firstChapter = true;
  for (const ch of hier.chapters) {
    let hasContent = false;
    const chChildren: Paragraph[] = [];

    chChildren.push(headingPara(`${P.chapterPrefix} ${ch.chNum}`, HeadingLevel.HEADING_1, { pageBreakBefore: !firstChapter }));
    chChildren.push(headingPara(ch.title, HeadingLevel.HEADING_2));

    for (const sec of ch.sections) {
      const secLabel = `${ch.chNum}.${sec.secNum}  ${sec.title}`;
      if (sec.subsections.length === 0) {
        const prose = String(lessons[sec.id]?.prose || "").trim();
        if (!prose) continue;
        hasContent = true;
        chChildren.push(headingPara(secLabel, HeadingLevel.HEADING_3));
        const paras = prose.split(/\n{2,}/);
        for (const para of paras) {
          const clean = para.replace(/\n/g, " ").trim();
          if (clean) chChildren.push(bodyPara(clean));
        }
      } else {
        let secAdded = false;
        for (const sub of sec.subsections) {
          const subLabel = `${ch.chNum}.${sec.secNum}.${sub.subNum}  ${sub.title}`;
          const prose = String(lessons[sub.id]?.prose || "").trim();
          if (!prose) continue;
          hasContent = true;
          if (!secAdded) {
            chChildren.push(headingPara(secLabel, HeadingLevel.HEADING_3));
            secAdded = true;
          }
          chChildren.push(headingPara(subLabel, HeadingLevel.HEADING_4 as any));
          const paras = prose.split(/\n{2,}/);
          for (const para of paras) {
            const clean = para.replace(/\n/g, " ").trim();
            if (clean) chChildren.push(bodyPara(clean));
          }
        }
      }
    }

    if (hasContent) {
      mainChildren.push(...chChildren);
      firstChapter = false;
    }
  }

  // Conclusion
  if (hier.conclusion) {
    const prose = String(lessons[hier.conclusion.id]?.prose || "").trim();
    if (prose) {
      mainChildren.push(headingPara(hier.conclusion.title, HeadingLevel.HEADING_1, { pageBreakBefore: true }));
      addProse(prose);
    }
  }

  const runningHeader = new Header({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: bookTitle.slice(0, 60), font: bodyFont, size: 16, italics: true, color: "888888" })
        ],
        alignment: AlignmentType.RIGHT,
        border: { bottom: { color: "CCCCCC", space: 1, style: "single", size: 6 } }
      })
    ]
  });

  const runningFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ children: [PageNumber.CURRENT], font: bodyFont, size: 16, color: "888888" }),
          new TextRun({ text: "  of  ", font: bodyFont, size: 16, color: "888888" }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: bodyFont, size: 16, color: "888888" })
        ],
        border: { top: { color: "CCCCCC", space: 1, style: "single", size: 6 } }
      })
    ]
  });

  const doc = new Document({
    creator: author,
    title: bookTitle,
    description: description.slice(0, 500),
    styles: {
      default: {
        document: {
          run: { font: bodyFont, size: P.bodySz * 2, color: "1A1A2E" },
          paragraph: { spacing: { line: P.lineH * 15, lineRule: "auto" as any } }
        }
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          run: { font: headFont, size: P.chapterSz * 2, bold: true, color: "0D1B2A" },
          paragraph: { spacing: { before: 480, after: 240 } }
        },
        {
          id: "Heading2",
          name: "Heading 2",
          run: { font: headFont, size: P.sectionSz * 2, bold: true, color: "1A3A5C" },
          paragraph: { spacing: { before: 360, after: 180 } }
        },
        {
          id: "Heading3",
          name: "Heading 3",
          run: { font: headFont, size: P.subsectionSz * 2, bold: true, color: "2C5F8A" },
          paragraph: { spacing: { before: 240, after: 120 } }
        }
      ]
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: P.docxMTop, bottom: P.docxMBot, left: P.docxMLeft, right: P.docxMRight },
          }
        },
        children: frontMatterChildren
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            margin: { top: P.docxMTop, bottom: P.docxMBot, left: P.docxMLeft, right: P.docxMRight },
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL }
          }
        },
        headers: { default: runningHeader },
        footers: { default: runningFooter },
        children: mainChildren
      }
    ]
  });

  return Packer.toBuffer(doc);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post("/book", async (req, res) => {
  try {
    const { project, preset, dedication, acknowledgments, preface } = req.body;
    if (!project || typeof project !== "object")
      return res.status(400).json({ error: "Missing project payload" });
    const bytes = await buildBookPdf(project, { preset, dedication, acknowledgments, preface });
    const slug = (project.bookDetails?.title || project.title || "book").replace(/[^a-z0-9]/gi, "-");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${slug || "book"}.pdf"`);
    return res.status(200).send(Buffer.from(bytes));
  } catch (error: any) {
    console.error("PDF export error:", error);
    return res.status(500).json({ error: error.message || "Failed to export PDF" });
  }
});

router.post("/docx", async (req, res) => {
  try {
    const { project, preset, dedication, acknowledgments, preface } = req.body;
    if (!project || typeof project !== "object")
      return res.status(400).json({ error: "Missing project payload" });
    const buf = await buildBookDocx(project, { preset, dedication, acknowledgments, preface });
    const slug = (project.bookDetails?.title || project.title || "book").replace(/[^a-z0-9]/gi, "-");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${slug || "book"}.docx"`);
    return res.status(200).send(buf);
  } catch (error: any) {
    console.error("DOCX export error:", error);
    return res.status(500).json({ error: error.message || "Failed to export DOCX" });
  }
});

export default router;
