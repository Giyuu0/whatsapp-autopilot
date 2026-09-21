/**
 * Tiny JSON-file store. Single source of truth for settings, per-contact
 * config and message logs. Debounced writes so we never thrash the disk.
 */
const fs = require("fs");
const path = require("path");

const {
  DEFAULT_CHAT_MODEL,
  DEFAULT_FAST_MODEL,
  DEFAULT_VISION_MODEL,
  RETIRED_GROQ_MODELS,
} = require("./ai/groq");

// --- TTS Defaults (Single source of truth) ---
const DEFAULT_TTS_MODEL = "canopylabs/orpheus-v1-english";
const DEFAULT_TTS_VOICE = "troy";

// Gemini models Google has shut down (1.x, bare gemini-pro, the 2.0 family and
// 2.5 Flash-Lite).
const RETIRED_GEMINI = /gemini-1\.5|gemini-1\.0|^gemini-pro$|^gemini-2\.0-|^gemini-2\.5-flash-lite$/i;
const isRetired = (s) =>
  (s.provider === "groq" && RETIRED_GROQ_MODELS.has(s.model)) ||
  (s.provider === "gemini" && RETIRED_GEMINI.test(s.model));

// DATA_DIR can point at a persistent volume in production (Railway/Docker).
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const DEFAULTS = {
  settings: {
    groqApiKey: process.env.GROQ_API_KEY || "",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    chatChain: [
      { provider: "groq", model: DEFAULT_CHAT_MODEL },
      { provider: "groq", model: DEFAULT_FAST_MODEL },
      { provider: "groq", model: DEFAULT_VISION_MODEL },
      { provider: "gemini", model: "gemini-flash-lite-latest" },
      { provider: "gemini", model: "gemini-flash-latest" },
    ],
    visionChain: [
      { provider: "groq", model: DEFAULT_VISION_MODEL },
      { provider: "gemini", model: "gemini-flash-lite-latest" },
    ],
    systemPrompt:
      "You are my friendly, concise WhatsApp assistant replying on my behalf. " +
      "Keep replies short, warm and natural — like a real person texting. " +
      "Never mention that you are an AI. Match the sender's language.",
    accessKey: "wa-admin-2025",
    autoReplyEnabled: true,
    replyDelayMs: 1200,
    replyToGroups: false,
    manualReply: false,
    hideSensitive: true,
    typingIndicator: true,
    picoFlirtyAppId: "",
    picoFriendlyAppId: "",
    attentionAlerts: true,
    attentionHold: true,
    groqOnly: false,
    language: "auto",
    tone: "professional",
    ownerProfile:
      "My owner is Yati Bhardwaj (handle: ys941), a software developer based in New Delhi, India, who builds AI products, automation and web apps, with a background in medical laboratory science. " +
      "He previously worked as an Application Specialist in Microbiology at bioMérieux and a Microbiology Technologist at Medanta, Gurugram. " +
      "His website is masstree.in (it has microbiology notes, dilution & QC calculators, a microbiology quiz, a 'Roastme' bot and a 'BioLinguist' AI chatbot). " +
      "Socials: X/Twitter @bhardwaj_yati, Instagram @am_yatibhardwaj, LinkedIn yati-bhardwaj.\n\n" +
      "Personal: He loves coffee a lot — his favourite is an iced or hot latte with NO sugar — but he never says no to tea either. " +
      "His favourite food is Biryani. He doesn't go to the gym and is on a cutting diet: in the morning he eats boiled chole (chickpeas) with mint-tomato chutney, curd, black pepper and cucumber, and in the evening a soya-paneer sandwich.",
    whisperModel: "whisper-large-v3",
    voiceReplies: false,
    ttsModel: DEFAULT_TTS_MODEL,
    ttsVoice: DEFAULT_TTS_VOICE,
  },
  contacts: {},
  logs: [],
};

const MAX_LOGS = 250;

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULTS, null, 2));
  }
}

