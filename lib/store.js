/**
 * Tiny JSON-file store. Single source of truth for settings, per-contact
 * config and message logs. Debounced writes so we never thrash the disk.
 */
const fs = require("fs");
const path = require("path");

// DATA_DIR can point at a persistent volume in production (Railway/Docker).
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const DEFAULTS = {
  settings: {
    // Keys can be set from the dashboard OR via .env (env wins if present).
    groqApiKey: process.env.GROQ_API_KEY || "",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    // Ordered model chains — the first is primary, the rest are fallbacks tried
    // in order if one fails/rate-limits. Each step is { provider:"groq"|"gemini", model }.
    // Groq is primary for BOTH text and vision because it's fast and reliable;
    // Gemini free-tier vision is frequently rate-limited (429), so it's a fallback.
    chatChain: [
      { provider: "groq", model: "llama-3.3-70b-versatile" },
      { provider: "groq", model: "llama-3.1-8b-instant" },
      // All the common Gemini text models as further fallbacks.
      { provider: "gemini", model: "gemini-2.5-flash" },
      { provider: "gemini", model: "gemini-2.0-flash" },
      { provider: "gemini", model: "gemini-2.0-flash-lite" },
      { provider: "gemini", model: "gemini-1.5-flash" },
    ],
    visionChain: [
      { provider: "groq", model: "meta-llama/llama-4-scout-17b-16e-instruct" },
      { provider: "gemini", model: "gemini-2.0-flash" },
    ],
    systemPrompt:
      "You are my friendly, concise WhatsApp assistant replying on my behalf. " +
      "Keep replies short, warm and natural — like a real person texting. " +
      "Never mention that you are an AI. Match the sender's language.",
    // Dashboard access key. .env ACCESS_KEY always wins if set; otherwise this
    // value is used and can be changed from the Settings panel.
    accessKey: "wa-admin-2025",
    autoReplyEnabled: true, // master switch
    replyDelayMs: 1200, // small human-like delay before sending
    replyToGroups: false,
    // Manual mode: draft the AI reply but DON'T send it — you send manually.
    manualReply: false, // global default (per-chat can override)
    // Never auto-reply to (and hide) OTPs, bank/transaction alerts & promos.
    hideSensitive: true,
    // Show a "typing…" indicator to the recipient before sending.
    typingIndicator: true,
    // Let the bot remember facts about each contact and use them in replies.
    contactMemoryEnabled: true,
    // Privacy: only use Groq (which doesn't train on API data) — never send
    // anything to Google Gemini.
    groqOnly: false,
    // Reply language: auto | english | hindi | hinglish | english-slang
    language: "auto",
    // Global default tone: professional | friendly | flirty (per-chat overrides)
    tone: "professional",
    // What the bot knows about its owner. Injected into every reply so it can
    // answer questions about the owner and never disrespects them.
    ownerProfile:
      "My owner is Yati Bhardwaj (handle: ys941), a 26-year-old microbiologist and Medical Laboratory Technologist at AIIMS, New Delhi (born 17 September, based in New Delhi, India). " +
      "He previously worked as an Application Specialist in Microbiology at bioMérieux and a Microbiology Technologist at Medanta, Gurugram. " +
      "He's an expert in molecular diagnostics (PCR/qPCR/RT-PCR), bacteriology, serology, ELISA, mycobacteriology (AFB/TB), MALDI-TOF identification and lab quality control, and also codes in HTML, CSS, JavaScript and Python. " +
      "His website is masstree.in (it has microbiology notes, dilution & QC calculators, a microbiology quiz, a 'Roastme' bot and a 'BioLinguist' AI chatbot). " +
      "Socials: X/Twitter @bhardwaj_yati, Instagram @am_yatibhardwaj, LinkedIn yati-bhardwaj.\n\n" +
      "Personal: He loves coffee a lot — his favourite is an iced or hot latte with NO sugar — but he never says no to tea either. " +
      "His favourite food is Biryani. He doesn't go to the gym and is on a cutting diet: in the morning he eats boiled chole (chickpeas) with mint-tomato chutney, curd, black pepper and cucumber, and in the evening a soya-paneer sandwich.",
    // Voice notes
    whisperModel: "whisper-large-v3", // Groq transcription of incoming voice
    voiceReplies: false, // reply to voice notes WITH a voice note (best-effort TTS)
    ttsModel: "canopylabs/orpheus-v1-english", // Groq's current TTS (playai-tts is decommissioned)
    ttsVoice: "troy",
  },
  // contactId -> { id, name, number, enabled, customPrompt, language, voiceReply }
  contacts: {},
  logs: [], // newest last, capped
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
    // Migrate off Groq's decommissioned playai-tts / PlayAI voices.
    if (!settings.ttsModel || /playai-tts/i.test(settings.ttsModel)) settings.ttsModel = DEFAULTS.settings.ttsModel;
    if (!settings.ttsVoice || /-PlayAI$/i.test(settings.ttsVoice)) settings.ttsVoice = DEFAULTS.settings.ttsVoice;
    // Migrate old groqModel/geminiModel + *Fallbacks into ordered chains.
    if (!Array.isArray(settings.chatChain) || !settings.chatChain.length) {
      settings.chatChain = settings.groqModel
        ? [{ provider: "groq", model: settings.groqModel }, ...(settings.chatFallbacks || [])]
        : [...DEFAULTS.settings.chatChain];
    }
    // Ensure every default Gemini text fallback is present in the chat chain.
    for (const g of DEFAULTS.settings.chatChain.filter((s) => s.provider === "gemini")) {
      if (!settings.chatChain.some((s) => s.provider === "gemini" && s.model === g.model)) {
        settings.chatChain.push(g);
      }
    }
    if (!Array.isArray(settings.visionChain) || !settings.visionChain.length) {
      // Adopt the new Groq-first default (don't preserve the old Gemini-first
      // order) — free-tier Gemini vision keeps hitting 429.
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

// Cache the in-memory db on globalThis so server.js and any other require()
// share the exact same object instance.
if (!globalThis.__waStore) {
  globalThis.__waStore = { db: load(), timer: null };
}
const state = globalThis.__waStore;

function persist() {
  if (state.timer) return;
  state.timer = setTimeout(() => {
    state.timer = null;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(state.db, null, 2));
    } catch (e) {
      console.error("[store] write failed:", e.message);
    }
  }, 250);
}

