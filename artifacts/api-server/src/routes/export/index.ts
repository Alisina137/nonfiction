import { Router } from "express";
import { PDFDocument, PDFPage, StandardFonts, rgb, PDFName, PDFArray } from "pdf-lib";
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
  SectionType,
  NumberFormat,
  convertInchesToTwip,
  XmlComponent,
  XmlAttributeComponent
} from "docx";
import { generateContent, extractJSON } from "../ai/aiRouter.js";
import { chapterArchitecturePrompt } from "../ai/prompts.js";

const router = Router();

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS: Record<string, any> = {
  kdp_pro: {
    name: "KDP Professional Nonfiction",
    pageW: 432, pageH: 648,
    mTop: 63, mBot: 54, mLeft: 63, mRight: 54,
    titleSz: 28, chapterSz: 20, sectionSz: 16, subsectionSz: 14, bodySz: 12,
    lineH: 14, paraGap: 8, indent: 18,
    chapterPrefix: "Chapter",
    docxBody: "Times New Roman", docxHead: "Times New Roman",
    docxMLeft: 1260, docxMRight: 1080, docxMTop: 1260, docxMBot: 1080,
    docxLineSpacing: 276,
    useTimesRoman: true
  },
  thesis: {
    name: "Thesis Style",
    pageW: 612, pageH: 792,
    mTop: 72, mBot: 72, mLeft: 90, mRight: 72,
    titleSz: 26, chapterSz: 22, sectionSz: 16, subsectionSz: 13, bodySz: 11,
    lineH: 20, paraGap: 12, indent: 36,
    chapterPrefix: "Chapter",
    docxBody: "Times New Roman", docxHead: "Times New Roman",
    docxMLeft: 1440, docxMRight: 1152, docxMTop: 1152, docxMBot: 1152,
    docxLineSpacing: 300,
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
    docxLineSpacing: 300,
    useTimesRoman: true
  },
  kdp: {
    name: "KDP Print Layout",
    pageW: 432, pageH: 648,
    mTop: 72, mBot: 72, mLeft: 72, mRight: 54,
    titleSz: 24, chapterSz: 20, sectionSz: 14, subsectionSz: 12, bodySz: 11,
    lineH: 18, paraGap: 8, indent: 18,
    chapterPrefix: "Chapter",
    docxBody: "Times New Roman", docxHead: "Times New Roman",
    docxMLeft: 1152, docxMRight: 864, docxMTop: 1152, docxMBot: 1152,
    docxLineSpacing: 276,
    useTimesRoman: true
  }
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

function resolveBookTitle(p: any): string {
  const d = p?.bookDetails?.title?.trim();
  if (d) return d;
  const bt = p?.bookTitle;
  const custom = (bt?.customTitle || "").trim();
  const ai     = (bt?.pickedFromAi || "").trim();
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
    .replace(/[^\x00-\x7E]/g, (c) => { try { return c; } catch { return "?"; } });
}

function toRoman(n: number): string {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ["m","cm","d","cd","c","xc","l","xl","x","ix","v","iv","i"];
  let r = "";
  for (let i = 0; i < vals.length; i++) { while (n >= vals[i]) { r += syms[i]; n -= vals[i]; } }
  return r;
}

// ─── Intro generators ─────────────────────────────────────────────────────────
// Template-based — fast, no AI credits needed, never repetitive across chapters.

const CH_INTRO_OPENERS = [
  (t: string) => `This chapter examines ${t}.`,
  (t: string) => `In the pages that follow, we explore ${t}.`,
  (t: string) => `Throughout this chapter, we investigate ${t}.`,
  (t: string) => `The focus of this chapter is ${t}.`,
  (t: string) => `Here we turn our attention to ${t}.`,
];

const CH_INTRO_CONNECTORS = [
  (secs: string[]) => ` You will discover how ${secs[0]}, ${secs[1]}, and ${secs[2]} connect to form a complete and practical framework.`,
  (secs: string[]) => ` Drawing from ${secs[0]}, ${secs[1]}, and ${secs[2]}, this chapter builds a layered understanding of the subject.`,
  (secs: string[]) => ` We move through ${secs[0]}, ${secs[1]}, and ${secs[2]}, each concept strengthening the next.`,
  (secs: string[]) => ` The journey covers ${secs[0]}, ${secs[1]}, and ${secs[2]} — a progression designed to build both knowledge and confidence.`,
  (secs: string[]) => ` Together, ${secs[0]}, ${secs[1]}, and ${secs[2]} reveal the full picture of what this chapter has to offer.`,
];

function buildChapterIntro(chTitle: string, sectionTitles: string[]): string {
  const clean = (s: string) =>
    s.toLowerCase().replace(/^\d+\.\d+(\.\d+)?\s+/, "").trim();
  const secNames = sectionTitles.map(clean).filter(Boolean);
  const idx = (chTitle.charCodeAt(0) + chTitle.length) % CH_INTRO_OPENERS.length;
  let intro = CH_INTRO_OPENERS[idx](chTitle.toLowerCase());
  if (secNames.length >= 3) {
    const connIdx = (chTitle.length + chTitle.charCodeAt(1 % chTitle.length)) % CH_INTRO_CONNECTORS.length;
    intro += CH_INTRO_CONNECTORS[connIdx](secNames);
  } else if (secNames.length === 2) {
    intro += ` We examine ${secNames[0]} and ${secNames[1]}, building the foundation for everything that follows.`;
  } else if (secNames.length === 1) {
    intro += ` The core focus is ${secNames[0]}, explored through both theory and real-world application.`;
  } else {
    intro += ` Each concept is examined in depth, with a focus on practical understanding and real-world application.`;
  }
  return intro;
}

const SEC_INTRO_TEMPLATES: Array<(sec: string, ch: string) => string> = [
  (sec, ch) => `This section focuses on ${sec}, a key dimension of ${ch}. The content that follows draws on both foundational principles and actionable insights.`,
  (sec, ch) => `Understanding ${sec} is central to the ideas developed throughout this chapter. Here we examine the core concepts and what they mean in practice.`,
  (sec, ch) => `${sec.charAt(0).toUpperCase() + sec.slice(1)} shapes how we approach the broader themes of ${ch}. The following pages explore both the theory and the practical application.`,
  (sec, ch) => `Here we examine ${sec}, tracing how it connects to the larger framework of ${ch} and the chapters that surround it.`,
  (sec, ch) => `The ideas in this section — centered on ${sec} — build directly on what came before and lay the groundwork for what follows.`,
];

function buildSectionIntro(secTitle: string, chTitle: string): string {
  const cleanSec = secTitle.toLowerCase().replace(/^\d+\.\d+(\.\d+)?\s+/, "").trim();
  const cleanCh  = chTitle.toLowerCase().trim();
  const idx = (secTitle.charCodeAt(0) + secTitle.length) % SEC_INTRO_TEMPLATES.length;
  return SEC_INTRO_TEMPLATES[idx](cleanSec, cleanCh);
}

// ─── Prose block parser ───────────────────────────────────────────────────────

type ProseBlock =
  | { kind: "para";     text: string }
  | { kind: "bullet";   text: string }
  | { kind: "numbered"; text: string; num: number };

function parseProseBlocks(prose: string): ProseBlock[] {
  const blocks: ProseBlock[] = [];
  const rawParas = String(prose || "").split(/\n{2,}/);
  for (const rawPara of rawParas) {
    if (!rawPara.trim()) continue;
    for (const line of rawPara.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      const bulletM = t.match(/^[•\-\*]\s+(.+)/);
      const numM    = t.match(/^(\d+)[.)]\s+(.+)/);
      if (bulletM)      blocks.push({ kind: "bullet",   text: bulletM[1] });
      else if (numM)    blocks.push({ kind: "numbered", text: numM[2], num: parseInt(numM[1], 10) });
      else              blocks.push({ kind: "para",     text: t });
    }
  }
  return blocks;
}

// ─── Outline hierarchy ────────────────────────────────────────────────────────

interface HChapter    { chNum: number; title: string; sections: HSection[] }
interface HSection    { secNum: number; title: string; id: string; subsections: HSubsection[] }
interface HSubsection { subNum: number; title: string; id: string }

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
          lines.push(current); current = word;
        } else { current = test; }
      } catch { current = test; }
    }
    if (current) lines.push(current);
  }
  return lines;
}

