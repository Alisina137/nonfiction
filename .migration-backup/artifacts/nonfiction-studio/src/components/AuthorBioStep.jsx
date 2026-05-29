import { useEffect, useRef } from "react";
import { AUTHOR_TYPE_OPTIONS } from "@/lib/constants";

function previewClip(s, max) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildSyntheticBiography(bio, researchName) {
  const name = (bio.authorName || researchName || "").trim() || "The author";
  const type = bio.authorType?.trim() || "Personal name";
  const pro = (bio.professionalBackground || "").trim();
  const edu = (bio.education || "").trim();
  const pubs = (bio.previousPublications || "").trim();
  const ach = (bio.achievements || "").trim();
  const aff = (bio.affiliations || "").trim();
  const personal = (bio.personalDetails || "").trim();
  const web = (bio.websiteSocial || "").trim();

  const paras = [];

  let lead = `${name}`;
  if (type && type !== "Personal name") lead += ` (${type})`;
  lead += ` writes nonfiction`;
  if (pro) lead += ` grounded in ${previewClip(pro, 320)}`;
  else lead += ` with a practical, reader-first lens`;
  lead += ".";
  paras.push(lead);

  if (edu) paras.push(`Education and training include ${previewClip(edu, 400)}`);
  if (pubs) paras.push(`Prior work includes ${previewClip(pubs, 420)}`);
  if (ach) paras.push(`Notable milestones: ${previewClip(ach, 380)}`);
  if (aff) paras.push(`Affiliations: ${previewClip(aff, 320)}`);
  if (personal) paras.push(`Outside of writing: ${previewClip(personal, 420)}`);
  if (web) paras.push(`Learn more at ${previewClip(web, 240)}`);

  if (paras.length === 1 && pro) {
    paras.push(
      `${name} combines lived experience with clear explanations—ideal for readers who want momentum without overwhelm.`
    );
  }

  return paras.join("\n\n");
}

function FieldLabel({ children, hint, required }) {
  return (
    <label className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-slate-800">
      {children}
      {required && <span className="font-semibold text-red-600">*</span>}
      {hint && (
        <span
          className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300/90 bg-white text-[10px] font-bold text-sky-600 shadow-sm"
          title={hint}
        >
          i
        </span>
      )}
    </label>
  );
}

