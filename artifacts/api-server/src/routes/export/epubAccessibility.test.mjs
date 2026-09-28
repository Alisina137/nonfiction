import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEpubAccessibilityProfile,
  epubReadingDirection,
} from "./epubAccessibility.ts";

test("EPUB accessibility profile declares textual structural accessibility", () => {
  const profile = buildEpubAccessibilityProfile({
    language: "en",
    sectionCount: 8,
    navCount: 8,
    hasImages: false,
  });

  assert.equal(profile.direction, "ltr");
  assert.ok(profile.metadata.some((item) => item.property === "schema:accessMode" && item.value === "textual"));
  assert.ok(profile.checks.some((item) => item.id === "epub-structural-navigation" && item.status === "pass"));
  assert.ok(profile.checks.some((item) => item.id === "epub-text-alternatives" && item.status === "pass"));
});

test("RTL languages receive RTL reading direction", () => {
  assert.equal(epubReadingDirection("fa"), "rtl");
  assert.equal(epubReadingDirection("ar-AE"), "rtl");
  assert.equal(epubReadingDirection("en"), "ltr");
});

test("navigation mismatch is blocking", () => {
  const profile = buildEpubAccessibilityProfile({
    language: "en",
    sectionCount: 8,
    navCount: 7,
  });

  assert.ok(profile.checks.some((item) => item.id === "epub-structural-navigation" && item.status === "block"));
});
