import test from "node:test";
import assert from "node:assert/strict";
import {
  buildKdpMetadataHandoff,
  buildPublicationFreezeRecord,
  canFreezePublication,
  compareProductionArchives,
  formatKdpMetadataHandoffText,
  normalizePreviewChecks,
  previewChecklistComplete,
} from "./releaseOperations.js";

const completePreview = normalizePreviewChecks({
  "interior-preview-opened": true,
  "trim-margins": true,
  "chapter-starts": true,
  "headers-pages": true,
  "blank-pages": true,
  "cover-spine": true,
});

test("archive comparison reports only changed production fields", () => {
  const diff = compareProductionArchives(
    {
      archiveId: "new",
      pageCount: 212,
      trimSize: "6x9",
      citationStyle: "apa7",
      productionStatus: "pass",
      epubStatus: "pass",
      coverDesignHash: "abc",
      fingerprintSha256: "new-fingerprint",
    },
    {
      archiveId: "old",
      pageCount: 208,
      trimSize: "6x9",
      citationStyle: "apa7",
      productionStatus: "review",
      epubStatus: "pass",
      coverDesignHash: "abc",
      fingerprintSha256: "old-fingerprint",
    }
  );

  assert.equal(diff.hasChanges, true);
  assert.ok(diff.changes.some((item) => item.field === "pageCount"));
  assert.ok(diff.changes.some((item) => item.field === "productionStatus"));
  assert.ok(!diff.changes.some((item) => item.field === "trimSize"));
});

test("required preview checklist gates publication freeze", () => {
  assert.equal(previewChecklistComplete(completePreview), true);
  assert.equal(previewChecklistComplete({ ...completePreview, "blank-pages": false }), false);

  const blocked = canFreezePublication({
    productionReport: { status: "pass", blocked: 0 },
    productionSnapshot: { archiveId: "archive-1" },
    previewChecks: { ...completePreview, "cover-spine": false },
  });
  assert.equal(blocked.ok, false);

  const ready = canFreezePublication({
    productionReport: { status: "pass", blocked: 0 },
    productionSnapshot: { archiveId: "archive-1" },
    previewChecks: completePreview,
  });
  assert.equal(ready.ok, true);
});

test("freeze record is bound to the reviewed production archive", () => {
  const record = buildPublicationFreezeRecord({
    productionReport: {
      status: "pass",
      blocked: 0,
      exactPageCount: 212,
      trim: { id: "6x9" },
      archiveManifest: { fingerprintSha256: "fingerprint" },
    },
    productionSnapshot: {
      archiveId: "archive-1",
      fingerprintSha256: "fingerprint",
      citationStyle: "apa7",
    },
    previewChecks: completePreview,
    citationStyle: "apa7",
  });

  assert.equal(record.frozen, true);
  assert.equal(record.archiveId, "archive-1");
  assert.equal(record.exactPageCount, 212);
  assert.equal(record.trimSize, "6x9");
  assert.equal(record.citationStyle, "apa7");
});

test("KDP handoff contains copy-ready metadata without performing an upload", () => {
  const project = {
    bookDetails: { title: "Focused Work", subtitle: "A Practical Guide" },
    authorBio: { authorName: "Ada Author" },
    description: { description: "A practical guide to focused work." },
    bookMarketing: { keywords: "focus, attention, productivity" },
    bookCover: {
      coverStudio: {
        metadata: {
          language: "English",
          primaryCategory: "Business & Money",
          secondaryCategory: "Self-Help",
        },
        finalExport: { exportedAt: "2026-09-28T00:00:00.000Z" },
      },
    },
  };

  const handoff = buildKdpMetadataHandoff(
    project,
    {
      exactPageCount: 212,
      status: "pass",
      trim: { id: "6x9" },
      epub: { status: "pass" },
    },
    "apa7"
  );

  assert.equal(handoff.book.title, "Focused Work");
  assert.equal(handoff.paperback.exactPageCount, 212);
  assert.deepEqual(handoff.listing.keywords, ["focus", "attention", "productivity"]);
  assert.equal(handoff.control.uploadsRemainManual, true);
  assert.match(formatKdpMetadataHandoffText(handoff), /Final KDP review and publication remain manual/);
});
