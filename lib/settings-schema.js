/**
 * Whitelist + clamp for `settings:update` payloads. The socket is authed, but
 * one malformed value can brick the reply pipeline — a huge replyDelayMs
 * stalls the serialized reply queue for days, a non-array chatChain throws on
 * every reply — so the payload's shape is enforced here instead of trusted.
 * Unknown keys are dropped (no mass-assignment into db.json).
 */

const BOOL_KEYS = [
  "autoReplyEnabled",
  "replyToGroups",
  "manualReply",
  "hideSensitive",
  "typingIndicator",
  "attentionAlerts",
  "attentionHold",
  "groqOnly",
  "voiceReplies",
  "contactMemoryEnabled",
];

// Free-text string settings (validated for type + length only — values are
// owner-authored; picking odd model/voice ids just falls back down the chain).
const STRING_KEYS = [
  "groqApiKey",
  "geminiApiKey",
  "systemPrompt",
  "ownerProfile",
  "accessKey",
  "language",
  "tone",
  "whisperModel",
  "ttsModel",
  "ttsVoice",
  "picoFlirtyAppId",
  "picoFriendlyAppId",
];
const MAX_STRING = 20000; // roomy enough for the longest persona prompt

const MAX_REPLY_DELAY_MS = 30000; // above ~30s a "human-like pause" is a stall
const MAX_CHAIN_STEPS = 24;

/** Keep only well-formed {provider, model} steps; undefined when not an array. */
function sanitizeChain(v) {
  if (!Array.isArray(v)) return undefined;
  return v
    .filter((s) => s && (s.provider === "groq" || s.provider === "gemini") && typeof s.model === "string" && s.model.trim())
    .map((s) => ({ provider: s.provider, model: s.model.trim().slice(0, 120) }))
    .slice(0, MAX_CHAIN_STEPS);
}

/** Returns a NEW object containing only known, well-typed, clamped settings. */
function sanitizeSettings(partial) {
  const out = {};
  if (!partial || typeof partial !== "object" || Array.isArray(partial)) return out;
  for (const k of BOOL_KEYS) if (k in partial) out[k] = !!partial[k];
  for (const k of STRING_KEYS) {
    if (k in partial && typeof partial[k] === "string") out[k] = partial[k].slice(0, MAX_STRING);
  }
  if ("replyDelayMs" in partial) {
    const n = Number(partial.replyDelayMs);
    if (Number.isFinite(n)) out.replyDelayMs = Math.min(Math.max(Math.round(n), 0), MAX_REPLY_DELAY_MS);
  }
  const chat = sanitizeChain(partial.chatChain);
  if (chat && chat.length) out.chatChain = chat; // an empty chain would kill all replies
  const vision = sanitizeChain(partial.visionChain);
  if (vision && vision.length) out.visionChain = vision;
  return out;
}

module.exports = { sanitizeSettings };
