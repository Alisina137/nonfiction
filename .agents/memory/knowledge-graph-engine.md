---
name: Knowledge Graph Engine
description: How the Prompt 11 Knowledge Graph & Concept Intelligence Engine is wired — delta storage, registry compilation, and prompt injection.
---

## Rule
The Knowledge Graph is INTERNAL — readers never see it. It is built progressively from lesson writes and injected into every subsequent write prompt to enforce conceptual consistency.

## Data Flow
1. AI writes a section → outputs `knowledgeGraphDelta` inside the lesson JSON
2. Delta stored automatically in `lesson.knowledgeGraphDelta` (no extra wiring needed — it's part of the AI's JSON output that gets stored with the lesson)
3. `buildKnowledgeGraphSummary(project)` in `knowledgeGraph.js` iterates all `lessons[id].lesson.knowledgeGraphDelta` entries and compiles the registry
4. `buildBookContext(project)` calls `buildKnowledgeGraphSummary` and adds `knowledgeGraph` to the context object
5. `lessonPrompt` reads `bookContext?.knowledgeGraph` and calls `buildKnowledgeGraphBlock(kg)` → injects the KNOWLEDGE GRAPH INTELLIGENCE block before covered-content / upcoming blocks

## Key Files
- `artifacts/nonfiction-studio/src/lib/knowledgeGraph.js` — `buildKnowledgeGraphSummary(project)` — the registry compiler
- `artifacts/nonfiction-studio/src/lib/bookContext.js` — imports and calls `buildKnowledgeGraphSummary`, adds result as `ctx.knowledgeGraph`
- `artifacts/api-server/src/routes/ai/prompts.ts` — `buildKnowledgeGraphBlock(kg)` helper + `knowledgeGraphBlock` variable in `lessonPrompt` + `knowledgeGraphDelta` in JSON output schema

## Six Rules Enforced in the Prompt Block
1. First Introduction Rule — define new concepts clearly, connect to reader goals
2. Reinforcement Rule — deepen known concepts, never redefine
3. Dependency Validation — introduce prerequisites before dependants
4. Contradiction Detection — verify consistency with established registry
5. Cross Reference Rule — max 1 natural cross-reference per section
6. Question Coverage — every concept must answer at least one reader question

## Delta Schema (output by AI per section)
```json
{
  "newConcepts": [{ "name", "definition", "difficulty", "importance", "category", "readerQuestion" }],
  "reinforcedConcepts": ["concept name"],
  "frameworks": [{ "name", "type", "purpose" }],
  "storiesUsed": [{ "type", "conceptTaught" }],
  "questionsAnswered": ["..."],
  "questionsRaised": ["..."],
  "definitionsEstablished": [{ "term", "definition" }]
}
```

## Registry Limits
- Max 50 concepts, 20 frameworks, 30 definitions, 15 open questions, 12 story types per compilation pass

**Why:** The spec requires the KG to be internal and automatically influence all writing. Storing deltas in the lesson object (where they're already persisted) and recompiling on each context build requires zero new state management or API changes.
