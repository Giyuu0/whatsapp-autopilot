/**
 * Few-shot example sampler over the bundled style datasets. Loaded once,
 * sampled per reply — a handful of SHORT examples only, and only when they
 * actually help, so prompt size (token usage) stays small:
 *   - flirt examples  → only when the chat's tone is "flirty"
 *   - natural-chat pairs → only for contacts with little own-style history
 */

let _flirt = null;
let _chat = null;

function flirtData() {
  if (!_flirt) {
    try {
      _flirt = require("./datasets/flirt.json");
    } catch {
      _flirt = [];
    }
  }
  return _flirt;
}

function chatData() {
  if (!_chat) {
    try {
      _chat = require("./datasets/chat.json");
    } catch {
      _chat = [];
    }
  }
  return _chat;
}

/** n distinct random items from arr. */
function sample(arr, n) {
  if (!arr.length) return [];
  const out = [];
  const used = new Set();
  const max = Math.min(n, arr.length);
  while (out.length < max) {
    const i = Math.floor(Math.random() * arr.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(arr[i]);
  }
  return out;
}

/**
 * A compact system-prompt block of flirty rewrite examples ("plain → charming").
 * ~4 short examples ≈ 120–180 tokens; returns "" when the dataset is missing.
 */
function flirtBlock(n = 4) {
  const rows = sample(flirtData(), n);
  if (!rows.length) return "";
  return (
    "FLIRTY INSPIRATION — how a plain line becomes charming (match this ENERGY, never copy verbatim, and always follow the required reply language):\n" +
    rows.map((r) => `• "${r.o}" → "${r.f}"`).join("\n")
  );
}

/**
 * A compact block of real human small-talk exchanges — used only when we have
 * few examples of the owner's own texting with this contact.
 */
function naturalChatBlock(n = 3) {
  const rows = sample(chatData(), n);
  if (!rows.length) return "";
  return (
    "HOW REAL PEOPLE TEXT — natural, casual exchanges (vibe reference only):\n" +
    rows.map(([q, a]) => `• them: "${q}" → reply: "${a}"`).join("\n")
  );
}

module.exports = { flirtBlock, naturalChatBlock };
