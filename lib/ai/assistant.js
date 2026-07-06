/**
 * The "orb" control brain. Turns a natural-language command (typed or spoken)
 * into a structured action the WhatsApp controller can execute.
 */
const Groq = require("groq-sdk");
const { withKeyRotation, GROQ_OPTS } = require("./groq");

const ACTIONS_DOC = `Available actions (return exactly ONE):
- {"action":"send_message","target":"<contact name or number>","message":"<what to send>"}
- {"action":"open_chat","target":"<contact name or phone number>"}   // "open chat with X" / "start chatting with +91..." — opens that conversation (works with a new number too)
- {"action":"set_chat_language","target":"<contact>","language":"auto|english|hindi|hinglish|english-slang"}
- {"action":"set_chat_tone","target":"<contact>","tone":"professional|friendly|flirty"}
- {"action":"set_chat_voice","target":"<contact>","voiceReply":"default|voice|text"}
- {"action":"toggle_autoreply","target":"<contact>","enabled":true|false}
- {"action":"set_global_language","language":"auto|english|hindi|hinglish|english-slang"}
- {"action":"set_global_tone","tone":"professional|friendly|flirty"}
- {"action":"set_reply_delay","ms":<number>}
- {"action":"toggle_master","enabled":true|false}
- {"action":"discuss","message":"<the owner's request>"}   // discuss / get help with the currently OPEN chat
- {"action":"answer","message":"<a short helpful spoken answer>"}`;

/**
 * @param {object} o
 * @param {string} o.apiKey
 * @param {string} o.model
 * @param {string} o.text            the user's command
 * @param {Array<{name:string,number:string}>} o.contacts  for name resolution
 * @returns {Promise<object>} parsed action object
 */
async function interpretCommand({ apiKey, model, text, contacts = [], activeChat = null }) {
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
    (activeChat
      ? `The chat currently OPEN on screen is with "${activeChat}". If the user says "this"/"this chat"/"here", they mean that chat. If they want to discuss it, get your opinion, or draft a reply for it, use the "discuss" action.\n`
      : "") +
    "Rules: Return ONLY valid JSON, no markdown, no commentary. " +
    "For send_message, keep the message natural and ready to send. " +
    "If the instruction is a general question or unclear, use the \"answer\" action.";

  const completion = await withKeyRotation(apiKey, (key) =>
    new Groq({ apiKey: key, ...GROQ_OPTS }).chat.completions.create({
      model: model || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: "json_object" },
    })
  );

  const raw = completion.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return { action: "answer", message: "Sorry, I couldn't understand that." };
  }
}

/**
 * Interpret an "@bot ..." aside inside an open chat. Decides whether the owner
 * wants to SEND something to the person (a correction / fact / instruction) or
 * is asking the assistant PRIVATELY.
 *
 * @returns {Promise<{mode:"send"|"private", message:string}>}
 */
async function interpretChatAside({ apiKey, model, contactName, context = [], ownerText, persona }) {
  const convo =
    context
      .slice(-12)
      .map((m) => `${m.role === "assistant" ? "Me" : contactName}: ${m.content}`)
      .join("\n") || "(no recent messages)";

  const system =
    `You help your owner manage their WhatsApp chat with ${contactName}.\n` +
    `Recent conversation:\n${convo}\n\n` +
    "Your owner just privately typed an instruction to you. Decide the intent:\n" +
    `- "send": the owner wants you to SEND a message to ${contactName} on their behalf — a correction, a fact, an answer, or a "tell/say ..." instruction (e.g. "it is ghevar", "say sorry my mistake", "tell her I'll be late").\n` +
    "- \"private\": the owner is asking YOU something privately — your opinion, a draft suggestion, a question about the chat (e.g. \"what should I reply\", \"who is this\", \"summarize\").\n\n" +
    'Return ONLY JSON: {"mode":"send"|"private","message":"..."}.\n' +
    `If mode is "send": "message" is a natural, ready-to-send WhatsApp message to ${contactName}, in the owner's voice per this persona: ${persona}. Make it human and casual — for example if the owner corrects a wrong guess with "it is ghevar", a good message is "ohh my bad 😅 that's actually ghevar!".\n` +
    'If mode is "private": "message" is your short private reply to the owner (address them as "@yati").';

  const completion = await withKeyRotation(apiKey, (key) =>
    new Groq({ apiKey: key, ...GROQ_OPTS }).chat.completions.create({
      model: model || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: system },
        { role: "user", content: ownerText },
      ],
      temperature: 0.5,
      max_tokens: 300,
      response_format: { type: "json_object" },
    })
  );

  try {
    const j = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
    return { mode: j.mode === "send" ? "send" : "private", message: j.message || "" };
  } catch {
    return { mode: "private", message: "Sorry, I couldn't understand that." };
  }
}

module.exports = { interpretCommand, interpretChatAside };
