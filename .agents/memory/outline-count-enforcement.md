---
name: Outline Count Enforcement
description: Why AI-generated outline items (sections/subsections) can silently ignore an exact requested count, and how to guarantee it.
---

## The bug pattern
A prompt asked the model to generate an exact number of items (e.g. subsections), but also contained an internal self-scoring instruction like:

> "Rate the section topic complexity 1-5: score 1-2 → generate 3, score 3 → generate 4, score 4-5 → generate 5"

The model followed the self-scoring rule instead of the caller-provided count, so a section explicitly assigned "3 subsections" upstream would come back with 4 whenever the model judged the topic complex — silently overriding a decision already made elsewhere in the pipeline.

**Why this matters:** any time one step computes a precise count/value (e.g. via scoring, ranking, or a fixed business rule) and passes it into a later generation step, the later prompt must not contain its own competing rule for deriving that same value. Two "sources of truth" for the same number in one pipeline is a bug waiting to happen.

## How to apply
1. In the prompt: state the required count as a hard, non-negotiable constraint ("You MUST generate EXACTLY N. Not N-1. Not N+1.") and remove any internal scoring/heuristic that could produce a different number.
2. In code: never trust the model's count alone. Use a retry loop (2-3 attempts, first with the full prompt, later attempts with a simplified fallback prompt) that only accepts results matching the exact count, and as a final safety net, hard-slice/pad the result server-side AND client-side to the exact requested length before it's used.
3. Apply the same enforcement on both the API route and the frontend consumer — defense in depth, since either layer could regress independently.

See `sectionGenerationPrompt`/`generate-sections` (exact section count) and `subsectionGenerationPrompt`/`generate-subsections` (exact subsection count) in the Nonfiction Studio outline pipeline for the reference implementation.
