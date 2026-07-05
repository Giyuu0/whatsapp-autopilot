/**
 * Reply-language engine. Turns a language choice into an instruction that gets
 * appended to the system prompt so replies come out in the right style.
 */
const LANG_INSTRUCTIONS = {
  auto:
    "Reply in the SAME language the sender used in their latest message — English→English, Hindi→Hindi (Devanagari), Hinglish→Hinglish (Roman-script Hindi). Mirror it exactly.",
  english:
    "Write your ENTIRE reply in clear, professional American (US) English only. Do NOT use any Hindi, Hinglish or other-language words — no matter what language the sender or the examples used.",
  hindi:
    "Write your ENTIRE reply in Hindi using Devanagari script (हिंदी) only. Do NOT reply in English or Hinglish, no matter what language the sender used.",
  hinglish:
    "Write your ENTIRE reply in Hinglish — Hindi written in Roman/English letters, casually mixed with English the way young Indians text (e.g. \"haan bro, thodi der me aata hoon\"). Do NOT use Devanagari. Reply in Hinglish even if the sender wrote in pure English or pure Hindi.",
  "english-slang":
    "Write your ENTIRE reply in American (US) English with a professional-but-casual tone and light, CLEAN US slang (e.g. \"for sure\", \"sounds good\", \"no worries\", \"gotcha\", \"my bad\", \"appreciate it\", \"let's circle back\"). Keep it polished and workplace-appropriate — NO crude/vulgar slang, NO Indian English, NO Hinglish. Strictly US English.",
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
