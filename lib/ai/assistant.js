/**
 * The "orb" control brain. Turns a natural-language command (typed or spoken)
 * into a structured action the WhatsApp controller can execute.
 */
const Groq = require("groq-sdk");

const ACTIONS_DOC = `Available actions (return exactly ONE):
- {"action":"send_message","target":"<contact name or number>","message":"<what to send>"}
- {"action":"open_chat","target":"<contact name or number>"}   // open that conversation in the panel
- {"action":"set_chat_language","target":"<contact>","language":"auto|english|hindi|hinglish|english-slang"}
- {"action":"set_chat_tone","target":"<contact>","tone":"professional|friendly|flirty"}
- {"action":"set_chat_voice","target":"<contact>","voiceReply":"default|voice|text"}
- {"action":"toggle_autoreply","target":"<contact>","enabled":true|false}
- {"action":"set_global_language","language":"auto|english|hindi|hinglish|english-slang"}
- {"action":"set_global_tone","tone":"professional|friendly|flirty"}
- {"action":"set_reply_delay","ms":<number>}
- {"action":"toggle_master","enabled":true|false}
- {"action":"answer","message":"<a short helpful spoken answer>"}`;

/**
 * @param {object} o
 * @param {string} o.apiKey
 * @param {string} o.model
 * @param {string} o.text            the user's command
 * @param {Array<{name:string,number:string}>} o.contacts  for name resolution
 * @returns {Promise<object>} parsed action object
 */
async function interpretCommand({ apiKey, model, text, contacts = [] }) {
  if (!apiKey) throw new Error("Groq API key is not set");
  const client = new Groq({ apiKey });

  const roster =
    contacts
      .slice(0, 80)
      .map((c) => `${c.name} (${c.number})`)
      .join("; ") || "none";

  const system =
    "You are the control brain of a WhatsApp auto-reply dashboard. " +
    "Convert the user's instruction into a single JSON object.\n" +
    ACTIONS_DOC +
    `\nKnown contacts: ${roster}.\n` +
    "Rules: Return ONLY valid JSON, no markdown, no commentary. " +
    "For send_message, keep the message natural and ready to send. " +
    "If the instruction is a general question or unclear, use the \"answer\" action.";

  const completion = await client.chat.completions.create({
    model: model || "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: system },
      { role: "user", content: text },
    ],
    temperature: 0.2,
    max_tokens: 300,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return { action: "answer", message: "Sorry, I couldn't understand that." };
  }
}

module.exports = { interpretCommand };
