import test from "node:test";
import assert from "node:assert/strict";
import { normalizePdfPunctuation } from "./pdfText.js";

test("normalizes punctuation that built-in pdf-lib fonts cannot reliably encode", () => {
  assert.equal(
    normalizePdfPunctuation("A‑B “quoted” … x\u202Fy"),
    "A-B \"quoted\" ... x y"
  );
});
