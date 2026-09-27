import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCitationReadyProject,
  buildCitationRegistry,
  buildPrecisionEvidenceAudit,
  buildPrecisionUsedSourceList,
  buildPublicationConsistencyReport,
  pruneStaleSourceEvidence,
} from "./publicationEvidence.js";

const sourceA = {
  id: "src-a",
  originalName: "focus.pdf",
  referenceAnalysis: {
    title: "Focused Work",
    author: "Ada Author",
    publicationYear: "2024",
    publisher: "Example Press"
  }
};

const supportedEvidence = {
  evidenceId: "ev-focus",
  sourceId: "src-a",
  sourceTitle: "Focused Work",
  sourceAuthor: "Ada Author",
  title: "Retention study",
  text: "A controlled study found focused practice improved retention by 25 percent.",
  pages: [12],
  pageLabel: "PDF p.12"
};

test("stale evidence is pruned after a section is rewritten away from the source", () => {
  const result = pruneStaleSourceEvidence(
    "This section is now entirely about budgeting cash flow and invoice timing for small businesses.",
    [supportedEvidence]
  );
  assert.equal(result.active.length, 0);
  assert.equal(result.stale.length, 1);
});

test("precision audit excludes stale source usage from final references", () => {
  const project = {
    resources: { files: [sourceA], links: [] },
    lessons: {
      one: {
        targetSubsectionTitle: "Rewritten section",
        prose: "This section is now entirely about budgeting cash flow and invoice timing for small businesses.",
        sourceEvidence: [supportedEvidence]
      }
    }
  };

  const audit = buildPrecisionEvidenceAudit(project.lessons);
  assert.equal(audit.staleEvidenceCount, 1);
  assert.deepEqual(audit.usedSourceIds, []);
  assert.deepEqual(buildPrecisionUsedSourceList(project), []);
});

test("citation-ready export inserts verified numbered markers and reference lines", () => {
  const project = {
    resources: { files: [sourceA], links: [] },
    bookOutline: { references: { id: "refs", title: "References" } },
    lessons: {
      body: {
        targetSubsectionTitle: "Practice",
        prose: "A controlled study found that focused practice improved retention by 25%. Apply the principle deliberately.",
        sourceEvidence: [supportedEvidence]
      },
      refs: {
        targetSubsectionTitle: "References",
        prose: ""
      }
    }
  };

  const registry = buildCitationRegistry(project);
  assert.equal(registry.sources.length, 1);
  assert.equal(registry.sources[0].numberedLabel, "[1]");

  const cited = buildCitationReadyProject(project, "numbered");
  assert.match(cited.lessons.body.prose, /\[1\]/);
  assert.match(cited.lessons.refs.prose, /^\[1\]/);
  assert.match(cited.lessons.refs.prose, /Focused Work/);
});

test("publication consistency identifies manuscript and cover metadata mismatches", () => {
  const project = {
    bookDetails: { title: "Manuscript Title", subtitle: "A Guide" },
    authorBio: { authorName: "Ada Author" },
    bookCover: {
      coverStudio: {
        metadata: {
          title: "Different Cover Title",
          subtitle: "A Guide",
          author: "Ada Author",
          primaryCategory: "Business & Money"
        }
      }
    },
    bookMarketing: { keywords: "focus, attention" }
  };

  const report = buildPublicationConsistencyReport(project, { trimSize: "6x9" }, "author-year");
  assert.ok(report.checks.some((check) => check.id === "title" && check.status === "review"));
  assert.ok(report.checks.some((check) => check.id === "subtitle" && check.status === "pass"));
  assert.ok(report.checks.some((check) => check.id === "citation-style" && check.status === "pass"));
});