function load() {
  ensure();
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    const settings = { ...DEFAULTS.settings, ...(raw.settings || {}) };
    delete settings.chatbotPersona;
    delete settings.personaMode;
    delete settings.testNumbers;
    if (!settings.ttsModel || /playai-tts/i.test(settings.ttsModel)) settings.ttsModel = DEFAULTS.settings.ttsModel;
    if (!settings.ttsVoice || /-PlayAI$/i.test(settings.ttsVoice)) settings.ttsVoice = DEFAULTS.settings.ttsVoice;
    if (!Array.isArray(settings.chatChain) || !settings.chatChain.length) {
      settings.chatChain = settings.groqModel
        ? [{ provider: "groq", model: settings.groqModel }, ...(settings.chatFallbacks || [])]
        : [...DEFAULTS.settings.chatChain];
    }
    settings.chatChain = settings.chatChain.filter((s) => !isRetired(s));
    for (const d of DEFAULTS.settings.chatChain) {
      if (settings.chatChain.some((s) => s.provider === d.provider && s.model === d.model)) continue;
      if (d.provider === "groq") {
        const firstGemini = settings.chatChain.findIndex((s) => s.provider === "gemini");
        if (firstGemini >= 0) settings.chatChain.splice(firstGemini, 0, d);
        else settings.chatChain.push(d);
      } else {
        settings.chatChain.push(d);
      }
    }
    if (Array.isArray(settings.visionChain)) {
      settings.visionChain = settings.visionChain.filter((s) => !isRetired(s));
      if (settings.visionChain.length && !settings.visionChain.some((s) => s.provider === "groq")) {
        settings.visionChain.unshift({ ...DEFAULTS.settings.visionChain[0] });
      }
    }
    if (!Array.isArray(settings.visionChain) || !settings.visionChain.length) {
      settings.visionChain = DEFAULTS.settings.visionChain;
    }
    delete settings.groqModel;
    delete settings.geminiModel;
    delete settings.chatFallbacks;
    delete settings.visionFallbacks;
    return {
      settings,
      contacts: raw.contacts || {},
      logs: Array.isArray(raw.logs) ? raw.logs : [],
    };
  } catch (e) {
    console.error("[store] failed to read db, using defaults:", e.message);
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

if (!globalThis.__waStore) {
  globalThis.__waStore = { db: load(), timer: null };
}
const state = globalThis.__waStore;

function persist() {
  if (state.timer) return;
  state.timer = setTimeout(() => {
    state.timer = null;
    writeNow();
  }, 250);
}

function writeNow() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state.db, null, 2));
  } catch (e) {
    console.error("[store] write failed:", e.message);
  }
}

const store = {
  get db() {
    return state.db;
  },
  getSettings() {
    const s = { ...state.db.settings };
    if (process.env.GROQ_API_KEY) s.groqApiKey = process.env.GROQ_API_KEY;
    if (process.env.GEMINI_API_KEY) s.geminiApiKey = process.env.GEMINI_API_KEY;
    return s;
  },
  accessKey() {
    return process.env.ACCESS_KEY || state.db.settings.accessKey || "";
  },
  accessKeyLocked() {
    return !!process.env.ACCESS_KEY;
  },
  updateSettings(partial) {
    state.db.settings = { ...state.db.settings, ...partial };
    persist();
    return this.getSettings();
  },
  getContacts() {
    return Object.values(state.db.contacts);
  },
  getContact(id) {
    return state.db.contacts[id];
  },
  mergeContacts(list) {
    for (const c of list) {
      const existing = state.db.contacts[c.id] || {};
      state.db.contacts[c.id] = {
        id: c.id,
        name: c.name || existing.name || c.number,
        number: c.number || existing.number || "",
        enabled: existing.enabled ?? false,
        customPrompt: existing.customPrompt || "",
        language: existing.language || "default",
        tone: existing.tone || "default",
        voiceReply: existing.voiceReply || "default",
        manualReply: existing.manualReply || "default",
        memory: existing.memory || "",
        styleProfile: existing.styleProfile || "",
        styleTrainedAt: existing.styleTrainedAt || 0,
        styleMsgCount: existing.styleMsgCount || 0,
        deepAnalyzedAt: existing.deepAnalyzedAt || 0,
        gender: existing.gender || "",
        favorite: existing.favorite || false,
        personaMode: existing.personaMode || "off",
        picoChatId: existing.picoChatId || "",
      };
    }
    persist();
    return this.getContacts();
  },
  setContact(id, patch) {
    const existing = state.db.contacts[id];
    if (!existing) return null;
    const affectsPersona = ["personaMode", "language", "tone", "customPrompt", "gender"];
    if (affectsPersona.some((k) => k in patch && patch[k] !== existing[k])) {
      patch = { ...patch, picoChatId: "" };
    }
    state.db.contacts[id] = { ...existing, ...patch };
    persist();
    return state.db.contacts[id];
  },
  isEnabled(id) {
    const c = state.db.contacts[id];
    return !!(c && c.enabled);
  },
  addLog(entry) {
    const log = {
      id: `${entry.ts || Date.now()}-${state.db.logs.length}`,
      ...entry,
    };
    state.db.logs.push(log);
    if (state.db.logs.length > MAX_LOGS) {
      state.db.logs = state.db.logs.slice(-MAX_LOGS);
    }
    persist();
    return log;
  },
  getLogs() {
    return state.db.logs;
  },
  clearLogs() {
    state.db.logs = [];
    persist();
  },
  flush() {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    writeNow();
  },
  stats() {
    const logs = state.db.logs;
    const contacts = Object.values(state.db.contacts);
    return {
      received: logs.filter((l) => l.direction === "in").length,
      sent: logs.filter((l) => l.direction === "out").length,
      enabledContacts: contacts.filter((c) => c.enabled).length,
      totalContacts: contacts.length,
    };
  },
};

store.DEFAULT_TTS_MODEL = DEFAULT_TTS_MODEL;
store.DEFAULT_TTS_VOICE = DEFAULT_TTS_VOICE;

module.exports = store;
module.exports.DEFAULT_TTS_MODEL = DEFAULT_TTS_MODEL;
module.exports.DEFAULT_TTS_VOICE = DEFAULT_TTS_VOICE;
