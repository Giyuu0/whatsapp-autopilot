/**
 * Groq replies. Fast + cheap. Handles both text chat and (with a vision-capable
 * model like llama-4-scout) images — used as a fallback for Gemini vision.
 */
const Groq = require("groq-sdk");

// Hard timeout + single retry on every Groq call — one hung request must not
// stall the serialized reply queue for every other contact behind it.
const GROQ_OPTS = { timeout: 30000, maxRetries: 1 };

// Current Groq defaults. Groq shut down llama-3.3-70b-versatile, llama-3.1-8b-instant
// and the Llama 4 vision models in 2026; these are the replacements it recommends.
const DEFAULT_CHAT_MODEL = "openai/gpt-oss-120b";
const DEFAULT_FAST_MODEL = "openai/gpt-oss-20b";
const DEFAULT_VISION_MODEL = "qwen/qwen3.8-27b";

// Retired Groq model IDs, so saved settings can be migrated off them.
const RETIRED_GROQ_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "moonshotai/kimi-k2-instruct",
  "moonshotai/kimi-k2-instruct-0905",
  "qwen/qwen3-32b",
  "qwen/qwen3.6-27b",
  "gemma2-9b-it",
]);

/**
 * gpt-oss reasons before it answers, and that reasoning counts against
 * max_tokens — at the short budgets used for replies it can spend all of them
 * and return empty content. Low effort keeps it quick and leaves room to reply.
 */
function reasoningOpts(model) {
  return /^openai\/gpt-oss/.test(model || "") ? { reasoning_effort: "low" } : {};
}

/** GROQ_API_KEY may hold several comma-separated keys — each key is its own
 *  rate-limit bucket, so we rotate to the next key when one is rate-limited. */
function keyList(apiKey) {
  return String(apiKey || "").split(",").map((k) => k.trim()).filter(Boolean);
}
function isRateLimited(e) {
  return e?.status === 429 || /rate limit|too many requests|429|quota|capacity/i.test(e?.message || "");
}
/** Run `fn(key)` against each key in turn, moving on only when rate-limited. */
async function withKeyRotation(apiKey, fn) {
  const keys = keyList(apiKey);
  if (!keys.length) throw new Error("Groq API key is not set");
  let lastErr;
  for (const key of keys) {
    try {
      return await fn(key);
    } catch (e) {
      lastErr = e;
      if (!isRateLimited(e)) throw e; // real error → surface it; rate-limit → try next key
    }
  }
  throw lastErr;
}

/**
 * Text chat completion.
 * @returns {Promise<string>}
 */
async function groqChat({ apiKey, model, systemPrompt, history = [], text }) {
  return withKeyRotation(apiKey, async (key) => {
    const client = new Groq({ apiKey: key, ...GROQ_OPTS });
    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: text },
    ];
    const completion = await client.chat.completions.create({
      model: model || DEFAULT_CHAT_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 200,
      ...reasoningOpts(model || DEFAULT_CHAT_MODEL),
    });
    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("Groq returned an empty reply");
    return reply;
  });
}

/**
 * Vision completion — requires a vision-capable Groq model. The image is sent
 * inline as a data URL.
 * @returns {Promise<string>}
 */
async function groqVision({ apiKey, model, systemPrompt, caption, mimeType, base64 }) {
  const promptText =
    caption && caption.trim()
      ? `The sender sent this image with the caption: "${caption.trim()}". Reply naturally about the image.`
      : "The sender sent this image with no caption. Reply naturally about what you see.";

  return withKeyRotation(apiKey, async (key) => {
    const client = new Groq({ apiKey: key, ...GROQ_OPTS });
    const completion = await client.chat.completions.create({
      model: model || DEFAULT_VISION_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: `data:${mimeType || "image/jpeg"};base64,${base64}` } },
          ],
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
      ...reasoningOpts(model || DEFAULT_VISION_MODEL),
    });
    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("Groq vision returned an empty reply");
    return reply;
  });
}

// Back-compat alias.
const groqReply = groqChat;

module.exports = {
  groqChat,
  groqVision,
  groqReply,
  withKeyRotation,
  reasoningOpts,
  GROQ_OPTS,
  DEFAULT_CHAT_MODEL,
  DEFAULT_FAST_MODEL,
  DEFAULT_VISION_MODEL,
  RETIRED_GROQ_MODELS,
};
