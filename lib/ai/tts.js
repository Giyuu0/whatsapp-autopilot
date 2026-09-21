const Groq = require("groq-sdk");
const store = require("../store");

const { DEFAULT_TTS_MODEL, DEFAULT_TTS_VOICE } = require("../store");

/**
 * Synthesize speech from text using Groq's TTS API.
 * 
 * @param {string} text - The text to convert to speech.
 * @param {string} [model=DEFAULT_TTS_MODEL] - The TTS model to use.
 * @param {string} [voice=DEFAULT_TTS_VOICE] - The voice to use.
 * @returns {Promise<Buffer>} The generated audio buffer.
 */
async function synthesizeSpeech(text, model = DEFAULT_TTS_MODEL, voice = DEFAULT_TTS_VOICE) {
  try {
    const settings = store.getSettings();
    if (!settings.groqApiKey) {
      throw new Error("Groq API key is missing.");
    }

    const groq = new Groq({ apiKey: settings.groqApiKey });

    const response = await groq.audio.speech.create({
      model: model,
      voice: voice,
      input: text,
      response_format: "wav",
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
  } catch (error) {
    console.error("[tts] Failed to synthesize speech:", error.message);
    throw error;
  }
}

module.exports = {
  synthesizeSpeech,
};