// Add a GoTo link annotation on a PDF page
function addLinkAnnotation(
  onPage: PDFPage,
  rect: [number, number, number, number],
  targetPage: PDFPage,
  pdf: PDFDocument
) {
  try {
    const { context } = pdf;
    const annotRef = context.register(
      context.obj({
        Type:    PDFName.of("Annot"),
        Subtype: PDFName.of("Link"),
        Rect:    rect,
        Border:  [0, 0, 0],
        C:       [],
        Dest:    [targetPage.ref, PDFName.of("XYZ"), null, null, null]
      })
    );
    const existing = onPage.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (existing) {
      existing.push(annotRef);
    } else {
      onPage.node.set(PDFName.of("Annots"), context.obj([annotRef]));
    }
  } catch { /* silently ignore annotation failures */ }
}

// ─── TOC Entry ────────────────────────────────────────────────────────────────

interface TocEntry {
  label:       string;   // text shown in TOC
  displayNum:  string;   // "1", "i", "ii" etc.
  level:       number;   // 0=chapter, 1=section, 2=subsection
  pdfPageRef?: PDFPage;  // reference to actual PDF page (set when page is created)
}

async function buildBookPdf(project: any, options: any = {}): Promise<Uint8Array> {
  const P = PRESETS[options.preset] || PRESETS.kdp_pro;
  const pdf = await PDFDocument.create();

  const regular = await pdf.embedFont(P.useTimesRoman ? StandardFonts.TimesRoman      : StandardFonts.Helvetica);
  const bold    = await pdf.embedFont(P.useTimesRoman ? StandardFonts.TimesRomanBold   : StandardFonts.HelveticaBold);
  const italic  = await pdf.embedFont(P.useTimesRoman ? StandardFonts.TimesRomanItalic : StandardFonts.HelveticaOblique);

  const bookTitle   = sanitize(resolveBookTitle(project));
  const subtitle    = sanitize(project?.bookCover?.subtitle || project?.bookDetails?.subtitle || "");
  const bookTopic   = sanitize(
    project?.research?.bookTopic || project?.bookDetails?.bookTopic ||
    project?.research?.subNiche  || project?.research?.niche || "");
  const tagline     = sanitize(project?.bookCover?.tagline || "");
  const author      = sanitize(resolveAuthorName(project));
  const description = sanitize(project?.description?.description || project?.description || "");
  const authorBio   = sanitize(project?.authorBio?.bio || project?.authorBio?.background || "");
  const dedication      = sanitize(options.dedication      || "");
  const acknowledgments = sanitize(options.acknowledgments || "");
  const preface         = sanitize(options.preface         || "");

  const W = P.pageW, H = P.pageH;
  const ML = P.mLeft, MR = P.mRight, MT = P.mTop, MB = P.mBot;
  const textW = W - ML - MR;
  const BODY = P.bodySz, LH = P.lineH, PG = P.paraGap;

  const black     = rgb(0,    0,    0);
  const darkGray  = rgb(0.15, 0.15, 0.15);
  const midGray   = rgb(0.35, 0.35, 0.35);
  const lightGray = rgb(0.62, 0.62, 0.62);
  const accent    = rgb(0.10, 0.22, 0.52);

  // ── Page factories ─────────────────────────────────────────────────────────

  function newPage(): PDFPage { return pdf.addPage([W, H]); }

  let arabicPageNum = 0; // counts only main-content pages

  function drawHeader(page: PDFPage, chLabel: string, pageN: number, isRoman = false) {
    const num     = isRoman ? toRoman(pageN) : String(pageN);
    const headerY = H - MT + 22;
    const footerY = MB - 18;

    page.drawLine({ start: { x: ML, y: headerY - 3 }, end: { x: W - MR, y: headerY - 3 }, thickness: 0.4, color: lightGray });
    page.drawText(bookTitle.slice(0, 48), { x: ML, y: headerY + 3, size: 7, font: italic, color: lightGray });
    if (chLabel) {
      const cw = italic.widthOfTextAtSize(chLabel.slice(0, 40), 7);
      page.drawText(chLabel.slice(0, 40), { x: W - MR - cw, y: headerY + 3, size: 7, font: italic, color: lightGray });
    }
    page.drawLine({ start: { x: ML, y: footerY + 3 }, end: { x: W - MR, y: footerY + 3 }, thickness: 0.4, color: lightGray });
    const pw = regular.widthOfTextAtSize(num, 8);
    page.drawText(num, { x: ML + textW / 2 - pw / 2, y: footerY - 10, size: 8, font: regular, color: midGray });
  }

  // ── TOC entry collection ───────────────────────────────────────────────────
  const tocEntries: TocEntry[] = [];
  console.log("[Export] PDF render started");

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  {
    const page = newPage();
    page.drawRectangle({ x: ML, y: H - 42, width: textW, height: 5, color: accent });

    const titleLines = wrapTextPdf(bookTitle, bold, P.titleSz, textW);
    const titleBlockH = titleLines.length * (P.titleSz + 7);
    let y = H * 0.52 + titleBlockH / 2;

    for (const line of titleLines) {
      const tw = bold.widthOfTextAtSize(line, P.titleSz);
      page.drawText(line, { x: ML + (textW - tw) / 2, y, size: P.titleSz, font: bold, color: black });
      y -= P.titleSz + 7;
    }
    y -= 14;
    page.drawRectangle({ x: ML + textW * 0.2, y, width: textW * 0.6, height: 1.5, color: accent });
    y -= 18;

    if (subtitle) {
      const subLines = wrapTextPdf(subtitle, italic, P.sectionSz, textW * 0.85);
      for (const sl of subLines) {
        const sw = italic.widthOfTextAtSize(sl, P.sectionSz);
        page.drawText(sl, { x: ML + (textW - sw) / 2, y, size: P.sectionSz, font: italic, color: darkGray });
        y -= P.sectionSz + 6;
      }
      y -= 8;
    }
    if (bookTopic) {
      const tw = regular.widthOfTextAtSize(bookTopic.slice(0, 60), BODY - 1);
      page.drawText(bookTopic.slice(0, 60), { x: ML + (textW - tw) / 2, y, size: BODY - 1, font: regular, color: midGray });
      y -= BODY + 8;
    }
    if (tagline) {
      const tl = tagline.slice(0, 80);
      const tw = italic.widthOfTextAtSize(tl, BODY);
      page.drawText(tl, { x: ML + (textW - tw) / 2, y, size: BODY, font: italic, color: midGray });
    }

    const byLine = `by ${author}`;
    const aw = regular.widthOfTextAtSize(byLine, 13);
    page.drawText(byLine, { x: ML + (textW - aw) / 2, y: H * 0.19, size: 13, font: regular, color: darkGray });
    page.drawRectangle({ x: ML, y: 34, width: textW, height: 5, color: accent });
  }

  // ── COPYRIGHT PAGE ──────────────────────────────────────────────────────────
  {
    const page = newPage();
    const year = new Date().getFullYear();
    let y = H * 0.38;
    const lines = [
      `Copyright © ${year} ${author}`,
      "",
      "All rights reserved.",
      "",
      "No part of this publication may be reproduced, distributed, or transmitted",
      "in any form or by any means, including photocopying, recording, or other",
      "electronic or mechanical methods, without the prior written permission of",
      "the author, except in the case of brief quotations embodied in critical",
      "reviews and certain other noncommercial uses permitted by copyright law.",
      "",
      "First Edition"
    ];
    for (const line of lines) {
      if (!line) { y -= BODY; continue; }
      const w = regular.widthOfTextAtSize(line, BODY - 1);
      page.drawText(line, { x: ML + (textW - w) / 2, y, size: BODY - 1, font: regular, color: midGray });
      y -= LH;
    }
  }

  // ── OPTIONAL FRONT MATTER ──────────────────────────────────────────────────

  let romanPage = 2; // cover=1, copyright=2; front matter starts at 3

  // Dedication
  if (dedication) {
    romanPage++;
    const page = newPage();
    drawHeader(page, "", romanPage, true);
    const dlines = wrapTextPdf(dedication, italic, 13, textW * 0.7);
    let y = H * 0.5 + (dlines.length * 20) / 2;
    for (const dl of dlines) {
      const dw = italic.widthOfTextAtSize(dl, 13);
      page.drawText(dl, { x: ML + (textW - dw) / 2, y, size: 13, font: italic, color: midGray });
      y -= 22;
    }
  }

  // Acknowledgments — register as front matter TOC entry
  if (acknowledgments) {
    romanPage++;
    const page = newPage();
    drawHeader(page, "Acknowledgments", romanPage, true);
    let y = H - MT - 10;
    page.drawText("Acknowledgments", { x: ML, y, size: P.chapterSz, font: bold, color: black });
    y -= P.chapterSz + 24;
    for (const line of wrapTextPdf(acknowledgments, regular, BODY, textW)) {
      if (!line) { y -= PG; continue; }
      if (y < MB + 20) { y = H - MT - 10; }
      page.drawText(line, { x: ML, y, size: BODY, font: regular, color: black });
      y -= LH;
    }
    tocEntries.push({ label: "Acknowledgments", displayNum: toRoman(romanPage), level: 0, pdfPageRef: page });
  }

  // ── TABLE OF CONTENTS (pre-allocate 2 pages) ─────────────────────────────
  romanPage++;
  const tocPage1 = newPage();
  const tocRomanNum = romanPage;

  let tocPage2: PDFPage | null = null;

  // ── PREFACE ──────────────────────────────────────────────────────────────────
  if (preface) {
    romanPage++;
    const page = newPage();
    drawHeader(page, "Preface", romanPage, true);
    let y = H - MT - 10;
    page.drawText("Preface", { x: ML, y, size: P.chapterSz, font: bold, color: black });
    y -= P.chapterSz + 24;
    for (const line of wrapTextPdf(preface, regular, BODY, textW)) {
      if (!line) { y -= PG; continue; }
      if (y < MB + 20) { y = H - MT - 10; }
      page.drawText(line, { x: ML, y, size: BODY, font: regular, color: black });
      y -= LH;
    }
    tocEntries.push({ label: "Preface", displayNum: toRoman(romanPage), level: 0, pdfPageRef: page });
  }

  // ── MAIN CONTENT ─────────────────────────────────────────────────────────────
  const lessons = project?.lessons && typeof project.lessons === "object" ? project.lessons : {};
  const hier    = buildHierarchy(project?.bookOutline);

  // Draw an italic intro block (chapter or section intro); returns updated { page, y }
  function drawIntroBlock(
    page: PDFPage, text: string, startY: number, chNum: number, extraGapBelow = 16
  ): { page: PDFPage; y: number } {
    let y = startY;
    let currentPage = page;
    const lines = wrapTextPdf(sanitize(text), italic, BODY, textW);
    if (y - LH * lines.length < MB + 20) {
      arabicPageNum++;
      currentPage = newPage();
      const label = chNum > 0 ? `${P.chapterPrefix} ${chNum}` : "";
      drawHeader(currentPage, label, arabicPageNum, false);
      y = H - MT - 10;
    }
    for (const ln of lines) {
      currentPage.drawText(ln, { x: ML, y, size: BODY, font: italic, color: midGray });
      y -= LH;
    }
    y -= extraGapBelow;
    return { page: currentPage, y };
  }

  // Returns the page and the Y position ready for the first section heading/content.
  function drawChapterPage(chTitle: string, chNum: number, chapterIntro = ""): { page: PDFPage; y: number } {
    arabicPageNum++;
    const page = newPage();
    const label = chNum > 0 ? `${P.chapterPrefix} ${chNum}` : "";
    drawHeader(page, label, arabicPageNum, false);

    let y = H - MT - 46;
    if (chNum > 0) {
      page.drawText(`${P.chapterPrefix} ${chNum}`, { x: ML, y, size: 10, font: regular, color: accent });
      y -= 16;
    }
    const tLines = wrapTextPdf(chTitle, bold, P.chapterSz, textW);
    for (const tl of tLines) {
      page.drawText(sanitize(tl), { x: ML, y, size: P.chapterSz, font: bold, color: black });
      y -= P.chapterSz + 6;
    }
    y -= 6;
    page.drawRectangle({ x: ML, y, width: 48, height: 2, color: accent });
    y -= 22;

    // Chapter introduction — italic, separated from the first section by extra whitespace
    if (chapterIntro) {
      const result = drawIntroBlock(page, chapterIntro, y, chNum, 24);
      return result;
    }
    return { page, y };
  }

  function drawProseBlocks(
    page: PDFPage,
    blocks: ProseBlock[],
    startY: number,
    chNum: number,
    indentFirst = true
  ): { page: PDFPage; y: number } {
    let y = startY;
    let currentPage = page;
    let firstPara = indentFirst;

    function ensureRoom(needed: number) {
      if (y - needed < MB + 20) {
        arabicPageNum++;
        currentPage = newPage();
        const label = chNum > 0 ? `${P.chapterPrefix} ${chNum}` : "";
        drawHeader(currentPage, label, arabicPageNum, false);
        y = H - MT - 10;
      }
    }

    for (const block of blocks) {
      if (block.kind === "bullet") {
        firstPara = false;
        const bulletText = `\u2022  ${sanitize(block.text)}`;
        const lines = wrapTextPdf(bulletText, regular, BODY, textW - 18);
        ensureRoom(LH * lines.length + 4);
        for (const ln of lines) {
          currentPage.drawText(ln, { x: ML + 14, y, size: BODY, font: regular, color: black });
          y -= LH;
        }
        y -= 3;
      } else if (block.kind === "numbered") {
        firstPara = false;
        const numText = `${block.num}.  ${sanitize(block.text)}`;
        const lines = wrapTextPdf(numText, regular, BODY, textW - 18);
        ensureRoom(LH * lines.length + 4);
        for (const ln of lines) {
          currentPage.drawText(ln, { x: ML + 14, y, size: BODY, font: regular, color: black });
          y -= LH;
        }
        y -= 3;
      } else {
        const indent = firstPara ? P.indent : 0;
        firstPara = false;
        const lines = wrapTextPdf(sanitize(block.text), regular, BODY, textW - indent);
        ensureRoom(LH * lines.length + PG);
        for (const ln of lines) {
          currentPage.drawText(ln, { x: ML + indent, y, size: BODY, font: regular, color: black });
          y -= LH;
        }
        y -= PG;
      }
    }
    return { page: currentPage, y };
  }

  // Introduction
  if (hier.introduction) {
    const prose = String(lessons[hier.introduction.id]?.prose || "").trim();
    if (prose) {
      const { page, y } = drawChapterPage(sanitize(hier.introduction.title), 0);
      tocEntries.push({ label: sanitize(hier.introduction.title), displayNum: String(arabicPageNum), level: 0, pdfPageRef: page });
      drawProseBlocks(page, parseProseBlocks(prose), y, 0);
    }
  }

  // Chapters
  for (const ch of hier.chapters) {
    let chPageStarted = false;
    let currentChPage: PDFPage | null = null;
    let chBodyY = 0;

    // Pre-build chapter intro (uses chapter title + all section titles)
    const chapterIntroText = buildChapterIntro(ch.title, ch.sections.map(s => s.title));

    for (const sec of ch.sections) {
      const secLabel = `${ch.chNum}.${sec.secNum}`;

      if (sec.subsections.length === 0) {
        const prose = String(lessons[sec.id]?.prose || "").trim();
        if (!prose) continue;

        if (!chPageStarted) {
          chPageStarted = true;
          const chResult = drawChapterPage(sanitize(ch.title), ch.chNum, chapterIntroText);
          currentChPage = chResult.page;
          chBodyY = chResult.y;
          tocEntries.push({
            label: `${P.chapterPrefix} ${ch.chNum}: ${sanitize(ch.title)}`,
            displayNum: String(arabicPageNum), level: 0, pdfPageRef: currentChPage
          });
        }

        if (chBodyY < MB + 80) {
          arabicPageNum++;
          currentChPage = newPage();
          drawHeader(currentChPage, `${P.chapterPrefix} ${ch.chNum}`, arabicPageNum, false);
          chBodyY = H - MT - 10;
        }

        // Section heading
        tocEntries.push({
          label: `${secLabel}  ${sanitize(sec.title)}`,
          displayNum: String(arabicPageNum), level: 1, pdfPageRef: currentChPage!
        });
        currentChPage!.drawText(`${secLabel}  ${sanitize(sec.title)}`, {
          x: ML, y: chBodyY, size: P.sectionSz, font: bold, color: black
        });
        chBodyY -= P.sectionSz + 14;

        // Section introduction (italic, before main content)
        const secIntro = buildSectionIntro(sec.title, ch.title);
        const introResult = drawIntroBlock(currentChPage!, secIntro, chBodyY, ch.chNum, 10);
        currentChPage = introResult.page;
        chBodyY = introResult.y;

        const result = drawProseBlocks(currentChPage!, parseProseBlocks(prose), chBodyY, ch.chNum, true);
        currentChPage = result.page;
        chBodyY = result.y;

      } else {
        let secStarted = false;

        for (const sub of sec.subsections) {
          const subLabel = `${ch.chNum}.${sec.secNum}.${sub.subNum}`;
          const prose = String(lessons[sub.id]?.prose || "").trim();
          if (!prose) continue;

          if (!chPageStarted) {
            chPageStarted = true;
            const chResult = drawChapterPage(sanitize(ch.title), ch.chNum, chapterIntroText);
            currentChPage = chResult.page;
            chBodyY = chResult.y;
            tocEntries.push({
              label: `${P.chapterPrefix} ${ch.chNum}: ${sanitize(ch.title)}`,
              displayNum: String(arabicPageNum), level: 0, pdfPageRef: currentChPage
            });
          }

          if (!secStarted) {
            secStarted = true;
            if (chBodyY < MB + 80) {
              arabicPageNum++;
              currentChPage = newPage();
              drawHeader(currentChPage!, `${P.chapterPrefix} ${ch.chNum}`, arabicPageNum, false);
              chBodyY = H - MT - 10;
            }
            tocEntries.push({
              label: `${secLabel}  ${sanitize(sec.title)}`,
              displayNum: String(arabicPageNum), level: 1, pdfPageRef: currentChPage!
            });
            currentChPage!.drawText(`${secLabel}  ${sanitize(sec.title)}`, {
              x: ML, y: chBodyY, size: P.sectionSz, font: bold, color: black
            });
            chBodyY -= P.sectionSz + 14;

            // Section introduction (shown once per section, before its subsections)
            const secIntro = buildSectionIntro(sec.title, ch.title);
            const introResult = drawIntroBlock(currentChPage!, secIntro, chBodyY, ch.chNum, 10);
            currentChPage = introResult.page;
            chBodyY = introResult.y;
          }

          if (chBodyY < MB + 80) {
            arabicPageNum++;
            currentChPage = newPage();
            drawHeader(currentChPage!, `${P.chapterPrefix} ${ch.chNum}`, arabicPageNum, false);
            chBodyY = H - MT - 10;
          }
          tocEntries.push({
            label: `${subLabel}  ${sanitize(sub.title)}`,
            displayNum: String(arabicPageNum), level: 2, pdfPageRef: currentChPage!
          });
          currentChPage!.drawText(`${subLabel}  ${sanitize(sub.title)}`, {
            x: ML, y: chBodyY, size: P.subsectionSz, font: bold, color: midGray
          });
          chBodyY -= P.subsectionSz + 12;

          const result = drawProseBlocks(currentChPage!, parseProseBlocks(prose), chBodyY, ch.chNum, true);
          currentChPage = result.page;
          chBodyY = result.y;
        }
      }
    }
  }

  // Conclusion
  if (hier.conclusion) {
    const prose = String(lessons[hier.conclusion.id]?.prose || "").trim();
    if (prose) {
      const { page, y } = drawChapterPage(sanitize(hier.conclusion.title), 0);
      tocEntries.push({ label: sanitize(hier.conclusion.title), displayNum: String(arabicPageNum), level: 0, pdfPageRef: page });
      drawProseBlocks(page, parseProseBlocks(prose), y, 0);
    }
  }

  // About the Author (back matter)
  if (authorBio) {
    arabicPageNum++;
    const page = newPage();
    drawHeader(page, "About the Author", arabicPageNum, false);
    let y = H - MT - 10;
    page.drawText("About the Author", { x: ML, y, size: P.chapterSz, font: bold, color: black });
    y -= P.chapterSz + 8;
    page.drawRectangle({ x: ML, y, width: 48, height: 2, color: accent });
    y -= 24;
    drawProseBlocks(page, parseProseBlocks(authorBio), y, 0, false);
  }

  // Validate chapter coverage
  const chapterTocCount = tocEntries.filter(e => e.level === 0).length;
  console.log("[Export] Chapter anchors created —", tocEntries.length, "TOC entries (" + chapterTocCount + " top-level)");
  if (chapterTocCount === 0) {
    console.warn("[Export] WARNING: No chapters found in TOC — check that lesson prose is saved.");
  }

  // ── PASS 2: Render TOC ────────────────────────────────────────────────────
  // Font sizes and indentation per level
  const TOC_FONTS  = [bold, regular, regular];
  const TOC_SIZES  = [10.5, 9.5, 8.5];
  const TOC_INDENT = [0, 16, 30];
  const TOC_STEP   = [22, 18, 15];
  const TOC_COLORS = [black, darkGray, midGray];

  // Estimate if we need a second TOC page
  const tocAvailH = H - MT - MB - 80; // usable height per TOC page
  const estimatedH = tocEntries.reduce((acc, e) => acc + TOC_STEP[Math.min(e.level, 2)] + (e.level === 0 ? 4 : 0), 0);
  if (estimatedH > tocAvailH) {
    // Use getPages() (returns PDFPage[]) not getPageIndices() (returns number[])
    // so indexOf can find the actual page object reference correctly.
    const tocPage1Index = pdf.getPages().indexOf(tocPage1);
    tocPage2 = pdf.insertPage(tocPage1Index + 1, [W, H]);
  }

  // Fill TOC header on page 1
  {
    drawHeader(tocPage1, "Contents", tocRomanNum, true);
    const titleY = H - MT - 10;
    tocPage1.drawText("Contents", { x: ML, y: titleY, size: P.chapterSz, font: bold, color: black });
    tocPage1.drawRectangle({ x: ML, y: titleY - P.chapterSz - 10, width: 40, height: 2, color: accent });
  }
  if (tocPage2) {
    drawHeader(tocPage2, "Contents", tocRomanNum + 1, true);
  }

  // Fill TOC entries
  let ty  = H - MT - 10 - P.chapterSz - 36;
  let activeTocPage = tocPage1;
  let onSecondTocPage = false;

  for (const entry of tocEntries) {
    const level  = Math.min(entry.level, 2);
    const fnt    = TOC_FONTS[level];
    const sz     = TOC_SIZES[level];
    const indent = TOC_INDENT[level];
    const step   = TOC_STEP[level] + (level === 0 ? 4 : 0);
    const clr    = TOC_COLORS[level];

    // Overflow to page 2
    if (ty < MB + 20) {
      if (tocPage2 && !onSecondTocPage) {
        onSecondTocPage = true;
        activeTocPage = tocPage2;
        ty = H - MT - 30;
      } else {
        break; // no more TOC space
      }
    }

    const x = ML + indent;

    // Wrap long TOC labels
    const maxLabelW = textW - indent - 50;
    const labelLines = wrapTextPdf(entry.label, fnt, sz, maxLabelW);
    const pg = entry.displayNum;

    // First line: label + dots + page number
    const firstLine = labelLines[0] || "";
    const pgW   = regular.widthOfTextAtSize(pg, sz);
    const pgX   = W - MR - pgW;
    const labelEnd = x + fnt.widthOfTextAtSize(firstLine, sz) + 4;
    const dotArea  = pgX - 4 - labelEnd;

    activeTocPage.drawText(firstLine, { x, y: ty, size: sz, font: fnt, color: clr });
    activeTocPage.drawText(pg,        { x: pgX, y: ty, size: sz, font: regular, color: midGray });

    // Dotted leader
    if (dotArea > 8) {
      const dotStep = 4.5;
      const dotCount = Math.floor(dotArea / dotStep);
      let dx = labelEnd;
      for (let d = 0; d < dotCount; d++) {
        activeTocPage.drawText(".", { x: dx, y: ty, size: sz, font: regular, color: lightGray });
        dx += dotStep;
      }
    }

    // Additional lines of a wrapped label (no dots, no page number)
    for (let li = 1; li < labelLines.length; li++) {
      ty -= sz + 3;
      activeTocPage.drawText(labelLines[li], { x, y: ty, size: sz, font: fnt, color: clr });
    }

    // Clickable annotation spanning the full TOC row
    if (entry.pdfPageRef) {
      try {
        const rowBottom = ty - 2;
        const rowTop    = ty + sz + 2;
        addLinkAnnotation(activeTocPage, [ML, rowBottom, W - MR, rowTop], entry.pdfPageRef, pdf);
      } catch { /* skip */ }
    }

    ty -= step;
  }

  console.log("[Export] TOC generated —", tocEntries.length, "entries on", tocPage2 ? "2" : "1", "TOC page(s)");
  console.log("[Export] PDF render completed —", pdf.getPageCount(), "total pages");
  return pdf.save();
}

