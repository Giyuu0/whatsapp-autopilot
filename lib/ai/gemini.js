/**
 * Gemini replies. Vision (looks at images) plus text (used as a fallback in the
 * chatting chain when Groq is unavailable).
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Vision reply — looks at an image (+ optional caption).
 * @returns {Promise<string>}
 */
async function geminiVisionReply({ apiKey, model, systemPrompt, caption, mimeType, base64 }) {
  if (!apiKey) throw new Error("Gemini API key is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const gModel = genAI.getGenerativeModel({
    model: model || "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });

  const promptText =
    caption && caption.trim()
      ? `The sender sent this image with the caption: "${caption.trim()}". Reply naturally about the image.`
      : "The sender sent this image with no caption. Reply naturally about what you see.";

  const result = await gModel.generateContent([
    { text: promptText },
    { inlineData: { mimeType: mimeType || "image/jpeg", data: base64 } },
  ]);

  const reply = result?.response?.text?.().trim();
  if (!reply) throw new Error("Gemini returned an empty reply");
  return reply;
}

/**
 * Text reply — Gemini as a text-chat fallback.
 * @returns {Promise<string>}
 */
async function geminiText({ apiKey, model, systemPrompt, history = [], text }) {
  if (!apiKey) throw new Error("Gemini API key is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const gModel = genAI.getGenerativeModel({
    model: model || "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });

  const contents = [];
  for (const h of history) {
    contents.push({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] });
  }
  contents.push({ role: "user", parts: [{ text }] });

  const result = await gModel.generateContent({ contents });
  const reply = result?.response?.text?.().trim();
  if (!reply) throw new Error("Gemini returned an empty reply");
  return reply;
}

// Back-compat alias.
const geminiVision = geminiVisionReply;

module.exports = { geminiVisionReply, geminiVision, geminiText };
