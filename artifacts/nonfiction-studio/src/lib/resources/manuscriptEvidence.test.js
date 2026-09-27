import test from "node:test";
import assert from "node:assert/strict";
import {
  buildManuscriptEvidenceAudit,
  buildPublishingPreflight,
  buildUsedVerifiedSourceList,
} from "./manuscriptEvidence.js";

const sourceA = {
  id: "src-a",
  originalName: "focus.pdf",
  referenceAnalysis: {
    title: "Focused Work",
    author: "A. Author",
    claims: [{ claim: "Focused practice improves retention by 25 percent.", pages: [12] }]
  }
};

test("evidence audit tracks section coverage and flags unsupported claim signals", () => {
  const lessons = {
    a: {
      targetSubsectionTitle: "Supported",
      prose: "A controlled study found that focused practice improved retention by 25%. This is useful in deliberate practice.",
      sourceEvidence: [{
        sourceId: "src-a",
        sourceTitle: "Focused Work",
        title: "Retention study",
        text: "A controlled study found focused practice improved retention by 25 percent.",
        pages: [12],
        pageLabel: "PDF p.12"
      }]
    },
    b: {
      targetSubsectionTitle: "Needs review",
      prose: "A recent survey found that 72% of professionals abandon their goals within a month. Use a smaller weekly target instead.",
      sourceEvidence: []
    }
  };

  const audit = buildManuscriptEvidenceAudit(lessons);
  assert.equal(audit.draftedSections, 2);
  assert.equal(audit.sectionsWithEvidence, 1);
  assert.equal(audit.coveragePercent, 50);
  assert.ok(audit.supportedClaimCount >= 1);
  assert.ok(audit.unsupportedClaimCount >= 1);
  assert.equal(audit.usedSourceIds[0], "src-a");
});

test("used verified source list excludes indexed references never used by a lesson", () => {
  const project = {
    resources: {
      files: [
        sourceA,
        {
          id: "src-b",
          originalName: "unused.pdf",
          referenceAnalysis: { title: "Unused Book", author: "B. Author" }
        }
      ],
      links: []
    },
    lessons: {
      one: {
        prose: "Research shows a useful pattern for focused practice in this section.",
        sourceEvidence: [{ sourceId: "src-a", sourceTitle: "Focused Work", text: "Useful pattern." }]
      }
    }
  };

  const refs = buildUsedVerifiedSourceList(project);
  assert.deepEqual(refs.map((ref) => ref.id), ["src-a"]);
});

test("publishing preflight reports blockers and evidence warnings deterministically", () => {
  const project = {
    bookDetails: { title: "My Book", authorName: "Writer" },
    bookCover: { title: "Different Cover Title" },
    resources: { files: [sourceA] },
    lessons: {
      one: {
        targetSubsectionTitle: "Chapter section",
        prose: "Research found that 80% of participants improved within two weeks.",
        sourceEvidence: []
      }
    }
  };

  const audit = buildManuscriptEvidenceAudit(project.lessons);
  const preflight = buildPublishingPreflight({
    project,
    settings: { trimSize: "6x9" },
    evidenceAudit: audit,
    referenceSafety: { risk: "low", matches: [] },
    wordCount: 12,
    sectionCount: 1,
  });

  assert.equal(preflight.blockingCount, 0);
  assert.ok(preflight.warningCount >= 2);
  assert.equal(preflight.status, "review");
  assert.ok(preflight.checks.some((check) => check.id === "title-consistency" && check.status === "warn"));
  assert.ok(preflight.checks.some((check) => check.id === "claim-review" && check.status === "warn"));
});
