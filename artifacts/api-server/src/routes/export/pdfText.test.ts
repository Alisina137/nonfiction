import test from "node:test";
import assert from "node:assert/strict";
import { normalizePdfPunctuation } from "./pdfText.ts";

test("normalizes non-breaking hyphen and dash family for WinAnsi PDF fonts", () => {
  assert.equal(
    normalizePdfPunctuation("state‑of‑the‑art – practical — guide − 2026"),
    "state-of-the-art - practical -- guide - 2026"
  );
});

test("normalizes smart quotes, ellipsis, non-breaking spaces and invisible joiners", () => {
  assert.equal(
    normalizePdfPunctuation("“Don’t”… A\u00A0B\u202FC\u200BD"),
    "\"Don't\"... A B CD"
  );
});

test("keeps ordinary text and supported accented letters unchanged", () => {
  assert.equal(normalizePdfPunctuation("Café résumé — test"), "Café résumé -- test");
});


test("normalizes common AI symbols that built-in TimesRoman cannot encode", () => {
  assert.equal(
    normalizePdfPunctuation("A → B ✓ if x ≤ y and y ≠ z"),
    "A -> B OK if x <= y and y != z"
  );
});
