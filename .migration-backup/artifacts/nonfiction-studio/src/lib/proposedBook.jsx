const CREATE_NEW_PERSONA_ID = "__create_new__";

export function effectiveBookTitle(bookTitle) {
  if (!bookTitle) return "";
  return (bookTitle.customTitle || "").trim() || (bookTitle.pickedFromAi || "").trim();
}

function previewSentence(text, max = 520) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Local synthesis for the Proposed Book step (replace with AI later). */
export function buildSyntheticProposedBookContent(project, focusTags) {
  const tags = [...new Set(focusTags.map((t) => String(t || "").trim()).filter(Boolean))];
  const tagLine = tags.length ? tags.join(", ") : "your chosen focus pillars";
  const research = project?.research || {};
  const topic = (research.bookTopic || "").trim();
  const genre = (research.mainNicheLabel || research.genre || "nonfiction").trim();
  const standout = [(research.standout || "").trim(), (research.stanceOnTopic || "").trim()].filter(Boolean).join(" ");
  const audience = (research.targetAudience || "").trim() || research.generalAudience || "readers who need this solved";
  const tonesList = Array.isArray(research.authorTones)
    ? research.authorTones.filter(Boolean).join(", ")
    : "";
  const bt = effectiveBookTitle(project?.bookTitle);

  let titleOut = bt;
  if (!titleOut && topic) {
    titleOut = `${topic.charAt(0).toUpperCase() + topic.slice(1)}: A Structured ${genre} Playbook`;
  }
  if (!titleOut) titleOut = `Proposed nonfiction title (${tagLine.slice(0, 40)})`;
  titleOut = previewSentence(titleOut, 180);

  const books = project?.analysis?.books || [];
  const competitorTitles = books
    .map((b) => (b.title || b.name || "").trim())
    .filter(Boolean)
    .slice(0, 6);

  const ap = project?.authorPersona || {};
  const selId = ap.selectedId;
  const persona =
    selId && selId !== CREATE_NEW_PERSONA_ID
      ? (Array.isArray(ap.savedPersonas) ? ap.savedPersonas : []).find((p) => p.id === selId)
      : null;

  let proposedPersonaBody =
    persona?.generated?.summary ||
    [persona?.generated?.voice?.tone, persona?.generated?.voice?.mood, persona?.generated?.style?.sentenceStructure]
      .filter(Boolean)
      .join(" ");

  if (!proposedPersonaBody) {
    proposedPersonaBody = persona?.authorDescription || persona?.draft?.authorDescription || "";
  }
  if (!proposedPersonaBody.trim()) {
    proposedPersonaBody =
      tonesList ?
        `${tonesList} delivery with nonfiction clarity and reader-first scaffolding.`
      : "Warm, pragmatic guidance with short explanations, concrete examples, and a steady motivational cadence.";
  }

  const uspParts = [];
  uspParts.push(
    tags.length ?
      `The book organizes momentum around thematic pillars—${tagLine.toLowerCase()}—so each chapter reinforces a repeatable outcome.`
    : "Readers get a scaffolded progression from insight to repeatable practice, tuned to their real-world constraints."
  );
  if (topic) uspParts.push(`It solves for “${previewSentence(topic, 120)}” without fluff or encyclopedic filler.`);
  if (standout) uspParts.push(`Sharpest angle you defined: ${previewSentence(standout, 380)}`);

  const diffParagraphs = [];
  diffParagraphs.push(
    competitorTitles.length ?
      `Many titles beside ${competitorTitles.slice(0, 3).join("; ")} position the topic broadly. This manuscript tightens differentiation by aligning every section with your explicit focus lenses (${tagLine}), which keeps positioning legible online and inside the Kindle sample.`
    : `Compared with category defaults, your angle compresses vague advice into focus lenses (${tagLine}) so readers instantly know what promises you keep.`
  );
  diffParagraphs.push(
    standout ?
      previewSentence(
        `What makes it materially different on the shelf is consistency with your standout claim: ${standout}`,
        520
      )
    : "The outline resists commodity advice by forcing each unit of value to tie back to a named reader outcome—not a vibes-only promise."
  );
  if (tags.length) {
    diffParagraphs.push(
      `Your selected themes (${tagLine}) function as throughput metrics: pacing, anecdotes, frameworks, and calls-to-action are checked against whether they advance those promises.`
    );
  }

  const sellingBullets = [];
  sellingBullets.push(`Themes-to-chapters roadmap aligned to ${tagLine}.`);
  if (standout) sellingBullets.push(`Clear commercial hook anchored in ${previewSentence(standout, 220)}`);
  sellingBullets.push(
    competitorTitles.length ?
      `Bench-marked differentiation vs. bestsellers ${competitorTitles.slice(0, 4).join(", ")}`
    : "Differentiation articulated for Amazon browse and ad creative — not buried mid-manuscript."
  );
  sellingBullets.push(`${tonesList ? `${tonesList} voice` : "Plainspoken expertise"} packaged for skim-readers`);
  tags.slice(0, 8).forEach((t, i) => {
    if (i < 6) sellingBullets.push(`${t}: explicit promise woven into subtitles and checkpoints.`);
  });

  const proposedTone =
    tonesList ?
      `${tonesList}, edited for scan-friendly chapters and repeatable micro-scripts. Tags bend emphasis toward ${previewSentence(tagLine, 220)}.`
    : `Approachable nonfiction authority with humane pacing—calm reassurance, pragmatic next steps—and emphasis on ${tagLine}.`;

  return {
    title: titleOut,
    uniqueSellingProposition: uspParts.join("\n\n"),
    differentiation: diffParagraphs.join("\n\n"),
    keySellingPoints: sellingBullets.map((line) => `• ${line}`).join("\n"),
    proposedAudience: previewSentence(
      `${audience}. Ideal when they want progress without abandoning bandwidth; tone and examples should respect that constraint.`,
      550
    ),
    proposedTone: previewSentence(proposedTone, 650),
    proposedAuthorPersona: previewSentence(proposedPersonaBody, 900)
  };
}
