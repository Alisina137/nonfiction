# Cover Studio Sidebar Workflow

The Cover Studio sidebar is a decision workflow. Every item must answer four questions:

1. What design problem is this tool solving?
2. Why does that problem matter for this book?
3. What action can the author take here?
4. What observable result marks the tool as complete?

The workflow is intentionally not a rigid wizard. Authors can move between tools, but each tool owns one cover-design decision.

| Tool | Goal | Main functionality | Completion target |
| --- | --- | --- | --- |
| Market | Identify category visual expectations and differentiation opportunities. | AI market analysis from category, audience, language and book metadata; regenerate when inputs change. | Market cover brief exists with cover goal, patterns, risks and differentiation direction. |
| Strategy | Decide what the cover must communicate in one glance. | AI cover strategy built from the book promise plus market analysis. | Cover purpose, emotional tone, visual focus, primary message and personality are defined. |
| Mood | Choose the emotional atmosphere before styling details. | AI mood-board generation, regeneration and explicit selection. | One mood board is intentionally selected. |
| Colors | Select a genre-appropriate palette with strong title contrast. | AI palette generation, per-palette regeneration and explicit selection. | One palette is selected with background, primary, secondary and accent roles. |
| Elements | Define the dominant visual idea and control clutter. | AI design-element plan; regenerate; remove unnecessary supporting elements; show focal point, complexity and avoid list. | One focal point and coherent element plan exist. |
| Text | Make title hierarchy readable at Amazon thumbnail size. | AI typography intelligence plus manual typography inspector; Apply AI Typography maps recommendations into editable title alignment/font/relative sizes. | Typography profile exists and a typography decision has been applied. |
| Layout | Arrange text and imagery into a deliberate composition. | AI layout analysis; Apply Layout Guidance maps explicit alignment/focal-area recommendations into live cover controls and enables safe guides. | Layout profile exists and layout guidance has been applied/reviewed on Canvas. |
| Generate | Convert approved decisions into multiple cover directions. | Generate four differentiated concepts from market, strategy, mood, palette and element inputs; regenerate individual concepts; select one. | Concepts exist and one direction is selected. |
| Review | Test concepts before committing. | AI review across readability, genre match, thumbnail visibility and related professional cover criteria; re-analyze as needed. | Generated concepts are reviewed and a final direction is intentional. |
| Canvas | Inspect and refine the actual selected design. | Front/Back/Full Cover preview, zoom, fit, safe/bleed guides, background workspace, text/image/background inspectors and variant filmstrip. | Selected concept is visually checked at full size and thumbnail-aware scale, with production guides reviewed. |
| Setup | Lock factual and production constraints. | Metadata editor, KDP print settings, page count, interior type, reading direction, spine/barcode configuration and production preflight. | Required metadata is present and preflight has no blocking issue. |

## Status model

Sidebar dots represent decision state:

- Gray: target not yet completed.
- Amber/pulsing: generation is running, or AI guidance exists but still needs author application/selection.
- Green: the decision target is complete.

Text and Layout deliberately do not become green merely because the AI generated advice. They become complete only after the guidance has been applied to the editable cover.

## Dependency flow

Recommended order:

```text
Setup
  ↓
Market
  ↓
Strategy
  ↓
Mood
  ↓
Colors
  ↓
Elements
  ↓
Generate
  ↓
Text + Layout
  ↓
Canvas
  ↓
Review
  ↓
Canvas final refinement
```

The app does not enforce this as a hard sequence because authors may iterate. Concept generation can still run with partial inputs, but better upstream decisions produce a more targeted prompt.

## Design principle

A sidebar item must not exist only for navigation. If an item cannot affect a cover decision, produce useful evidence, apply a recommendation, or verify an output, it should be removed or redesigned.
