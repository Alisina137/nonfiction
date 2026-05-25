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
  SectionType,
  NumberFormat,
  convertInchesToTwip
} from "docx";

const router = Router();

// ─── Presets ──────────────────────────────────────────────────────────────────
//
// kdp_pro is the default "KDP Professional Nonfiction" style.
// thesis and academic are kept for academic authors.
// kdp is kept as a gutter-margin print variant.
// nonfiction and novel have been removed per spec.

const PRESETS: Record<string, any> = {
  kdp_pro: {
    name: "KDP Professional Nonfiction",
    pageW: 432, pageH: 648,                          // 6×9 inches
    mTop: 63,  mBot: 54, mLeft: 63, mRight: 54,      // KDP-compliant margins
    titleSz: 28, chapterSz: 20, sectionSz: 16, subsectionSz: 14, bodySz: 12,
    lineH: 14,   // 12pt × 1.15 ≈ 13.8 → 14
    paraGap: 8, indent: 18,                           // small first-para indent
    chapterPrefix: "Chapter",
    docxBody: "Times New Roman", docxHead: "Times New Roman",
    docxMLeft: 1260, docxMRight: 1080, docxMTop: 1260, docxMBot: 1080,
    docxLineSpacing: 276,                             // 240 × 1.15
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
    .replace(/[^\x00-\x7E]/g, (c) => { try { return c; } catch { return "?"; } });
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
    const lines = rawPara.split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const bulletM = t.match(/^[•\-\*]\s+(.+)/);
      const numM    = t.match(/^(\d+)[.)]\s+(.+)/);
      if (bulletM) {
        blocks.push({ kind: "bullet",   text: bulletM[1] });
      } else if (numM) {
        blocks.push({ kind: "numbered", text: numM[2], num: parseInt(numM[1], 10) });
      } else {
        blocks.push({ kind: "para",     text: t });
      }
    }
  }
  return blocks;
}

// ─── Outline hierarchy ────────────────────────────────────────────────────────

interface HChapter { chNum: number; title: string; sections: HSection[] }
interface HSection  { secNum: number; title: string; id: string; subsections: HSubsection[] }
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

function toRoman(n: number): string {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ["m","cm","d","cd","c","xc","l","xl","x","ix","v","iv","i"];
  let r = "";
  for (let i = 0; i < vals.length; i++) { while (n >= vals[i]) { r += syms[i]; n -= vals[i]; } }
  return r;
}

