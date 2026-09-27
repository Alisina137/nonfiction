import test from "node:test";
import assert from "node:assert/strict";
import { normalizePdfPunctuation } from "./pdfText.js";

test("normalizes non-breaking hyphen and dash family for WinAnsi PDF fonts", () => {
  assert.equal(
    normalizePdfPunctuation("state‑of‑the‑art – practical — guide − 2026"),
    "state-of-the-art - practical -- guide - 2026"
  );
});

test("normalizes smart quotes, ellipsis, non-breaking spaces and invisible joiners", () => {
  assert.equal(
    normalizePdfPunctuation("“Don’t”\u2026 A\u00A0B\u202FC\u200BD"),
    "\"Don't\"... A B CD"
  );
});

test("keeps ordinary text and supported letters unchanged", () => {
  assert.equal(normalizePdfPunctuation("Café résumé — test"), "Café résumé -- test");
});