// ─── DOCX BUILDER ─────────────────────────────────────────────────────────────

async function buildBookDocx(project: any, options: any = {}): Promise<Buffer> {
  const P = PRESETS[options.preset] || PRESETS.kdp_pro;

  const bookTitle   = resolveBookTitle(project);
  const subtitle    = project?.bookCover?.subtitle || project?.bookDetails?.subtitle || "";
  const bookTopic   = project?.research?.bookTopic || project?.bookDetails?.bookTopic ||
                      project?.research?.subNiche  || project?.research?.niche || "";
  const author      = resolveAuthorName(project);
  const description = project?.description?.description || project?.description || "";
  const authorBio   = project?.authorBio?.bio || project?.authorBio?.background || "";
  const dedication      = options.dedication      || "";
  const acknowledgments = options.acknowledgments || "";
  const preface         = options.preface         || "";
  const lessons = project?.lessons && typeof project.lessons === "object" ? project.lessons : {};
  const hier    = buildHierarchy(project?.bookOutline);

  // ── Build TOC entry list BEFORE content paragraphs ──────────────────────
  // Must happen here so the static TOC accurately reflects what will be rendered.
  interface DocxTocEntry { label: string; level: number }
  const tocDocxEntries: DocxTocEntry[] = [];

  if (options.acknowledgments) tocDocxEntries.push({ label: "Acknowledgments", level: 0 });
  if (options.preface)         tocDocxEntries.push({ label: "Preface",          level: 0 });

  if (hier.introduction) {
    const introProse = String(lessons[hier.introduction.id]?.prose || "").trim();
    if (introProse) tocDocxEntries.push({ label: hier.introduction.title, level: 0 });
  }

  for (const ch of hier.chapters) {
    let chHasContent = false;
    for (const sec of ch.sections) {
      if (sec.subsections.length === 0) {
        if (String(lessons[sec.id]?.prose || "").trim()) { chHasContent = true; break; }
      } else {
        if (sec.subsections.some(sub => String(lessons[sub.id]?.prose || "").trim())) {
          chHasContent = true; break;
        }
      }
    }
    if (!chHasContent) continue;

    tocDocxEntries.push({ label: `${P.chapterPrefix} ${ch.chNum}: ${ch.title}`, level: 0 });
    for (const sec of ch.sections) {
      const secHas = sec.subsections.length === 0
        ? !!String(lessons[sec.id]?.prose || "").trim()
        : sec.subsections.some(sub => !!String(lessons[sub.id]?.prose || "").trim());
      if (!secHas) continue;
      tocDocxEntries.push({ label: `${ch.chNum}.${sec.secNum}\u2003${sec.title}`, level: 1 });
      for (const sub of sec.subsections) {
        if (!String(lessons[sub.id]?.prose || "").trim()) continue;
        tocDocxEntries.push({ label: `${ch.chNum}.${sec.secNum}.${sub.subNum}\u2003${sub.title}`, level: 2 });
      }
    }
  }

  if (hier.conclusion) {
    const concProse = String(lessons[hier.conclusion.id]?.prose || "").trim();
    if (concProse) tocDocxEntries.push({ label: hier.conclusion.title, level: 0 });
  }
  if (options.authorBio || project?.authorBio?.bio || project?.authorBio?.background) {
    tocDocxEntries.push({ label: "About the Author", level: 0 });
  }

  console.log("[Export] DOCX render started");
  console.log("[Export] DOCX TOC generated —", tocDocxEntries.length, "entries");

  const bodyFont = P.docxBody;
  const headFont = P.docxHead;
  const LINE     = P.docxLineSpacing ?? 276;
  const HP       = (pt: number) => pt * 2; // half-points

  // ── Paragraph factories ────────────────────────────────────────────────────

  function bodyPara(text: string, firstPara = false): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text, font: bodyFont, size: HP(P.bodySz), color: "000000" })],
      alignment: AlignmentType.BOTH,
      indent: { firstLine: firstPara && P.indent > 0 ? convertInchesToTwip(P.indent / 72) : 0 },
      spacing: { before: firstPara ? 0 : 60, after: 60, line: LINE, lineRule: "auto" as any }
    });
  }

  function bulletPara(text: string): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text: `\u2022\u2002${text}`, font: bodyFont, size: HP(P.bodySz), color: "000000" })],
      alignment: AlignmentType.LEFT,
      indent: { left: convertInchesToTwip(0.25), firstLine: 0 },
      spacing: { before: 60, after: 60, line: LINE, lineRule: "auto" as any }
    });
  }

  function numberedParaD(num: number, text: string): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text: `${num}.\u2002${text}`, font: bodyFont, size: HP(P.bodySz), color: "000000" })],
      alignment: AlignmentType.LEFT,
      indent: { left: convertInchesToTwip(0.25), firstLine: 0 },
      spacing: { before: 60, after: 60, line: LINE, lineRule: "auto" as any }
    });
  }

  // Heading 1 = chapter title "Chapter N: The Title" (appears in Word TOC as level 1)
  // Heading 2 = section     "N.M  Section Title"    (appears as level 2)
  // Heading 3 = subsection  "N.M.P  Sub Title"      (appears as level 3)
  function h1Para(text: string, extra?: any): Paragraph {
    return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 }, ...extra });
  }
  function h2Para(text: string, extra?: any): Paragraph {
    return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 160 }, ...extra });
  }
  function h3Para(text: string, extra?: any): Paragraph {
    return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 280, after: 120 }, ...extra });
  }
  function h4Para(text: string, extra?: any): Paragraph {
    return new Paragraph({ text, heading: HeadingLevel.HEADING_4 as any, spacing: { before: 200, after: 80 }, ...extra });
  }

  function pageBreak(): Paragraph {
    return new Paragraph({ children: [new TextRun({ break: 1 } as any)], spacing: { before: 0, after: 0 } });
  }

  function centeredPara(text: string, sizePt: number, bold_ = false, italic_ = false, color = "000000", spacingBefore = 120, spacingAfter = 120): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text, font: bodyFont, size: HP(sizePt), bold: bold_, italics: italic_, color })],
      alignment: AlignmentType.CENTER,
      spacing: { before: spacingBefore, after: spacingAfter }
    });
  }

  // Italic intro paragraphs — visually distinct from body, separated by extra spacing
  function chapterIntroPara(text: string): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text, font: bodyFont, size: HP(P.bodySz), italics: true, color: "4A4A4A" })],
      alignment: AlignmentType.LEFT,
      spacing: { before: 100, after: 340, line: LINE, lineRule: "auto" as any }
    });
  }

  function sectionIntroPara(text: string): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text, font: bodyFont, size: HP(P.bodySz), italics: true, color: "4A4A4A" })],
      alignment: AlignmentType.LEFT,
      spacing: { before: 60, after: 220, line: LINE, lineRule: "auto" as any }
    });
  }

  function addProseBlocks(children: Paragraph[], prose: string) {
    const blocks = parseProseBlocks(prose);
    let isFirst = true;
    for (const block of blocks) {
      if (block.kind === "bullet") {
        isFirst = false;
        children.push(bulletPara(block.text));
      } else if (block.kind === "numbered") {
        isFirst = false;
        children.push(numberedParaD(block.num, block.text));
      } else {
        children.push(bodyPara(block.text, isFirst));
        isFirst = false;
      }
    }
  }

  // ── Front matter ──────────────────────────────────────────────────────────

  const frontChildren: Paragraph[] = [];

  // Cover page
  frontChildren.push(centeredPara(bookTitle, P.titleSz, true, false, "000000", 3600, 200));
  frontChildren.push(new Paragraph({ border: { bottom: { color: "999999", space: 1, style: "single", size: 4 } }, spacing: { before: 0, after: 80 } }));
  if (subtitle)  frontChildren.push(centeredPara(subtitle,  P.sectionSz, false, true, "333333", 120, 120));
  if (bookTopic) frontChildren.push(centeredPara(bookTopic, P.bodySz,    false, false, "666666", 80, 80));
  frontChildren.push(centeredPara(`by ${author}`, 14, false, false, "333333", 1200, 3000));
  frontChildren.push(pageBreak());

  // Copyright page
  const year = new Date().getFullYear();
  frontChildren.push(
    centeredPara(`Copyright © ${year} ${author}`, P.bodySz, false, false, "333333", 3600, 160),
    centeredPara("All rights reserved.", P.bodySz, false, false, "555555", 80, 80),
    centeredPara(
      "No part of this publication may be reproduced, distributed, or transmitted in any form or by any means without the prior written permission of the author.",
      P.bodySz - 1, false, false, "777777", 240, 3000
    ),
    pageBreak()
  );

  // Dedication
  if (dedication) {
    frontChildren.push(
      centeredPara(dedication, 13, false, true, "333333", 3000, 3000),
      pageBreak()
    );
  }

  // Acknowledgments
  if (acknowledgments) {
    frontChildren.push(h1Para("Acknowledgments", { pageBreakBefore: false }));
    addProseBlocks(frontChildren, acknowledgments);
    frontChildren.push(pageBreak());
  }

  // ── Table of Contents ──────────────────────────────────────────────────────
  // Uses a Word complex field (fldChar begin / instrText / separate / end).
  //  • w:dirty="true"  → Word auto-updates on open, populating page numbers
  //  • \o "1-3"        → include Heading 1–3
  //  • \h              → entries are clickable hyperlinks
  //  • \z              → hide tab/page number in web view
  //  • \u              → use applied paragraph outline level
  // Pre-rendered entries between separate/end give LibreOffice & Google Docs
  // a readable static fallback that Word replaces when updating the field.

  console.log("[Export] Heading styles detected — H1/H2/H3 applied to", tocDocxEntries.length, "outline entries");

  {
    // Helper: make a <w:fldChar> run with given fldCharType (and optional dirty flag)
    const fldCharRun = (type: string, dirty = false): XmlComponent => {
      const run = new XmlComponent("w:r");
      const fc  = new XmlComponent("w:fldChar");
      const attrs: Record<string, string> = { "w:fldCharType": type };
      if (dirty) attrs["w:dirty"] = "true";
      fc.root.push(new XmlAttributeComponent(attrs));
      run.root.push(fc);
      return run;
    };

    // Helper: make an <w:instrText> run with preserve-space
    const instrRun = (text: string): XmlComponent => {
      const run  = new XmlComponent("w:r");
      const it   = new XmlComponent("w:instrText");
      it.root.push(new XmlAttributeComponent({ "xml:space": "preserve" }));
      it.root.push(text);
      run.root.push(it);
      return run;
    };

    // TOC title — centred bold, NOT a heading (prevents it appearing in the TOC itself)
    frontChildren.push(centeredPara("Table of Contents", P.chapterSz + 2, true, false, "000000", 0, 280));

    // Paragraph 1: fldChar begin + instrText switches + fldChar separate
    const fieldBeginPara = new XmlComponent("w:p");
    fieldBeginPara.root.push(fldCharRun("begin", true));
    fieldBeginPara.root.push(instrRun(` TOC \\o "1-3" \\h \\z \\u `));
    fieldBeginPara.root.push(fldCharRun("separate"));
    frontChildren.push(fieldBeginPara as any);

    // Pre-rendered entries (static fallback; Word replaces with live page numbers)
    for (const entry of tocDocxEntries) {
      const level  = Math.min(entry.level, 2);
      const style  = ["TOC1", "TOC2", "TOC3"][level];
      const indent = [0, 360, 720][level];

      const ep   = new XmlComponent("w:p");
      const pPr  = new XmlComponent("w:pPr");
      const pSty = new XmlComponent("w:pStyle");
      pSty.root.push(new XmlAttributeComponent({ "w:val": style }));
      pPr.root.push(pSty);
      if (indent > 0) {
        const ind = new XmlComponent("w:ind");
        ind.root.push(new XmlAttributeComponent({ "w:left": String(indent) }));
        pPr.root.push(ind);
      }
      ep.root.push(pPr);

      const run = new XmlComponent("w:r");
      const t   = new XmlComponent("w:t");
      t.root.push(new XmlAttributeComponent({ "xml:space": "preserve" }));
      t.root.push(entry.label);
      run.root.push(t);
      ep.root.push(run);

      frontChildren.push(ep as any);
    }

    // Final paragraph: fldChar end
    const fieldEndPara = new XmlComponent("w:p");
    fieldEndPara.root.push(fldCharRun("end"));
    frontChildren.push(fieldEndPara as any);

    console.log("[Export] TOC field generated — complex fldChar field with", tocDocxEntries.length, "pre-rendered entries");
    console.log("[Export] Page references attached — Word will resolve on first open (w:dirty=true)");
    console.log("[Export] DOCX TOC validated — entries:", tocDocxEntries.filter(e => e.level === 0).length, "top-level,", tocDocxEntries.filter(e => e.level === 1).length, "sections");
  }

  frontChildren.push(pageBreak());

  // Preface
  if (preface) {
    frontChildren.push(h1Para("Preface", { pageBreakBefore: false }));
    addProseBlocks(frontChildren, preface);
    frontChildren.push(pageBreak());
  }

  // ── Main content ──────────────────────────────────────────────────────────

  const mainChildren: Paragraph[] = [];

  // Introduction
  if (hier.introduction) {
    const prose = String(lessons[hier.introduction.id]?.prose || "").trim();
    if (prose) {
      mainChildren.push(h1Para(hier.introduction.title, { pageBreakBefore: false }));
      addProseBlocks(mainChildren, prose);
    }
  }

  // Chapters — each chapter uses a SINGLE Heading 1: "Chapter N: The Title"
  // so that Word's auto-TOC picks up "Chapter 1: The Title" as a single level-1 entry.
  let firstChapter = true;
  for (const ch of hier.chapters) {
    let hasContent = false;
    const chChildren: Paragraph[] = [];

    const chH1Label = `${P.chapterPrefix} ${ch.chNum}: ${ch.title}`;
    chChildren.push(h1Para(chH1Label, { pageBreakBefore: !firstChapter }));

    // Chapter introduction — italic overview paragraph after the chapter title
    chChildren.push(chapterIntroPara(
      buildChapterIntro(ch.title, ch.sections.map(s => s.title))
    ));

    for (const sec of ch.sections) {
      const secLabel = `${ch.chNum}.${sec.secNum}\u2003${sec.title}`;

      if (sec.subsections.length === 0) {
        const prose = String(lessons[sec.id]?.prose || "").trim();
        if (!prose) continue;
        hasContent = true;
        chChildren.push(h2Para(secLabel));
        // Section introduction — italic bridging paragraph before the main content
        chChildren.push(sectionIntroPara(buildSectionIntro(sec.title, ch.title)));
        addProseBlocks(chChildren, prose);

      } else {
        let secAdded = false;
        for (const sub of sec.subsections) {
          const subLabel = `${ch.chNum}.${sec.secNum}.${sub.subNum}\u2003${sub.title}`;
          const prose = String(lessons[sub.id]?.prose || "").trim();
          if (!prose) continue;
          hasContent = true;
          if (!secAdded) {
            chChildren.push(h2Para(secLabel));
            // Section introduction shown once, before the first subsection
            chChildren.push(sectionIntroPara(buildSectionIntro(sec.title, ch.title)));
            secAdded = true;
          }
          chChildren.push(h3Para(subLabel));
          addProseBlocks(chChildren, prose);
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
      mainChildren.push(h1Para(hier.conclusion.title, { pageBreakBefore: true }));
      addProseBlocks(mainChildren, prose);
    }
  }

  // About the Author (back matter)
  if (authorBio) {
    mainChildren.push(h1Para("About the Author", { pageBreakBefore: true }));
    addProseBlocks(mainChildren, authorBio);
  }

  // ── Running header + footer ────────────────────────────────────────────────

  const runningHeader = new Header({
    children: [new Paragraph({
      children: [new TextRun({ text: bookTitle.slice(0, 60), font: bodyFont, size: HP(8), italics: true, color: "888888" })],
      alignment: AlignmentType.RIGHT,
      border: { bottom: { color: "CCCCCC", space: 1, style: "single", size: 4 } }
    })]
  });

  const runningFooter = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], font: bodyFont, size: HP(8), color: "888888" })],
      border: { top: { color: "CCCCCC", space: 1, style: "single", size: 4 } }
    })]
  });

  // ── DOCX Document ─────────────────────────────────────────────────────────
  // Define TOC paragraph styles (TOC 1, TOC 2, TOC 3) so Word renders
  // the auto-TOC with proper indentation and typography.

  const doc = new Document({
    creator: author,
    title: bookTitle,
    description: String(description).slice(0, 500),
    styles: {
      default: {
        document: {
          run: { font: bodyFont, size: HP(P.bodySz), color: "000000" },
          paragraph: { spacing: { line: LINE, lineRule: "auto" as any } }
        }
      },
      paragraphStyles: [
        // Heading styles — appear in Word's TOC with proper hierarchy
        {
          id: "Heading1", name: "Heading 1",
          run:       { font: headFont, size: HP(P.chapterSz), bold: true, color: "000000" },
          paragraph: { spacing: { before: 480, after: 240 } }
        },
        {
          id: "Heading2", name: "Heading 2",
          run:       { font: headFont, size: HP(P.sectionSz), bold: true, color: "0D0D0D" },
          paragraph: { spacing: { before: 360, after: 160 } }
        },
        {
          id: "Heading3", name: "Heading 3",
          run:       { font: headFont, size: HP(P.subsectionSz), bold: true, color: "1A1A1A" },
          paragraph: { spacing: { before: 280, after: 120 } }
        },
        {
          id: "Heading4", name: "Heading 4",
          run:       { font: headFont, size: HP(P.subsectionSz - 1), bold: true, italics: true, color: "2A2A2A" },
          paragraph: { spacing: { before: 200, after: 80 } }
        },
        // TOC paragraph styles — control appearance of auto-generated TOC
        {
          id: "TOC1", name: "TOC 1",
          run:       { font: bodyFont, size: HP(P.bodySz), bold: true, color: "000000" },
          paragraph: { spacing: { before: 80, after: 40 }, indent: { left: 0 } }
        },
        {
          id: "TOC2", name: "TOC 2",
          run:       { font: bodyFont, size: HP(P.bodySz - 1), color: "333333" },
          paragraph: { spacing: { before: 40, after: 20 }, indent: { left: convertInchesToTwip(0.25) } }
        },
        {
          id: "TOC3", name: "TOC 3",
          run:       { font: bodyFont, size: HP(P.bodySz - 2), color: "555555" },
          paragraph: { spacing: { before: 20, after: 20 }, indent: { left: convertInchesToTwip(0.5) } }
        }
      ]
    },
    sections: [
      {
        properties: {
          page: { margin: { top: P.docxMTop, bottom: P.docxMBot, left: P.docxMLeft, right: P.docxMRight } }
        },
        children: frontChildren
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

  console.log("[Export] DOCX render completed —", tocDocxEntries.length, "TOC entries,", mainChildren.length, "main paragraphs");
  console.log("[Export] Export completed");
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

// ─── Blueprint DOCX export ────────────────────────────────────────────────────

function bpHeading1(text: string): Paragraph {
  return new Paragraph({
    text: sanitize(text),
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 120 },
    pageBreakBefore: true
  });
}

function bpHeading2(text: string): Paragraph {
  return new Paragraph({
    text: sanitize(text),
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 80 }
  });
}

function bpBody(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: sanitize(text), size: 22 })],
    spacing: { after: 140 }
  });
}