async function buildBookPdf(project: any, options: any = {}): Promise<Uint8Array> {
  const P = PRESETS[options.preset] || PRESETS.kdp_pro;
  const pdf = await PDFDocument.create();

  const regularFont = await pdf.embedFont(P.useTimesRoman ? StandardFonts.TimesRoman     : StandardFonts.Helvetica);
  const boldFont    = await pdf.embedFont(P.useTimesRoman ? StandardFonts.TimesBold       : StandardFonts.HelveticaBold);
  const italicFont  = await pdf.embedFont(P.useTimesRoman ? StandardFonts.TimesRomanItalic: StandardFonts.HelveticaOblique);

  const bookTitle   = sanitize(resolveBookTitle(project));
  const subtitle    = sanitize(project?.bookCover?.subtitle || project?.bookDetails?.subtitle || "");
  const bookTopic   = sanitize(
    project?.research?.bookTopic || project?.bookDetails?.bookTopic ||
    project?.research?.subNiche  || project?.research?.niche || ""
  );
  const tagline     = sanitize(project?.bookCover?.tagline || "");
  const author      = sanitize(resolveAuthorName(project));
  const description = sanitize(project?.description?.description || project?.description || "");
  const authorBio   = sanitize(
    project?.authorBio?.bio || project?.authorBio?.background || ""
  );
  const dedication      = sanitize(options.dedication || "");
  const acknowledgments = sanitize(options.acknowledgments || "");
  const preface         = sanitize(options.preface || "");

  const W = P.pageW, H = P.pageH;
  const ML = P.mLeft, MR = P.mRight, MT = P.mTop, MB = P.mBot;
  const textW = W - ML - MR;
  const BODY = P.bodySz, LH = P.lineH, PG = P.paraGap;

  const black      = rgb(0,    0,    0);
  const darkGray   = rgb(0.15, 0.15, 0.15);
  const midGray    = rgb(0.35, 0.35, 0.35);
  const lightGray  = rgb(0.6,  0.6,  0.6);
  const accentColor = rgb(0.12, 0.25, 0.55);

  const tocEntries: { label: string; pageNum: number; level: number }[] = [];
  let arabicPageNum = 0;

  function newPage(): PDFPage { return pdf.addPage([W, H]); }

  function drawHeader(page: PDFPage, chLabel: string, pageN: number, isRoman = false) {
    const num = isRoman ? toRoman(pageN) : String(pageN);
    const headerY = H - MT + 22;
    const footerY = MB - 18;

    page.drawLine({ start: { x: ML, y: headerY - 3 }, end: { x: W - MR, y: headerY - 3 }, thickness: 0.4, color: lightGray });
    page.drawText(bookTitle.slice(0, 48), { x: ML, y: headerY + 3, size: 7, font: italicFont, color: lightGray });
    if (chLabel) {
      const cw = italicFont.widthOfTextAtSize(chLabel.slice(0, 40), 7);
      page.drawText(chLabel.slice(0, 40), { x: W - MR - cw, y: headerY + 3, size: 7, font: italicFont, color: lightGray });
    }

    page.drawLine({ start: { x: ML, y: footerY + 3 }, end: { x: W - MR, y: footerY + 3 }, thickness: 0.4, color: lightGray });
    const pw = regularFont.widthOfTextAtSize(num, 8);
    page.drawText(num, { x: ML + textW / 2 - pw / 2, y: footerY - 10, size: 8, font: regularFont, color: midGray });
  }

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  {
    const page = newPage();
    // Top accent bar
    page.drawRectangle({ x: ML, y: H - 42, width: textW, height: 5, color: accentColor });

    // Calculate title block height
    const titleLines = wrapTextPdf(bookTitle, boldFont, P.titleSz, textW);
    const titleBlockH = titleLines.length * (P.titleSz + 7);
    let y = H * 0.52 + titleBlockH / 2;

    // Title
    for (const line of titleLines) {
      const tw = boldFont.widthOfTextAtSize(line, P.titleSz);
      page.drawText(line, { x: ML + (textW - tw) / 2, y, size: P.titleSz, font: boldFont, color: black });
      y -= P.titleSz + 7;
    }

    // Rule
    y -= 14;
    page.drawRectangle({ x: ML + textW * 0.2, y, width: textW * 0.6, height: 1.5, color: accentColor });
    y -= 18;

    // Subtitle
    if (subtitle) {
      const subLines = wrapTextPdf(subtitle, italicFont, P.sectionSz, textW * 0.85);
      for (const sl of subLines) {
        const sw = italicFont.widthOfTextAtSize(sl, P.sectionSz);
        page.drawText(sl, { x: ML + (textW - sw) / 2, y, size: P.sectionSz, font: italicFont, color: darkGray });
        y -= P.sectionSz + 6;
      }
      y -= 8;
    }

    // Book topic / category
    if (bookTopic) {
      const topicLabel = bookTopic.slice(0, 60);
      const tw = regularFont.widthOfTextAtSize(topicLabel, BODY - 1);
      page.drawText(topicLabel, { x: ML + (textW - tw) / 2, y, size: BODY - 1, font: regularFont, color: midGray });
      y -= BODY + 8;
    }

    // Tagline
    if (tagline) {
      const tl = tagline.slice(0, 80);
      const tw = italicFont.widthOfTextAtSize(tl, BODY);
      page.drawText(tl, { x: ML + (textW - tw) / 2, y, size: BODY, font: italicFont, color: midGray });
    }

    // Author (fixed position near bottom)
    const byLine = `by ${author}`;
    const aw = regularFont.widthOfTextAtSize(byLine, 13);
    page.drawText(byLine, { x: ML + (textW - aw) / 2, y: H * 0.19, size: 13, font: regularFont, color: darkGray });

    // Bottom accent bar
    page.drawRectangle({ x: ML, y: 34, width: textW, height: 5, color: accentColor });
  }

  let romanPage = 1;

  // ── COPYRIGHT PAGE ──────────────────────────────────────────────────────────
  {
    romanPage++;
    const page = newPage();
    const year = new Date().getFullYear();
    let y = H * 0.35;
    const copyrightText = [
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
    for (const line of copyrightText) {
      if (!line) { y -= BODY; continue; }
      const w = regularFont.widthOfTextAtSize(line, BODY - 1);
      page.drawText(line, { x: ML + (textW - w) / 2, y, size: BODY - 1, font: regularFont, color: midGray });
      y -= LH;
    }
  }

  // ── DEDICATION ──────────────────────────────────────────────────────────────
  if (dedication) {
    romanPage++;
    const page = newPage();
    drawHeader(page, "Dedication", romanPage, true);
    const dlines = wrapTextPdf(dedication, italicFont, 13, textW * 0.7);
    let y = H * 0.5 + (dlines.length * 20) / 2;
    for (const dl of dlines) {
      const dw = italicFont.widthOfTextAtSize(dl, 13);
      page.drawText(dl, { x: ML + (textW - dw) / 2, y, size: 13, font: italicFont, color: midGray });
      y -= 22;
    }
  }

  // ── ACKNOWLEDGMENTS ──────────────────────────────────────────────────────────
  if (acknowledgments) {
    romanPage++;
    const page = newPage();
    drawHeader(page, "Acknowledgments", romanPage, true);
    let y = H - MT - 10;
    page.drawText("Acknowledgments", { x: ML, y, size: P.chapterSz, font: boldFont, color: black });
    y -= P.chapterSz + 24;
    for (const line of wrapTextPdf(acknowledgments, regularFont, BODY, textW)) {
      if (!line) { y -= PG; continue; }
      if (y < MB + 20) { y = H - MT - 10; }
      page.drawText(line, { x: ML, y, size: BODY, font: regularFont, color: black });
      y -= LH;
    }
  }

  // ── TABLE OF CONTENTS (placeholder) ─────────────────────────────────────────
  romanPage++;
  const tocPage1 = newPage();
  drawHeader(tocPage1, "Contents", romanPage, true);
  tocPage1.drawText("Contents", { x: ML, y: H - MT - 10, size: P.chapterSz, font: boldFont, color: black });
  tocPage1.drawRectangle({ x: ML, y: H - MT - 10 - P.chapterSz - 12, width: 40, height: 2, color: accentColor });

  // ── PREFACE ──────────────────────────────────────────────────────────────────
  if (preface) {
    romanPage++;
    const page = newPage();
    drawHeader(page, "Preface", romanPage, true);
    let y = H - MT - 10;
    page.drawText("Preface", { x: ML, y, size: P.chapterSz, font: boldFont, color: black });
    y -= P.chapterSz + 24;
    for (const line of wrapTextPdf(preface, regularFont, BODY, textW)) {
      if (!line) { y -= PG; continue; }
      if (y < MB + 20) { y = H - MT - 10; }
      page.drawText(line, { x: ML, y, size: BODY, font: regularFont, color: black });
      y -= LH;
    }
  }

  // ── MAIN CONTENT ─────────────────────────────────────────────────────────────
  const lessons = project?.lessons && typeof project.lessons === "object" ? project.lessons : {};
  const hier    = buildHierarchy(project?.bookOutline);

  function drawChapterPage(chTitle: string, chNum: number): PDFPage {
    arabicPageNum++;
    const page = newPage();
    drawHeader(page, chNum > 0 ? `${P.chapterPrefix} ${chNum}` : "", arabicPageNum, false);

    let y = H - MT - 50;
    if (chNum > 0) {
      const prefixTxt = `${P.chapterPrefix} ${chNum}`;
      page.drawText(prefixTxt, { x: ML, y, size: 10, font: regularFont, color: accentColor });
      y -= 16;
    }
    const titleLines = wrapTextPdf(chTitle, boldFont, P.chapterSz, textW);
    for (const tl of titleLines) {
      page.drawText(sanitize(tl), { x: ML, y, size: P.chapterSz, font: boldFont, color: black });
      y -= P.chapterSz + 6;
    }
    y -= 6;
    page.drawRectangle({ x: ML, y, width: 48, height: 2, color: accentColor });
    return page;
  }

  // Draws body content, returns { page, y }
  // indentFirst=true → first regular paragraph gets P.indent; lists never get indent
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
        drawHeader(currentPage, chNum > 0 ? `${P.chapterPrefix} ${chNum}` : "", arabicPageNum, false);
        y = H - MT - 10;
      }
    }

    for (const block of blocks) {
      if (block.kind === "bullet") {
        firstPara = false;
        const bulletText = `\u2022  ${sanitize(block.text)}`;
        const lines = wrapTextPdf(bulletText, regularFont, BODY, textW - 18);
        ensureRoom(LH * lines.length + PG);
        for (const ln of lines) {
          currentPage.drawText(ln, { x: ML + 14, y, size: BODY, font: regularFont, color: black });
          y -= LH;
        }
        y -= 3;
      } else if (block.kind === "numbered") {
        firstPara = false;
        const numText = `${block.num}.  ${sanitize(block.text)}`;
        const lines = wrapTextPdf(numText, regularFont, BODY, textW - 18);
        ensureRoom(LH * lines.length + PG);
        for (const ln of lines) {
          currentPage.drawText(ln, { x: ML + 14, y, size: BODY, font: regularFont, color: black });
          y -= LH;
        }
        y -= 3;
      } else {
        // Regular paragraph
        const indent = firstPara ? P.indent : 0;
        firstPara = false;
        const lines = wrapTextPdf(sanitize(block.text), regularFont, BODY, textW - indent);
        ensureRoom(LH * lines.length + PG);
        for (const ln of lines) {
          currentPage.drawText(ln, { x: ML + indent, y, size: BODY, font: regularFont, color: black });
          y -= LH;
        }
        y -= PG;
      }
    }
    return { page: currentPage, y };
  }

  function contentStartY(): number {
    return H - MT - (P.chapterSz + 10) * 2 - 60;
  }

  // Introduction
  if (hier.introduction) {
    const prose = String(lessons[hier.introduction.id]?.prose || "").trim();
    if (prose) {
      tocEntries.push({ label: sanitize(hier.introduction.title), pageNum: arabicPageNum + 1, level: 0 });
      const page = drawChapterPage(sanitize(hier.introduction.title), 0);
      drawProseBlocks(page, parseProseBlocks(prose), contentStartY(), 0);
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
        const prose = String(lessons[sec.id]?.prose || "").trim();
        if (!prose) continue;

        if (!chPageStarted) {
          tocEntries.push({ label: sanitize(ch.title), pageNum: arabicPageNum + 1, level: 0 });
          chPageStarted = true;
          currentChPage = drawChapterPage(sanitize(ch.title), ch.chNum);
          chBodyY = contentStartY();
        }

        // Section heading
        if (chBodyY < MB + 80) {
          arabicPageNum++;
          currentChPage = newPage();
          drawHeader(currentChPage, `${P.chapterPrefix} ${ch.chNum}`, arabicPageNum, false);
          chBodyY = H - MT - 10;
        }
        tocEntries.push({ label: `${secLabel}  ${sanitize(sec.title)}`, pageNum: arabicPageNum, level: 1 });
        currentChPage!.drawText(`${secLabel}  ${sanitize(sec.title)}`, {
          x: ML, y: chBodyY, size: P.sectionSz, font: boldFont, color: black
        });
        chBodyY -= P.sectionSz + 16;

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
            tocEntries.push({ label: sanitize(ch.title), pageNum: arabicPageNum + 1, level: 0 });
            chPageStarted = true;
            currentChPage = drawChapterPage(sanitize(ch.title), ch.chNum);
            chBodyY = contentStartY();
          }

          if (!secStarted) {
            secStarted = true;
            if (chBodyY < MB + 80) {
              arabicPageNum++;
              currentChPage = newPage();
              drawHeader(currentChPage!, `${P.chapterPrefix} ${ch.chNum}`, arabicPageNum, false);
              chBodyY = H - MT - 10;
            }
            tocEntries.push({ label: `${secLabel}  ${sanitize(sec.title)}`, pageNum: arabicPageNum, level: 1 });
            currentChPage!.drawText(`${secLabel}  ${sanitize(sec.title)}`, {
              x: ML, y: chBodyY, size: P.sectionSz, font: boldFont, color: black
            });
            chBodyY -= P.sectionSz + 16;
          }

          // Subsection heading
          if (chBodyY < MB + 80) {
            arabicPageNum++;
            currentChPage = newPage();
            drawHeader(currentChPage!, `${P.chapterPrefix} ${ch.chNum}`, arabicPageNum, false);
            chBodyY = H - MT - 10;
          }
          tocEntries.push({ label: `${subLabel}  ${sanitize(sub.title)}`, pageNum: arabicPageNum, level: 2 });
          currentChPage!.drawText(`${subLabel}  ${sanitize(sub.title)}`, {
            x: ML, y: chBodyY, size: P.subsectionSz, font: boldFont, color: midGray
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
      tocEntries.push({ label: sanitize(hier.conclusion.title), pageNum: arabicPageNum + 1, level: 0 });
      const page = drawChapterPage(sanitize(hier.conclusion.title), 0);
      drawProseBlocks(page, parseProseBlocks(prose), contentStartY(), 0);
    }
  }

  // ── BACK MATTER: About the Author ────────────────────────────────────────────
  if (authorBio) {
    arabicPageNum++;
    const page = newPage();
    drawHeader(page, "About the Author", arabicPageNum, false);
    let y = H - MT - 10;
    page.drawText("About the Author", { x: ML, y, size: P.chapterSz, font: boldFont, color: black });
    y -= P.chapterSz + 6;
    page.drawRectangle({ x: ML, y, width: 48, height: 2, color: accentColor });
    y -= 24;
    drawProseBlocks(page, parseProseBlocks(authorBio), y, 0, false);
  }

  // ── PASS 2: Fill TOC ─────────────────────────────────────────────────────────
  {
    const lineSteps   = [20, 17, 14];
    const fontSizes   = [11, 9.5, 8.5];
    const fontWeights = [boldFont, regularFont, regularFont];
    const indents     = [0, 14, 28];

    // We may need multiple TOC pages; only one was pre-allocated.
    // Render into the pre-allocated page; overflow is clipped (rare for most books).
    let ty = H - MT - 10 - P.chapterSz - 36;

    for (const entry of tocEntries) {
      if (ty < MB + 20) break;
      const level = Math.min(entry.level, 2);
      const font  = fontWeights[level];
      const sz    = fontSizes[level];
      const x     = ML + indents[level];
      const label = entry.label.trim().slice(0, 65);
      const pg    = String(entry.pageNum);
      const pgW   = regularFont.widthOfTextAtSize(pg, sz);

      tocPage1.drawText(label, { x, y: ty, size: sz, font, color: level === 0 ? black : midGray });
      tocPage1.drawText(pg, { x: W - MR - pgW, y: ty, size: sz, font: regularFont, color: midGray });

      // Dot leader
      const labelEnd = x + font.widthOfTextAtSize(label, sz) + 4;
      const pgStart  = W - MR - pgW - 4;
      if (pgStart > labelEnd + 8) {
        const dotCount = Math.floor((pgStart - labelEnd) / 4.5);
        let dx = labelEnd;
        for (let d = 0; d < dotCount; d++) {
          tocPage1.drawText(".", { x: dx, y: ty, size: sz, font: regularFont, color: rgb(0.75, 0.75, 0.75) });
          dx += 4.5;
        }
      }
      ty -= lineSteps[level] + (level === 0 ? 3 : 0);
    }
  }

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

  const bodyFont = P.docxBody;
  const headFont = P.docxHead;
  const LINE     = P.docxLineSpacing ?? 276;
  const HALF_PT  = (pt: number) => pt * 2;   // half-points

  // ── Paragraph factories ────────────────────────────────────────────────────

  function coverTitlePara(text: string): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text, font: headFont, size: HALF_PT(P.titleSz), bold: true, color: "000000" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 3600, after: 200 }
    });
  }

  function coverSubtitlePara(text: string): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text, font: headFont, size: HALF_PT(P.sectionSz), italics: true, color: "333333" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 160 }
    });
  }

  function coverTopicPara(text: string): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text, font: bodyFont, size: HALF_PT(P.bodySz), color: "555555" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 80 }
    });
  }

  function coverAuthorPara(text: string): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text, font: bodyFont, size: HALF_PT(14), color: "333333" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 1200, after: 3000 }
    });
  }

  function bodyPara(text: string, firstPara = false): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text, font: bodyFont, size: HALF_PT(P.bodySz), color: "000000" })],
      alignment: AlignmentType.BOTH,
      indent: { firstLine: firstPara && P.indent > 0 ? convertInchesToTwip(P.indent / 72) : 0 },
      spacing: { before: firstPara ? 0 : 80, after: 80, line: LINE, lineRule: "auto" as any }
    });
  }

  function bulletPara(text: string): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text: `\u2022\u2002${text}`, font: bodyFont, size: HALF_PT(P.bodySz), color: "000000" })],
      alignment: AlignmentType.LEFT,
      indent: { left: convertInchesToTwip(0.25), firstLine: 0 },
      spacing: { before: 60, after: 60, line: LINE, lineRule: "auto" as any }
    });
  }

  function numberedPara(num: number, text: string): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text: `${num}.\u2002${text}`, font: bodyFont, size: HALF_PT(P.bodySz), color: "000000" })],
      alignment: AlignmentType.LEFT,
      indent: { left: convertInchesToTwip(0.25), firstLine: 0 },
      spacing: { before: 60, after: 60, line: LINE, lineRule: "auto" as any }
    });
  }

  function headingPara(text: string, level: HeadingLevel, extra?: any): Paragraph {
    return new Paragraph({ text, heading: level, spacing: { before: 320, after: 160 }, ...extra });
  }

  function pageBreak(): Paragraph {
    return new Paragraph({ children: [new TextRun({ break: 1 } as any)], spacing: { before: 0, after: 0 } });
  }

  function smallRule(): Paragraph {
    return new Paragraph({ children: [], spacing: { before: 0, after: 120 },
      border: { bottom: { color: "AAAAAA", space: 1, style: "single", size: 4 } }
    });
  }

  // Adds parsed prose blocks to a children array
  function addProseBlocks(children: Paragraph[], prose: string) {
    const blocks = parseProseBlocks(prose);
    let isFirst = true;
    for (const block of blocks) {
      if (block.kind === "bullet") {
        isFirst = false;
        children.push(bulletPara(block.text));
      } else if (block.kind === "numbered") {
        isFirst = false;
        children.push(numberedPara(block.num, block.text));
      } else {
        children.push(bodyPara(block.text, isFirst));
        isFirst = false;
      }
    }
  }

  // ── Front matter ──────────────────────────────────────────────────────────

  const frontChildren: Paragraph[] = [];

  // Cover page
  frontChildren.push(coverTitlePara(bookTitle));
  frontChildren.push(smallRule());
  if (subtitle)    frontChildren.push(coverSubtitlePara(subtitle));
  if (bookTopic)   frontChildren.push(coverTopicPara(bookTopic));
  frontChildren.push(coverAuthorPara(`by ${author}`));
  frontChildren.push(pageBreak());

  // Copyright page
  const year = new Date().getFullYear();
  frontChildren.push(
    new Paragraph({
      children: [new TextRun({ text: `Copyright © ${year} ${author}`, font: bodyFont, size: HALF_PT(P.bodySz), color: "333333" })],
      alignment: AlignmentType.CENTER, spacing: { before: 3600, after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: "All rights reserved.", font: bodyFont, size: HALF_PT(P.bodySz), color: "555555" })],
      alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 }
    }),
    new Paragraph({
      children: [new TextRun({
        text: "No part of this publication may be reproduced, distributed, or transmitted in any form or by any means without the prior written permission of the author.",
        font: bodyFont, size: HALF_PT(P.bodySz - 1), color: "777777"
      })],
      alignment: AlignmentType.CENTER, spacing: { before: 240, after: 3000 }
    }),
    pageBreak()
  );

  // Dedication
  if (dedication) {
    frontChildren.push(
      new Paragraph({
        children: [new TextRun({ text: dedication, font: bodyFont, size: HALF_PT(13), italics: true, color: "333333" })],
        alignment: AlignmentType.CENTER, spacing: { before: 3000, after: 3000 }
      }),
      pageBreak()
    );
  }

  // Acknowledgments
  if (acknowledgments) {
    frontChildren.push(headingPara("Acknowledgments", HeadingLevel.HEADING_1));
    addProseBlocks(frontChildren, acknowledgments);
    frontChildren.push(pageBreak());
  }

  // Table of Contents (Word auto-generates page numbers on open)
  frontChildren.push(
    new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" } as any),
    pageBreak()
  );

  // Preface
  if (preface) {
    frontChildren.push(headingPara("Preface", HeadingLevel.HEADING_1));
    addProseBlocks(frontChildren, preface);
    frontChildren.push(pageBreak());
  }

  // ── Main content ──────────────────────────────────────────────────────────

  const mainChildren: Paragraph[] = [];

  // Introduction
  if (hier.introduction) {
    const prose = String(lessons[hier.introduction.id]?.prose || "").trim();
    if (prose) {
      mainChildren.push(headingPara(hier.introduction.title, HeadingLevel.HEADING_1, { pageBreakBefore: false }));
      addProseBlocks(mainChildren, prose);
    }
  }

  // Chapters
  let firstChapter = true;
  for (const ch of hier.chapters) {
    let hasContent = false;
    const chChildren: Paragraph[] = [];

    // Chapter heading — "Chapter N\nTitle"
    chChildren.push(headingPara(`${P.chapterPrefix} ${ch.chNum}`, HeadingLevel.HEADING_1, { pageBreakBefore: !firstChapter }));
    chChildren.push(headingPara(ch.title, HeadingLevel.HEADING_2));

    for (const sec of ch.sections) {
      const secLabel = `${ch.chNum}.${sec.secNum}\u2003${sec.title}`;
      if (sec.subsections.length === 0) {
        const prose = String(lessons[sec.id]?.prose || "").trim();
        if (!prose) continue;
        hasContent = true;
        chChildren.push(headingPara(secLabel, HeadingLevel.HEADING_3));
        addProseBlocks(chChildren, prose);
      } else {
        let secAdded = false;
        for (const sub of sec.subsections) {
          const subLabel = `${ch.chNum}.${sec.secNum}.${sub.subNum}\u2003${sub.title}`;
          const prose = String(lessons[sub.id]?.prose || "").trim();
          if (!prose) continue;
          hasContent = true;
          if (!secAdded) {
            chChildren.push(headingPara(secLabel, HeadingLevel.HEADING_3));
            secAdded = true;
          }
          chChildren.push(headingPara(subLabel, HeadingLevel.HEADING_4 as any));
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
      mainChildren.push(headingPara(hier.conclusion.title, HeadingLevel.HEADING_1, { pageBreakBefore: true }));
      addProseBlocks(mainChildren, prose);
    }
  }

  // About the Author (back matter)
  if (authorBio) {
    mainChildren.push(headingPara("About the Author", HeadingLevel.HEADING_1, { pageBreakBefore: true }));
    addProseBlocks(mainChildren, authorBio);
  }

  // ── DOCX document ──────────────────────────────────────────────────────────

  const runningHeader = new Header({
    children: [new Paragraph({
      children: [new TextRun({ text: bookTitle.slice(0, 60), font: bodyFont, size: HALF_PT(8), italics: true, color: "888888" })],
      alignment: AlignmentType.RIGHT,
      border: { bottom: { color: "CCCCCC", space: 1, style: "single", size: 4 } }
    })]
  });

  const runningFooter = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ children: [PageNumber.CURRENT], font: bodyFont, size: HALF_PT(8), color: "888888" })
      ],
      border: { top: { color: "CCCCCC", space: 1, style: "single", size: 4 } }
    })]
  });

  const doc = new Document({
    creator: author,
    title: bookTitle,
    description: String(description).slice(0, 500),
    styles: {
      default: {
        document: {
          run: { font: bodyFont, size: HALF_PT(P.bodySz), color: "000000" },
          paragraph: { spacing: { line: LINE, lineRule: "auto" as any } }
        }
      },
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1",
          run: { font: headFont, size: HALF_PT(P.chapterSz), bold: true, color: "000000" },
          paragraph: { spacing: { before: 480, after: 240 } }
        },
        {
          id: "Heading2", name: "Heading 2",
          run: { font: headFont, size: HALF_PT(P.sectionSz), bold: true, color: "111111" },
          paragraph: { spacing: { before: 360, after: 180 } }
        },
        {
          id: "Heading3", name: "Heading 3",
          run: { font: headFont, size: HALF_PT(P.subsectionSz), bold: true, color: "222222" },
          paragraph: { spacing: { before: 280, after: 120 } }
        },
        {
          id: "Heading4", name: "Heading 4",
          run: { font: headFont, size: HALF_PT(P.subsectionSz - 1), bold: true, italics: true, color: "333333" },
          paragraph: { spacing: { before: 200, after: 80 } }
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