export default function AuthorBioStep({ authorBio, setAuthorBio, research, currentStep, authorBioStepIndex, errors }) {
  const ab = authorBio || {};
  const errs = errors || {};
  const visitRef = useRef(false);

  useEffect(() => {
    if (currentStep !== authorBioStepIndex) {
      visitRef.current = false;
      return;
    }
    if (visitRef.current) return;
    visitRef.current = true;
    const fromResearch = (research?.authorName || "").trim();
    if (!fromResearch) return;
    setAuthorBio((prev) => {
      const p = prev || {};
      if (String(p.authorName || "").trim()) return p;
      return { ...p, authorName: fromResearch };
    });
  }, [authorBioStepIndex, currentStep, research?.authorName, setAuthorBio]);

  function patch(partial) {
    setAuthorBio(typeof partial === "function" ? partial : { ...ab, ...partial });
  }

  function onGenerate() {
    const text = buildSyntheticBiography(ab, research?.authorName || "");
    patch({
      generatedBio: text,
      generatedAt: new Date().toISOString()
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm leading-relaxed text-slate-600">
        Let&apos;s get some info to create your personalized biography. Feel free to leave blank anything that
        doesn&apos;t apply to you.
      </p>

      <div className="book-panel mt-7 grid gap-6 md:grid-cols-2 md:gap-x-8 md:gap-y-6">
        <div className="md:col-span-1">
          <FieldLabel hint="As it should appear on the cover and in listings." required>
            Author name
          </FieldLabel>
          <input
            className="input-light mt-1.5"
            placeholder="Your name"
            value={ab.authorName ?? ""}
            onChange={(e) => patch({ authorName: e.target.value })}
          />
          {errs.authorName && <p className="mt-1 text-xs text-red-600">{errs.authorName}</p>}
        </div>

        <div className="md:col-span-1">
          <FieldLabel hint="How this author is credited publicly.">Author type</FieldLabel>
          <select
            className="input-light mt-1.5"
            value={ab.authorType ?? AUTHOR_TYPE_OPTIONS[0]}
            onChange={(e) => patch({ authorType: e.target.value })}
          >
            {AUTHOR_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <FieldLabel hint="Roles, industries, years of experience—what qualifies you to write this book?" required>
            Professional background
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[88px] resize-y"
            placeholder="Enter your professional background"
            value={ab.professionalBackground ?? ""}
            onChange={(e) => patch({ professionalBackground: e.target.value })}
          />
          {errs.professionalBackground && (
            <p className="mt-1 text-xs text-red-600">{errs.professionalBackground}</p>
          )}
        </div>

        <div className="md:col-span-1">
          <FieldLabel hint="Degrees, certifications, or self-directed study worth mentioning.">Education</FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[88px] resize-y"
            placeholder="Your academic background"
            value={ab.education ?? ""}
            onChange={(e) => patch({ education: e.target.value })}
          />
        </div>

        <div className="md:col-span-1">
          <FieldLabel hint="Books, essays, newsletters, podcasts—anything readers might know you from.">
            Previous publications
          </FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[88px] resize-y"
            placeholder="List your previous publications"
            value={ab.previousPublications ?? ""}
            onChange={(e) => patch({ previousPublications: e.target.value })}
          />
        </div>

        <div className="md:col-span-1">
          <FieldLabel hint="Recognition, press, measurable outcomes.">Achievements</FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[88px] resize-y"
            placeholder="Awards or milestones"
            value={ab.achievements ?? ""}
            onChange={(e) => patch({ achievements: e.target.value })}
          />
        </div>

        <div className="md:col-span-1">
          <FieldLabel hint="Professional associations, fellowships, boards.">Affiliations</FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[88px] resize-y"
            placeholder="Organizations or groups you're part of"
            value={ab.affiliations ?? ""}
            onChange={(e) => patch({ affiliations: e.target.value })}
          />
        </div>

        <div className="md:col-span-1">
          <FieldLabel hint="Optional human texture—keep it professional and consent-aware.">Personal details</FieldLabel>
          <textarea
            className="input-light mt-1.5 min-h-[88px] resize-y"
            placeholder="Interests, location, family, etc."
            value={ab.personalDetails ?? ""}
            onChange={(e) => patch({ personalDetails: e.target.value })}
          />
        </div>

        <div className="md:col-span-2">
          <FieldLabel hint="Website, Linktree, or primary social profiles.">Website / social media</FieldLabel>
          <input
            className="input-light mt-1.5"
            placeholder="Link to your site or social profiles"
            value={ab.websiteSocial ?? ""}
            onChange={(e) => patch({ websiteSocial: e.target.value })}
          />
        </div>
      </div>

      {ab.generatedAt && (
        <div className="book-panel mt-8">
          <FieldLabel hint="Edit freely after generating—this ships with your book metadata.">Biography draft</FieldLabel>
          <textarea
            className="input-light mt-2 min-h-[180px] resize-y"
            value={ab.generatedBio ?? ""}
            onChange={(e) => patch({ generatedBio: e.target.value })}
          />
        </div>
      )}

      <div className="mt-10 flex justify-center">
        <button
          type="button"
          onClick={onGenerate}
          className="rounded-full bg-gradient-to-r from-sky-600 to-sky-500 px-8 py-3 text-sm font-semibold text-white shadow-md shadow-sky-600/28 transition hover:from-sky-700 hover:to-sky-600 hover:shadow-lg hover:shadow-sky-600/35 active:scale-[0.99]"
        >
          Generate biography
        </button>
      </div>
    </div>
  );
}
