/**
 * Groq replies. Fast + cheap. Handles both text chat and (with a vision-capable
 * model like llama-4-scout) images — used as a fallback for Gemini vision.
 */
const Groq = require("groq-sdk");

/**
 * Text chat completion.
 * @returns {Promise<string>}
 */
async function groqChat({ apiKey, model, systemPrompt, history = [], text }) {
  if (!apiKey) throw new Error("Groq API key is not set");
  const client = new Groq({ apiKey });

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: text },
  ];

  const completion = await client.chat.completions.create({
    model: model || "llama-3.3-70b-versatile",
    messages,
    temperature: 0.7,
    max_tokens: 400,
  });

  const reply = completion.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("Groq returned an empty reply");
  return reply;
}

/**
 * Vision completion — requires a vision-capable Groq model. The image is sent
 * inline as a data URL.
 * @returns {Promise<string>}
 */
async function groqVision({ apiKey, model, systemPrompt, caption, mimeType, base64 }) {
  if (!apiKey) throw new Error("Groq API key is not set");
  const client = new Groq({ apiKey });

  const promptText =
    caption && caption.trim()
      ? `The sender sent this image with the caption: "${caption.trim()}". Reply naturally about the image.`
      : "The sender sent this image with no caption. Reply naturally about what you see.";

  const completion = await client.chat.completions.create({
    model: model || "meta-llama/llama-4-scout-17b-16e-instruct",
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
    max_tokens: 400,
  });

  const reply = completion.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("Groq vision returned an empty reply");
  return reply;
}

// Back-compat alias.
const groqReply = groqChat;

module.exports = { groqChat, groqVision, groqReply };
