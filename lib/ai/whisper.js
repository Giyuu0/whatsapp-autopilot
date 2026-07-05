/**
 * Voice-note transcription via Groq Whisper. Takes a base64 audio blob (as
 * WhatsApp delivers voice notes — usually ogg/opus) and returns the text.
 */
const os = require("os");
const fs = require("fs");
const path = require("path");
const Groq = require("groq-sdk");

function extFor(mimetype = "") {
  if (mimetype.includes("mp3") || mimetype.includes("mpeg")) return "mp3";
  if (mimetype.includes("wav")) return "wav";
  if (mimetype.includes("m4a") || mimetype.includes("mp4")) return "m4a";
  return "ogg";
}

/**
 * @param {object} o
 * @param {string} o.apiKey
 * @param {string} o.model     e.g. "whisper-large-v3"
 * @param {string} o.base64
 * @param {string} o.mimetype
 * @returns {Promise<string>}
 */
async function transcribeAudio({ apiKey, model, base64, mimetype }) {
  if (!apiKey) throw new Error("Groq API key is not set");
  // Timeout + one retry so a hung upload can't stall the reply queue.
  const client = new Groq({ apiKey, timeout: 45000, maxRetries: 1 });

  const buf = Buffer.from(base64, "base64");
  const tmp = path.join(os.tmpdir(), `wa-voice-${Date.now()}.${extFor(mimetype)}`);
  fs.writeFileSync(tmp, buf);

  try {
    const res = await client.audio.transcriptions.create({
      file: fs.createReadStream(tmp),
      model: model || "whisper-large-v3",
      response_format: "text",
    });
    const text = typeof res === "string" ? res : res?.text || "";
    return String(text).trim();
  } finally {
    fs.unlink(tmp, () => {});
  }
}

module.exports = { transcribeAudio };
