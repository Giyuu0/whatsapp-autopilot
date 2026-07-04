/**
 * Reply-language engine. Turns a language choice into an instruction that gets
 * appended to the system prompt so replies come out in the right style.
 */
const LANG_INSTRUCTIONS = {
  auto:
    "Detect the language and script the sender used in their latest message and reply in that SAME language — English, Hindi (Devanagari), Hinglish (Roman-script Hindi), or whatever they used. Mirror their style and tone.",
  english: "Write your reply in clear, natural English.",
  hindi:
    "Write your reply in Hindi using Devanagari script (हिंदी). Keep it natural and conversational.",
  hinglish:
    "Write your reply in Hinglish — Hindi written in Roman/English letters, casually mixed with English, the way young Indians text each other (e.g. \"haan bro, main thodi der me aata hoon\"). Do NOT use Devanagari.",
  "english-slang":
    "Write your reply in casual English loaded with modern texting slang and a laid-back vibe (e.g. \"yooo\", \"ngl\", \"fr\", \"lol\", \"tbh\"). Keep it fun but readable.",
};

const LANGUAGE_LABELS = {
  auto: "Auto-detect",
  english: "English",
  hindi: "Hindi",
  hinglish: "Hinglish",
  "english-slang": "English + slang",
};

function languageInstruction(lang) {
  return LANG_INSTRUCTIONS[lang] || LANG_INSTRUCTIONS.english;
}

/** Per-chat override wins; otherwise fall back to the global language. */
function resolveLanguage(contactLang, globalLang) {
  if (contactLang && contactLang !== "default" && contactLang !== "") return contactLang;
  return globalLang || "english";
}

module.exports = {
  languageInstruction,
  resolveLanguage,
  LANGUAGES: Object.keys(LANG_INSTRUCTIONS),
  LANGUAGE_LABELS,
};