function bpKV(key: string, value: string): Paragraph {
  if (!value || !value.trim()) return new Paragraph({ children: [] });
  return new Paragraph({
    children: [
      new TextRun({ text: sanitize(key) + ": ", bold: true, size: 22 }),
      new TextRun({ text: sanitize(value), size: 22 })
    ],
    spacing: { after: 100 }
  });
}

function bpLabel(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: sanitize(text), bold: true, size: 20, color: "475569" })],
    spacing: { before: 180, after: 60 }
  });
}

function bpBullets(text: string): Paragraph[] {
  return String(text || "").split(/\n|,\s*/).map(s => s.trim()).filter(Boolean).map(s =>
    new Paragraph({
      children: [new TextRun({ text: "• " + sanitize(s), size: 22 })],
      spacing: { after: 60 },
      indent: { left: 360 }
    })
  );
}

function bpDivider(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: "single" as any, size: 4, color: "CBD5E1", space: 1 } },
    spacing: { before: 200, after: 200 }
  });
}

interface ChapterArchitecture {
  chapters: Array<{
    number: number;
    title: string;
  }>;
}

/** Convert "Main Title: Subtitle" → "Main Title (Subtitle)". Leaves other titles unchanged. */
function formatArchitectureTitle(raw: string): string {
  const s = String(raw || "").trim();
  const colonIdx = s.indexOf(":");
  if (colonIdx === -1) return s;
  const left  = s.slice(0, colonIdx).trim();
  const right = s.slice(colonIdx + 1).trim();
  return right ? `${left} (${right})` : left;
}

