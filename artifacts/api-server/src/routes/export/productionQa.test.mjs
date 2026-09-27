import test from "node:test";
import assert from "node:assert/strict";
import { buildFinalProductionReport, paperbackSpineWidth } from "./productionQa.ts";

const project = {
  bookDetails: { title: "Production Book" },
  authorBio: { authorName: "Ada Author" },
  bookCover: {
    selectedConceptIndex: 0,
    concepts: [{ label: "A" }],
    coverStudio: {
      metadata: { bookSize: '6" × 9" — Standard' },
      printSetup: {
        pageCount: 200,
        interiorId: "bw-white",
        spineText: true,
        barcodeMode: "kdp",
      },
      backCover: { blurb: "A useful back-cover description." },
    },
  },
};

test("final production report passes synced 6x9 paperback geometry", () => {
  const report = buildFinalProductionReport(project, { trimSize: "6x9" }, 200);
  assert.equal(report.exactPageCount, 200);
  assert.equal(report.cover.synced, true);
  assert.equal(report.blocked, 0);
  assert.ok(report.checks.some((c) => c.id === "cover-page-sync" && c.status === "pass"));
});

test("final production report flags estimated cover page count mismatch", () => {
  const stale = structuredClone(project);
  stale.bookCover.coverStudio.printSetup.pageCount = 180;
  const report = buildFinalProductionReport(stale, { trimSize: "6x9" }, 200);
  assert.equal(report.cover.synced, false);
  assert.ok(report.checks.some((c) => c.id === "cover-page-sync" && c.status === "review"));
});

test("KDP minimum inside margin changes with final pagination", () => {
  const report = buildFinalProductionReport(project, {
    trimSize: "6x9",
    marginsMode: "custom",
    customMargins: { top: 0.75, bottom: 0.75, inside: 0.4, outside: 0.5 },
  }, 200);
  assert.ok(report.checks.some((c) => c.id === "inside-margin" && c.status === "block"));
});

test("spine width uses final page count and paper multiplier", () => {
  assert.equal(Number(paperbackSpineWidth(200, "bw-white").toFixed(4)), 0.4504);
  assert.equal(Number(paperbackSpineWidth(200, "bw-cream").toFixed(3)), 0.5);
});
