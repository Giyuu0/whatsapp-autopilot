/**
 * Discover the models actually available to the user's API keys, so the
 * Settings dropdowns show real options instead of guesses. Uses global fetch
 * (Node 18+). Each fetch is best-effort and returns empty lists on failure.
 */

// Groq Orpheus (canopylabs/orpheus-v1-english) voices — there is no list
// endpoint, so this is curated. Use the ▶ Preview button to hear each one.
const GROQ_VOICES = [
  "troy", "hannah", "austin", "autumn", "cooper", "harper", "jasper", "luna", "mabel", "sadie",
];

async function fetchGroqModels(apiKey) {
  const empty = { all: [], chat: [], vision: [], whisper: [], tts: [] };
  if (!apiKey) return empty;
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Groq models HTTP ${res.status}`);
  const json = await res.json();
  const ids = (json.data || []).map((m) => m.id).sort();
  const isTts = (id) => /(tts|orpheus|speech|playai)/i.test(id);
  return {
    all: ids,
    whisper: ids.filter((id) => /whisper/i.test(id)),
    tts: ids.filter(isTts),
    vision: ids.filter((id) => /(vision|scout|maverick|llama-4)/i.test(id)),
    // Chat = everything that isn't audio / TTS / safety / embedding.
    chat: ids.filter((id) => !/(whisper|guard|embed|embedding)/i.test(id) && !isTts(id)),
  };
}

async function fetchGeminiModels(apiKey) {
  const empty = { all: [], chat: [], vision: [] };
  if (!apiKey) return empty;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
  );
  if (!res.ok) throw new Error(`Gemini models HTTP ${res.status}`);
  const json = await res.json();
  const models = (json.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => String(m.name).replace(/^models\//, ""))
    .filter((n) => /gemini/i.test(n))
    .sort();
  // Modern Gemini flash/pro models are all multimodal (handle images).
  return { all: models, chat: models, vision: models };
}

/** Fetch both providers; never throws — surfaces per-provider errors instead. */
async function fetchAll(groqKey, geminiKey) {
  const out = {
    groq: { all: [], chat: [], vision: [], whisper: [], tts: [] },
    gemini: { all: [], chat: [], vision: [] },
    voices: GROQ_VOICES,
    errors: {},
  };
  const [g, m] = await Promise.allSettled([
    fetchGroqModels(groqKey),
    fetchGeminiModels(geminiKey),
  ]);
  if (g.status === "fulfilled") out.groq = g.value;
  else out.errors.groq = g.reason?.message || "failed";
  if (m.status === "fulfilled") out.gemini = m.value;
  else out.errors.gemini = m.reason?.message || "failed";
  return out;
}

module.exports = { fetchAll, fetchGroqModels, fetchGeminiModels, GROQ_VOICES };
