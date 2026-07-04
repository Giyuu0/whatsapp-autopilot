/**
 * Best-effort text-to-speech via Groq, for replying to voice notes WITH a
 * voice note. TTS availability varies by account/model, so callers MUST treat
 * this as optional and fall back to a text reply if it throws.
 */
const Groq = require("groq-sdk");

/**
 * @param {object} o
 * @param {string} o.apiKey
 * @param {string} o.model    e.g. "playai-tts"
 * @param {string} o.voice    e.g. "Fritz-PlayAI"
 * @param {string} o.text
 * @returns {Promise<{base64:string, mimetype:string}>}
 */
async function synthesizeSpeech({ apiKey, model, voice, text }) {
  if (!apiKey) throw new Error("Groq API key is not set");
  const client = new Groq({ apiKey });

  const resp = await client.audio.speech.create({
    model: model || "playai-tts",
    voice: voice || "Fritz-PlayAI",
    input: text,
    response_format: "wav",
  });

  const arrayBuf = await resp.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString("base64");
  return { base64, mimetype: "audio/wav" };
}

module.exports = { synthesizeSpeech };