const store = {
  get db() {
    return state.db;
  },

  getSettings() {
    const s = { ...state.db.settings };
    // Env keys are always effective when no key has been set in the UI. This
    // avoids seed-timing issues (a persisted empty string overriding .env).
    if (!s.groqApiKey && process.env.GROQ_API_KEY) s.groqApiKey = process.env.GROQ_API_KEY;
    if (!s.geminiApiKey && process.env.GEMINI_API_KEY) s.geminiApiKey = process.env.GEMINI_API_KEY;
    return s;
  },

  /** The effective dashboard access key — .env ACCESS_KEY wins if present. */
  accessKey() {
    return process.env.ACCESS_KEY || state.db.settings.accessKey || "";
  },

  /** True when the key is fixed by .env and can't be changed from the UI. */
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

  /** Merge a freshly-fetched contact list from WhatsApp, preserving flags. */
  mergeContacts(list) {
    for (const c of list) {
      const existing = state.db.contacts[c.id] || {};
      state.db.contacts[c.id] = {
        id: c.id,
        name: c.name || existing.name || c.number,
        number: c.number || existing.number || "",
        enabled: existing.enabled ?? false,
        customPrompt: existing.customPrompt || "",
        language: existing.language || "default", // per-chat language override
        tone: existing.tone || "default", // per-chat tone override
        voiceReply: existing.voiceReply || "default", // default | voice | text
        manualReply: existing.manualReply || "default", // default | on | off
        memory: existing.memory || "", // facts the bot knows about this person
        styleProfile: existing.styleProfile || "", // trained per-contact texting-style profile
        styleTrainedAt: existing.styleTrainedAt || 0, // when the profile was last trained
        styleMsgCount: existing.styleMsgCount || 0, // owner messages it was trained on
        favorite: existing.favorite || false, // starred / favourite chat (for the Fav filter)
      };
    }
    persist();
    return this.getContacts();
  },

  setContact(id, patch) {
    const existing = state.db.contacts[id];
    if (!existing) return null;
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
      id: `${entry.ts || nowStamp()}-${state.db.logs.length}`,
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

// nowStamp injected lazily so the store has no hard time dependency at import.
let _nowStamp = () => Date.now();
function nowStamp() {
  return _nowStamp();
}

module.exports = store;
