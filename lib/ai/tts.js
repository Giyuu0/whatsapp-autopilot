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
const { DEFAULT_TTS_MODEL, DEFAULT_TTS_VOICE } = require("../store");

function getSettings() {
  try {
    const store = require("../store");
    return store.getSettings();
  } catch {
    return {};
  }
}

async function tts(text, opts = {}) {
  const settings = getSettings();
  const model = opts.model || settings.ttsModel || DEFAULT_TTS_MODEL;
  const voice = opts.voice || settings.ttsVoice || DEFAULT_TTS_VOICE;

  const tmpFile = path.join(os.tmpdir(), `tts-${Date.now()}.mp3`);

  const res = await withKeyRotation(async (client) => {
    return await client.audio.speech.create({
      model,
      voice,
      input: text,
    });
  });

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(tmpFile, buffer);

  // Convert mp3 to ogg/opus for WhatsApp if ffmpeg is available, otherwise return mp3
  const oggFile = tmpFile.replace(".mp3", ".ogg");
  try {
    await new Promise((resolve, reject) => {
      execFile("ffmpeg", ["-y", "-i", tmpFile, "-c:a", "libopus", oggFile], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    fs.unlinkSync(tmpFile);
    return oggFile;
  } catch {
    return tmpFile;
  }
}

module.exports = { tts, DEFAULT_TTS_MODEL, DEFAULT_TTS_VOICE };
