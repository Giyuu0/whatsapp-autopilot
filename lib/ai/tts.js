/**
 * Best-effort text-to-speech via Groq's OpenAI-compatible /audio/speech
 * endpoint (called directly so it works regardless of the SDK version).
 * TTS availability varies by account/model, so callers MUST treat this as
 * optional and fall back to a text reply if it throws.
 */

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

  const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || "playai-tts",
      voice: voice || "Fritz-PlayAI",
      input: text,
      response_format: "wav",
    }),
  });

  if (!res.ok) {
    let msg = `Groq TTS HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error?.message) msg = j.error.message;
    } catch {}
    throw new Error(msg);
  }

  const arrayBuf = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString("base64");
  return { base64, mimetype: "audio/wav" };
}

module.exports = { synthesizeSpeech };
