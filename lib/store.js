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
      "My owner is Yati Bhardwaj (handle: ys941), a software developer based in New Delhi
