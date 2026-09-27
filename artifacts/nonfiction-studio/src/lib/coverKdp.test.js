import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePaperbackGeometry,
  estimateCoverPageCount,
  buildCoverPreflight,
} from "./coverKdp.js";

test("paperback geometry uses current KDP white-paper spine formula and bleed", () => {
  const g = calculatePaperbackGeometry({
    trimWidth: 6,
    trimHeight: 9,
    pageCount: 200,
    interiorId: "bw-white",
  });
  assert.equal(Number(g.spineWidth.toFixed(4)), 0.4504);
  assert.equal(Number(g.fullWidth.toFixed(4)), 12.7004);
  assert.equal(g.fullHeight, 9.25);
  assert.equal(g.pixels300.height, 2775);
  assert.equal(g.spineTextEligible, true);
});

test("cream paper uses the wider spine multiplier", () => {
  const white = calculatePaperbackGeometry({ trimWidth: 6, trimHeight: 9, pageCount: 200, interiorId: "bw-white" });
  const cream = calculatePaperbackGeometry({ trimWidth: 6, trimHeight: 9, pageCount: 200, interiorId: "bw-cream" });
  assert.ok(cream.spineWidth > white.spineWidth);
  assert.equal(Number(cream.spineWidth.toFixed(3)), 0.5);
});

test("spine text is disabled below 80 pages and RTL swaps front/back", () => {
  const g = calculatePaperbackGeometry({
    trimWidth: 6,
    trimHeight: 9,
    pageCount: 78,
    interiorId: "bw-white",
    readingDirection: "rtl",
  });
  assert.equal(g.spineTextEligible, false);
  assert.equal(g.frontX, 0.125);
  assert.ok(g.backX > g.frontX);
  assert.equal(g.barcode.side, "left");
});

test("page count estimator uses manuscript words when available", () => {
  const project = {
    lessons: {
      a: { prose: Array.from({ length: 1000 }, () => "word").join(" ") },
    },
  };
  assert.equal(estimateCoverPageCount(project), 24);
});

test("preflight warns when trim changes after concept generation", () => {
  const geometry = calculatePaperbackGeometry({ trimWidth: 6, trimHeight: 9, pageCount: 120 });
  const result = buildCoverPreflight({
    metadata: { title: "Book", author: "Writer", bookSize: '5.5" × 8.5"' },
    printSetup: { generatedTrim: '6" × 9" — Standard', spineText: true, barcodeMode: "kdp" },
    geometry,
    backCover: { blurb: "A useful blurb." },
    concepts: [{ label: "A" }],
    selectedConceptIndex: 0,
  });
  assert.ok(result.checks.some((check) => check.id === "trim-after-generation" && check.status === "review"));
});
