// LocalStorage-backed cache for AI-generated Architecture Previews.
// Keyed by a stable signature of (niche, sub, deep, audience, goal, tones)
// so identical inputs reuse the previous OpenAI call.

const STORAGE_KEY = "nonfiction-arch-preview-cache-v1";
const MAX_ENTRIES = 30;

export function archCacheKey({
  mainNicheId,
  subNicheId,
  deepNicheLabel,
  audience,
  goal,
  tones
}) {
  const t = Array.isArray(tones) ? [...tones].sort().join(",") : "";
  return [
    String(mainNicheId || "").trim(),
    String(subNicheId || "").trim(),
    String(deepNicheLabel || "").trim().toLowerCase(),
    String(audience || "").trim().toLowerCase(),
    String(goal || "").trim().toLowerCase(),
    t.toLowerCase()
  ].join("|");
}

function readAll() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(obj) {
  try {
    const entries = Object.entries(obj);
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => (b[1]?.at || 0) - (a[1]?.at || 0));
      obj = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {}
}

export function getArchCache(key) {
  if (!key) return null;
  const all = readAll();
  return all[key]?.data || null;
}

export function setArchCache(key, data) {
  if (!key || !data) return;
  const all = readAll();
  all[key] = { data, at: Date.now() };
  writeAll(all);
}
