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
const { withKeyRotation } = require("./groq");

/**
 * Convert any base64 audio → base64 Ogg/Opus (WhatsApp voice-note format) via
 * ffmpeg. ffmpeg auto-detects the input container, so `inExt` is just a hint
 * for the temp filename (e.g. "wav", "webm", "ogg", "m4a", "mp3").
 */
async function audioToOpus(base64, inExt = "webm") {
  const ffmpegPath = require("ffmpeg-static");
  const id = `${Date.now()}-${process.pid}-${(global.__ttsSeq = (global.__ttsSeq || 0) + 1)}`;
  const inFile = path.join(os.tmpdir(), `aud-${id}.${(inExt || "webm").replace(/[^a-z0-9]/gi, "")}`);
  const outFile = path.join(os.tmpdir(), `aud-${id}.ogg`);
  fs.writeFileSync(inFile, Buffer.from(base64, "base64"));
  try {
    await new Promise((resolve, reject) => {
      execFile(
        ffmpegPath,
        ["-y", "-i", inFile, "-c:a", "libopus", "-b:a", "32k", "-ar", "48000", "-ac", "1", outFile],
        // A voice note converts in ~1s; a minute means ffmpeg is wedged — kill
        // it rather than stall the serialized reply queue behind it.
        { timeout: 60000 },
        (err) => (err ? reject(err) : resolve())
      );
    });
    return fs.readFileSync(outFile).toString("base64");
  } finally {
    try { fs.unlinkSync(inFile); } catch {}
    try { fs.unlinkSync(outFile); } catch {}
  }
}

/** Convert base64 WAV → base64 Ogg/Opus (WhatsApp voice-note format). */
async function wavToOpus(wavBase64) {
  return audioToOpus(wavBase64, "wav");
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

  // Rotate across comma-separated keys like every other Groq call — passing
  // the raw list as one Bearer header is a guaranteed 401 on multi-key setups.
  // Hard timeout because this runs inside the serialized reply queue: one hung
  // TTS request must not freeze auto-replies for every contact.
  return withKeyRotation(apiKey, async (key) => {
    const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "playai-tts",
        voice: voice || "Fritz-PlayAI",
        input: text,
        response_format: "wav",
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      let msg = `Groq TTS HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j?.error?.message) msg = j.error.message;
      } catch {}
      const err = new Error(msg);
      err.status = res.status; // lets withKeyRotation spot a 429 and rotate
      throw err;
    }

    const arrayBuf = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");
    return { base64, mimetype: "audio/wav" };
  });
}

module.exports = { synthesizeSpeech, wavToOpus, audioToOpus };