async function generateChapterArchitecture(project: any): Promise<ChapterArchitecture> {
  // Prefer existing outline chapters — avoids an AI call and uses confirmed data
  const outlineChapters = project?.bookOutline?.chapters;
  if (Array.isArray(outlineChapters) && outlineChapters.length > 0) {
    const chapters = outlineChapters.map((ch: any, i: number) => ({
      number: i + 1,
      title: formatArchitectureTitle(ch.title || `Chapter ${i + 1}`)
    }));
    console.log(`[Export] Architecture from outline — ${chapters.length} chapters`);
    return { chapters };
  }

  // Fallback: generate via AI when no outline exists yet
  const chapterCount = project?.bookDetails?.chapterCount || 10;
  console.log(`[Export] Generating chapter architecture — ${chapterCount} chapters via AI…`);
  const prompt = chapterArchitecturePrompt(project);
  const result = await generateContent(prompt, undefined, { maxTokens: 3000 });
  const raw = extractJSON(result.text);

  if (!raw || !Array.isArray(raw.chapters) || raw.chapters.length === 0) {
    throw new Error("AI did not return a valid chapter architecture.");
  }

  const chapters = raw.chapters.map((ch: any, i: number) => ({
    number: ch.number || i + 1,
    title: formatArchitectureTitle(String(ch.title || `Chapter ${i + 1}`).trim())
  }));

  console.log(`[Export] Architecture generated — ${chapters.length} chapters, provider: ${result.usedProvider}`);
  return { chapters };
}

