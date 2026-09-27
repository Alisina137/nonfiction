import test from "node:test";
import assert from "node:assert/strict";
import {
  assessReferenceOverlap,
  buildReferenceEvidence,
  buildVerifiedSourceList,
  compactReferenceAnalyses,
  rerankReferenceEvidence
} from "./referenceIntelligence.js";

const resources = {
  files: [
    {
      id: "book-a",
      originalName: "book-a.pdf",
      priority: "high",
      referenceAnalysis: {
        title: "Focused Work",
        author: "A. Writer",
        publicationYear: "2024",
        overview: "A book about protecting attention.",
        concepts: [
          { name: "Attention residue", explanation: "Task switching leaves part of attention on the previous task.", pages: [42] }
        ],
        lessons: [
          { title: "Protect focus", lesson: "Reduce context switching during demanding work.", pages: [44, 45] }
        ],
        claims: [
          { claim: "Frequent task switching increases cognitive overhead.", evidence: "The author synthesizes attention research.", pages: [40, 41] }
        ],
        distinctivePhrases: [
          { text: "protect your attention before you protect your calendar", page: 47 }
        ]
      }
    }
  ],
  links: [{ id: "site-1", title: "Official Report", url: "https://example.com/report" }]
};

test("buildReferenceEvidence finds topic-relevant indexed evidence", () => {
  const result = buildReferenceEvidence(resources, "How can readers reduce task switching and protect focus?");
  assert.ok(result.items.length >= 1);
  assert.equal(result.items[0].sourceTitle, "Focused Work");
  assert.match(result.text, /PDF p/);
});

test("compactReferenceAnalyses keeps compact source metadata", () => {
  const compact = compactReferenceAnalyses(resources);
  assert.equal(compact.length, 1);
  assert.equal(compact[0].title, "Focused Work");
  assert.equal(compact[0].concepts.length, 1);
});

test("assessReferenceOverlap flags indexed verbatim phrases", () => {
  const result = assessReferenceOverlap(
    "A useful rule is to protect your attention before you protect your calendar when planning deep work.",
    resources
  );
  assert.equal(result.risk, "review");
  assert.equal(result.matches.length, 1);
});

test("buildVerifiedSourceList excludes invented AI competitor metadata", () => {
  const refs = buildVerifiedSourceList({
    resources,
    analysis: {
      books: [
        { title: "Verified", authors: "B. Author", source_provider: "open_library", url: "https://openlibrary.org/x" },
        { title: "Invented", authors: "AI", source_provider: "ai_research" }
      ]
    }
  });
  assert.ok(refs.some((r) => r.title === "Focused Work"));
  assert.ok(refs.some((r) => r.title === "Verified"));
  assert.ok(!refs.some((r) => r.title === "Invented"));
});


test("semantic rerank only reorders known evidence IDs", () => {
  const local = buildReferenceEvidence(resources, "attention focus task switching", {
    maxItems: 4,
    maxCandidates: 6,
    maxPerSource: 4,
    maxChars: 12000
  });
  assert.ok(local.items.length >= 2);
  assert.ok(local.items.every((item) => item.evidenceId));

  const preferred = local.items[1];
  const reranked = rerankReferenceEvidence(local, [
    { evidenceId: preferred.evidenceId, score: 0.99, reason: "Most directly relevant" },
    { evidenceId: "invented-id", score: 1, reason: "Must be ignored" },
    { evidenceId: local.items[0].evidenceId, score: 0.7, reason: "Secondary" }
  ], { maxItems: 3, maxPerSource: 3, maxChars: 9000 });

  assert.equal(reranked.items[0].evidenceId, preferred.evidenceId);
  assert.ok(!reranked.items.some((item) => item.evidenceId === "invented-id"));
  assert.equal(reranked.retrievalMode, "semantic-reranked");
});
