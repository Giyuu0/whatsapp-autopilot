/**
 * Best-effort text-to-speech via Groq's OpenAI-compatible /audio/speech
 * endpoint (called directly so it works regardless of the SDK version).
 * TTS availability varies by account/model, so callers MUST treat this as
 * optional and fall back to a text reply if it throws.
 */
const os = require("os");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

/** Convert base64 WAV → base64 Ogg/Opus (WhatsApp voice-note format) via ffmpeg. */
async function wavToOpus(wavBase64) {
  const ffmpegPath = require("ffmpeg-static");
  const id = `${Date.now()}-${process.pid}-${(global.__ttsSeq = (global.__ttsSeq || 0) + 1)}`;
  const inFile = path.join(os.tmpdir(), `tts-${id}.wav`);
  const outFile = path.join(os.tmpdir(), `tts-${id}.ogg`);
  fs.writeFileSync(inFile, Buffer.from(wavBase64, "base64"));
  try {
    await new Promise((resolve, reject) => {
      execFile(
        ffmpegPath,
        ["-y", "-i", inFile, "-c:a", "libopus", "-b:a", "32k", "-ar", "48000", "-ac", "1", outFile],
        (err) => (err ? reject(err) : resolve())
      );
    });
    return fs.readFileSync(outFile).toString("base64");
  } finally {
    try { fs.unlinkSync(inFile); } catch {}
    try { fs.unlinkSync(outFile); } catch {}
  }
}

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

module.exports = { synthesizeSpeech, wavToOpus };