async function buildBlueprintDocx(project: any, architecture: ChapterArchitecture): Promise<Buffer> {
  const bd   = project?.bookDetails   || {};
  const r    = project?.research      || {};
  const intel = project?.analysis?.intelligence || {};
  const pb   = project?.proposedBook?.content || {};
  const bt   = project?.bookTitle     || {};
  const ap   = project?.authorPersona || {};

  const saved   = Array.isArray(ap.savedPersonas) ? ap.savedPersonas : [];
  const pid     = ap.selectedId;
  const persona = pid ? saved.find((p: any) => p.id === pid) || saved[0] : saved[0];

  const bookTitle = sanitize(
    bd.title?.trim() ||
    bt?.selectedCard?.title?.trim() ||
    pb.title?.trim() ||
    r.bookTitle?.trim() ||
    "Untitled Book"
  );
  const subtitle = sanitize(bd.subtitle?.trim() || bt?.selectedCard?.subtitle?.trim() || r.bookSubtitle?.trim() || "");
  const authorName = sanitize(
    persona?.authorName?.trim() ||
    (project?.authorBio?.authorName?.trim()) ||
    r.authorName?.trim() ||
    "Author"
  );

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const children: Paragraph[] = [];

  // ── TITLE PAGE ─────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: bookTitle, bold: true, size: 56 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 1440, after: 240 }
    }),
    ...(subtitle ? [new Paragraph({
      children: [new TextRun({ text: subtitle, size: 32, italics: true, color: "475569" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 }
    })] : []),
    new Paragraph({
      children: [new TextRun({ text: "CHAPTER ARCHITECTURE BLUEPRINT", bold: true, size: 24, color: "64748B", allCaps: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `by ${authorName}`, size: 24, color: "64748B" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${dateStr}`, size: 20, color: "94A3B8" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 }
    }),
    new Paragraph({
      children: [new TextRun({
        text: [
          `${architecture.chapters.length} Chapters`,
          bd.structure ? `  ·  ${bd.structure}` : ""
        ].join(""),
        size: 18, color: "94A3B8", italics: true
      })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 1440 }
    })
  );

  // ── BOOK FOUNDATION ────────────────────────────────────────────────────────
  children.push(bpHeading1("Book Foundation"));

  // Core identifiers
  children.push(
    bpKV("Title",              bookTitle),
    bpKV("Subtitle",           subtitle),
    bpKV("Genre",              bd.genre || ""),
    bpKV("Structure",          bd.structure || ""),
    bpKV("Tone",               bd.tone || ""),
    bpKV("Target Audience",    bd.audience || ""),
    bpKV("Chapter Count",      bd.chapterCount ? String(bd.chapterCount) : ""),
    bpKV("Target Word Count",  bd.wordCountRange || ""),
    bpKV("Research Intensity", bd.researchIntensity || ""),
    bpKV("Book Topic",         r.bookTopic || pb.bookTopic || ""),
    bpKV("Author Stance",      r.stanceOnTopic || ""),
    bpKV("Standout Angle",     r.standout || "")
  );

  if (bd.positioningStatement || bd.corePromise || bd.coreThesis || bd.uniqueMechanism) {
    children.push(bpDivider());
    if (bd.positioningStatement) children.push(bpLabel("Positioning Statement"), bpBody(bd.positioningStatement));
    if (bd.corePromise)          children.push(bpLabel("Core Promise"),           bpBody(bd.corePromise));
    if (bd.coreThesis)           children.push(bpLabel("Core Thesis"),            bpBody(bd.coreThesis));
    if (bd.uniqueMechanism)      children.push(bpLabel("Unique Mechanism"),       bpBody(bd.uniqueMechanism));
  }

  if (bd.readerTransformationBefore || bd.readerTransformationAfter) {
    children.push(bpDivider(), bpLabel("Reader Transformation"));
    if (bd.readerTransformationBefore) children.push(bpBody("Before: " + bd.readerTransformationBefore));
    if (bd.readerTransformationAfter)  children.push(bpBody("After: "  + bd.readerTransformationAfter));
  }

  if (bd.uniqueSellingProposition) children.push(bpDivider(), bpLabel("Unique Selling Proposition"), bpBody(bd.uniqueSellingProposition));
  if (bd.readerPainPoints || intel.readerPainProfile) {
    children.push(bpLabel("Reader Pain Points"), bpBody(bd.readerPainPoints || intel.readerPainProfile));
  }
  if (bd.desiredEmotionalOutcome) children.push(bpLabel("Desired Emotional Outcome"), bpBody(bd.desiredEmotionalOutcome));
  if (bd.readerObjections)        children.push(bpLabel("Reader Objections"), ...bpBullets(bd.readerObjections));
  if (bd.focusTopics)             children.push(bpLabel("Focus Topics"), ...bpBullets(bd.focusTopics));

  // Author persona
  if (persona) {
    const g = persona.generated;
    children.push(bpDivider());
    children.push(bpKV("Author Name", authorName));
    if (g?.summary)              children.push(bpLabel("Author Summary"), bpBody(g.summary));
    if (g?.voice?.tone)          children.push(bpKV("Voice Tone", g.voice.tone));
    if (g?.style?.pacing)        children.push(bpKV("Pacing", g.style.pacing));
    if (persona.expertise?.trim()) children.push(bpLabel("Expertise"), bpBody(persona.expertise));
  }

  // Market intelligence
  if (intel.marketGapAnalysis || intel.positioningStrategy || intel.transformationPromise) {
    children.push(bpDivider(), bpHeading2("Market Intelligence"));
    if (intel.marketGapAnalysis)     children.push(bpLabel("Market Gap"),            bpBody(intel.marketGapAnalysis));
    if (intel.positioningStrategy)   children.push(bpLabel("Positioning Strategy"),  bpBody(intel.positioningStrategy));
    if (intel.transformationPromise) children.push(bpLabel("Transformation Promise"), bpBody(intel.transformationPromise));
    if (Array.isArray(intel.emotionalTriggers) && intel.emotionalTriggers.length) {
      children.push(bpLabel("Emotional Triggers"), ...bpBullets(intel.emotionalTriggers.join("\n")));
    }
  }

  // ── CHAPTER ARCHITECTURE ───────────────────────────────────────────────────
  children.push(bpHeading1("Chapter Architecture"));
  children.push(bpDivider());

  for (const ch of architecture.chapters) {
    children.push(new Paragraph({
      children: [new TextRun({ text: `Chapter ${ch.number}`, size: 20, color: "64748B", bold: true })],
      spacing: { before: 480, after: 60 }
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: sanitize(ch.title), bold: true, size: 32, color: "0F172A" })],
      spacing: { before: 0, after: 240 }
    }));
  }

  // Footer note
  children.push(
    bpDivider(),
    new Paragraph({
      children: [new TextRun({
        text: `Generated by Nonfiction AI Studio  ·  ${dateStr}  ·  ${architecture.chapters.length} chapters`,
        size: 18, color: "94A3B8", italics: true
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 }
    })
  );

  const doc = new Document({
    creator: "Nonfiction AI Studio",
    description: `Chapter Architecture Blueprint: ${bookTitle}`,
    title: `${bookTitle} — Chapter Architecture Blueprint`,
    styles: {
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          run: { size: 36, bold: true, color: "0F172A" },
          paragraph: { spacing: { before: 480, after: 160 }, pageBreakBefore: true }
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          run: { size: 26, bold: true, color: "334155" },
          paragraph: { spacing: { before: 240, after: 120 } }
        }
      ]
    },
    sections: [{ children }]
  });

  console.log("[Export] Blueprint DOCX built —", children.length, "paragraphs,", architecture.chapters.length, "chapters");
  return Packer.toBuffer(doc);
}

router.post("/blueprint", async (req, res) => {
  try {
    const { project } = req.body;
    if (!project || typeof project !== "object")
      return res.status(400).json({ error: "Missing project payload" });

    // Step 1: Generate chapter architecture via AI
    const architecture = await generateChapterArchitecture(project);

    // Step 2: Build DOCX with architecture
    const buf = await buildBlueprintDocx(project, architecture);

    const slug = (
      project?.bookDetails?.title ||
      project?.bookTitle?.selectedCard?.title ||
      project?.research?.bookTitle ||
      "project"
    ).replace(/[^a-z0-9]/gi, "-").toLowerCase();

    // Return architecture in header so frontend can save it to project state
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="project-blueprint.docx"`);
    res.setHeader("Access-Control-Expose-Headers", "X-Chapter-Architecture");
    res.setHeader("X-Chapter-Architecture", Buffer.from(JSON.stringify(architecture)).toString("base64"));
    return res.status(200).send(buf);
  } catch (error: any) {
    console.error("Blueprint export error:", error);
    return res.status(500).json({ error: error.message || "Failed to export blueprint" });
  }
});

export default router;
