/**
 * WhatsApp controller — owns the whatsapp-web.js client, connection lifecycle,
 * chat sync, the auto-reply pipeline (text / image / voice), the reply-language
 * engine, and the "orb" command brain. Broadcasts everything over Socket.IO.
 * Kept as a globalThis singleton so there is exactly one client per process.
 */
const path = require("path");
const qrcode = require("qrcode");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

const store = require("../store");
const { groqChat, groqVision } = require("../ai/groq");
const { geminiVisionReply, geminiText } = require("../ai/gemini");
const { transcribeAudio } = require("../ai/whisper");
const { synthesizeSpeech } = require("../ai/tts");
const { interpretCommand } = require("../ai/assistant");
const { languageInstruction, resolveLanguage } = require("../ai/language");
const { toneInstruction, resolveTone } = require("../ai/tone");
const { fetchAll } = require("../ai/models");

const MSGS_PER_CHAT = 60;
const CTX_MESSAGES = 12; // how many prior messages to feed the model for context

function typeOf(waType) {
  if (waType === "chat") return "text";
  if (waType === "image") return "image";
  if (waType === "ptt") return "voice";
  if (waType === "audio") return "audio";
  return "other";
}
function typeLabel(t) {
  return { image: "📷 Photo", voice: "🎤 Voice message", audio: "🎵 Audio", other: "📎 Attachment" }[typeOf(t)] || "";
}

class WAController {
  constructor() {
    this.io = null;
    this.client = null;
    this.status = "idle";
    this.qrDataUrl = null;
    this.me = null;
    this.lastError = null;
    this.startedAt = Date.now();

    this.chatMeta = new Map(); // chatId -> { id,name,number,isGroup,lastText,lastTs,unread }
    this.messages = new Map(); // chatId -> Message[]
    this.replied = new Set(); // message ids we've already auto-replied to
    this.privSeq = 0; // counter for private @bot/@yati message ids
  }

  attachIo(io) {
    this.io = io;
  }
  emit(event, payload) {
    if (this.io) this.io.emit(event, payload);
  }

  setStatus(status, extra = {}) {
    this.status = status;
    this.emit("status", { status, me: this.me, qr: this.qrDataUrl, error: this.lastError, ...extra });
  }

  snapshot() {
    return {
      status: this.status,
      qr: this.qrDataUrl,
      me: this.me,
      error: this.lastError,
      startedAt: this.startedAt,
      settings: this.publicSettings(),
      contacts: store.getContacts(),
      chats: this.chatsForClient(),
      logs: store.getLogs(),
      stats: this.stats(),
    };
  }

  /** Never leak API keys — only booleans + non-secret prefs. */
  publicSettings() {
    const s = store.getSettings();
    return {
      groqModel: s.groqModel,
      geminiModel: s.geminiModel,
      systemPrompt: s.systemPrompt,
      autoReplyEnabled: s.autoReplyEnabled,
      replyDelayMs: s.replyDelayMs,
      replyToGroups: s.replyToGroups,
      language: s.language,
      tone: s.tone,
      ownerProfile: s.ownerProfile,
      whisperModel: s.whisperModel,
      voiceReplies: s.voiceReplies,
      ttsModel: s.ttsModel,
      ttsVoice: s.ttsVoice,
      chatFallbacks: s.chatFallbacks || [],
      visionFallbacks: s.visionFallbacks || [],
      hasGroqKey: !!s.groqApiKey,
      hasGeminiKey: !!s.geminiApiKey,
      accessKeyLocked: store.accessKeyLocked(),
    };
  }

  pushSettings() {
    this.emit("settings", this.publicSettings());
  }
  pushContacts() {
    this.emit("contacts", store.getContacts());
    this.emit("stats", this.stats());
  }
  pushChats() {
    this.emit("chats", this.chatsForClient());
    this.emit("stats", this.stats());
  }
  pushLog(entry) {
    this.emit("log", entry);
    this.emit("stats", this.stats());
  }

  /**
   * Stats based on real CHATS (not the raw address book), so the numbers match
   * what you actually see in the chat list.
   */
  stats() {
    const base = store.stats();
    const chats = this.chatsForClient();
    return {
      received: base.received,
      sent: base.sent,
      enabledContacts: chats.filter((c) => c.enabled).length,
      totalContacts: chats.length,
    };
  }

  chatsForClient() {
    const list = [];
    for (const c of this.chatMeta.values()) {
      const contact = store.getContact(c.id) || {};
      list.push({
        ...c,
        enabled: !!contact.enabled,
        language: contact.language || "default",
        tone: contact.tone || "default",
        voiceReply: contact.voiceReply || "default",
        customPrompt: contact.customPrompt || "",
      });
    }
    return list.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
  }

  nameFor(id) {
    const m = this.chatMeta.get(id);
    if (m) return m.name;
    const c = store.getContact(id);
    return c?.name || id.split("@")[0];
  }

  /* ------------------------- lifecycle ------------------------- */

  async init() {
    if (this.client) return;
    this.setStatus("initializing");

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: process.env.WWEBJS_DIR || path.join(process.cwd(), ".wwebjs_auth"),
      }),
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      },
    });

    this.client.on("qr", async (qr) => {
      try {
        this.qrDataUrl = await qrcode.toDataURL(qr, { margin: 1, width: 320 });
      } catch {
        this.qrDataUrl = null;
      }
      this.setStatus("qr");
      console.log("[wa] QR ready — scan from the dashboard.");
    });

    this.client.on("loading_screen", (percent) => this.setStatus("authenticating", { percent }));
    this.client.on("authenticated", () => {
      this.qrDataUrl = null;
      this.setStatus("authenticating");
    });
    this.client.on("auth_failure", (msg) => {
      this.lastError = "Authentication failed: " + msg;
      this.setStatus("error");
    });

    this.client.on("ready", async () => {
      this.qrDataUrl = null;
      this.lastError = null;
      const info = this.client.info;
      this.me = { number: info?.wid?.user || "", name: info?.pushname || "" };
      this.setStatus("connected");
      console.log(`[wa] connected as ${this.me.name} (${this.me.number})`);
      this.refreshChats().catch((e) => console.error("[wa] refreshChats:", e.message));
    });

    this.client.on("disconnected", (reason) => {
      this.me = null;
      this.lastError = "Disconnected: " + reason;
      this.setStatus("disconnected");
      console.log("[wa] disconnected:", reason);
    });

    // Register BOTH events. message_create fires for all messages (both
    // directions) which keeps chats in sync; message is a reliable incoming
    // trigger. handleMessage is idempotent (dedupes by id), so double-firing
    // is harmless — this is what fixes "not receiving messages".
    this.client.on("message_create", (msg) =>
      this.handleMessage(msg).catch((e) => console.error("[wa] handle:", e.message))
    );
    this.client.on("message", (msg) =>
      this.handleMessage(msg).catch((e) => console.error("[wa] handle:", e.message))
    );
    // Delivery/read receipts → live tick updates.
    this.client.on("message_ack", (msg, ack) => this.handleAck(msg, ack));

    try {
      await this.client.initialize();
    } catch (e) {
      this.lastError = e.message;
      this.setStatus("error");
      console.error("[wa] init failed:", e.message);
    }
  }

  async logout() {
    try {
      if (this.client) {
        await this.client.logout();
        await this.client.destroy();
      }
    } catch (e) {
      console.error("[wa] logout error:", e.message);
    }
    this.client = null;
    this.me = null;
    this.qrDataUrl = null;
    this.chatMeta.clear();
    this.messages.clear();
    this.setStatus("idle");
    setTimeout(() => this.init().catch(() => {}), 800);
  }

  async restart() {
    try {
      if (this.client) await this.client.destroy();
    } catch {}
    this.client = null;
    this.setStatus("idle");
    setTimeout(() => this.init().catch(() => {}), 500);
  }

  /* ------------------------- chat sync ------------------------- */

  /**
   * The real phone number for a chat. WhatsApp now uses privacy "LID"
   * ids (e.g. 33247492894754@lid) whose id.user is NOT a phone number, so we
   * resolve the underlying contact's actual number.
   */
  async realNumber(chat) {
    try {
      const c = await chat.getContact();
      return (c && c.number) || (c && c.id && c.id.user) || chat.id.user;
    } catch {
      return chat.id.user;
    }
  }

  async refreshChats() {
    if (!this.client || this.status !== "connected") return this.chatsForClient();
    const replyToGroups = store.getSettings().replyToGroups;
    try {
      const chats = await this.client.getChats();
      for (const chat of chats) {
        if (chat.isGroup && !replyToGroups) continue;
        const id = chat.id._serialized;
        const number = await this.realNumber(chat);
        const name = chat.name || number;
        const last = chat.lastMessage;
        this.chatMeta.set(id, {
          id,
          name,
          number,
          isGroup: !!chat.isGroup,
          lastText: last ? last.body || typeLabel(last.type) : "",
          lastTs: chat.timestamp ? chat.timestamp * 1000 : last?.timestamp ? last.timestamp * 1000 : 0,
          unread: chat.unreadCount || 0,
        });
        store.mergeContacts([{ id, name, number }]);
      }
      this.pushChats();
      this.pushContacts();
      console.log(`[wa] synced ${this.chatMeta.size} chats`);
    } catch (e) {
      console.error("[wa] refreshChats failed:", e.message);
    }
    return this.chatsForClient();
  }

  /** Kept for the old event name. */
  refreshContacts() {
    return this.refreshChats();
  }

  serializeMsg(m, chatId) {
    const t = typeOf(m.type);
    return {
      id: m.id?._serialized || `${chatId}-${m.timestamp || Date.now()}`,
      chatId,
      fromMe: !!m.fromMe,
      type: t,
      text: m.body || (t !== "text" ? typeLabel(m.type) : ""),
      ts: m.timestamp ? m.timestamp * 1000 : Date.now(),
      model: null,
      isAutoReply: false,
      // WhatsApp delivery status: -1 error, 0 pending, 1 sent, 2 delivered,
      // 3 read, 4 played. Drives the tick marks in the UI.
      ack: typeof m.ack === "number" ? m.ack : 1,
    };
  }

  /** A sent message's delivery status changed → update its ticks. */
  handleAck(msg, ack) {
    try {
      const id = msg.id?._serialized;
      if (!id) return;
      for (const [chatId, arr] of this.messages) {
        const i = arr.findIndex((x) => x.id === id);
        if (i >= 0) {
          arr[i] = { ...arr[i], ack };
          this.emit("message", { chatId, message: arr[i] });
          return;
        }
      }
    } catch {}
  }

  recordMessage(chatId, rec) {
    let arr = this.messages.get(chatId);
    if (!arr) {
      arr = [];
      this.messages.set(chatId, arr);
    }
    const i = arr.findIndex((x) => x.id === rec.id);
    if (i >= 0) {
      // Merge — keep a model/isAutoReply tag if we already have one.
      arr[i] = { ...arr[i], ...rec, model: rec.model || arr[i].model, isAutoReply: rec.isAutoReply || arr[i].isAutoReply };
    } else {
      arr.push(rec);
      if (arr.length > MSGS_PER_CHAT) arr.splice(0, arr.length - MSGS_PER_CHAT);
    }
    // Update the chat preview — but NOT for private @bot/@yati asides (they
    // must not leak into the chat list).
    const meta = this.chatMeta.get(chatId);
    if (meta && !rec.private) {
      meta.lastText = rec.text || typeLabel(rec.type);
      meta.lastTs = rec.ts;
      if (!rec.fromMe) meta.unread = (meta.unread || 0) + 1;
    }
    this.emit("message", { chatId, message: arr[i >= 0 ? i : arr.length - 1] });
    if (!rec.private) this.pushChats();
  }

  /**
   * Private assistant side-channel for an open chat. The owner's "@bot ..."
   * command and the bot's "@yati ..." reply are recorded as private messages
   * (shown only in the UI) and are NEVER sent to the other person.
   */
  async chatAssistant(chatId, text) {
    const settings = store.getSettings();
    if (!settings.groqApiKey) return { ok: false, reply: "Set your Groq API key in Settings first." };

    const name = this.nameFor(chatId);
    const now = Date.now();
    // Record the owner's private command.
    this.recordMessage(chatId, {
      id: `priv-${++this.privSeq}`,
      chatId,
      fromMe: true,
      private: true,
      type: "text",
      text: `@bot ${text}`,
      ts: now,
      model: null,
    });

    // Build context from the real conversation.
    let context = [];
    try {
      const chat = await this.client.getChatById(chatId);
      context = await this.buildContext(chat);
    } catch {}

    const persona = this.composePersona(store.getContact(chatId));
    const system =
      `${persona}\n\nYou are now in a PRIVATE side-channel with your owner (Yati), who is looking at the WhatsApp chat with ${name}. ` +
      "The recent conversation with that person is provided as context. Your owner will ask you things privately — to discuss the chat, draft a reply, explain something, or just chat. " +
      "Reply ONLY to your owner and address them as \"@yati\". This message is PRIVATE — it is NOT sent to " +
      `${name}. Be concise and genuinely helpful.`;

    let reply;
    try {
      const r = await this.runChat({ systemPrompt: system, history: context, text });
      reply = r.text;
    } catch (e) {
      reply = `Sorry, I hit an error: ${e.message}`;
    }
    if (!/^@yati/i.test(reply)) reply = `@yati ${reply}`;

    this.recordMessage(chatId, {
      id: `priv-${++this.privSeq}`,
      chatId,
      fromMe: false,
      private: true,
      type: "text",
      text: reply,
      ts: Date.now(),
      model: null,
    });

    return { ok: true, reply };
  }

  async openChat(chatId) {
    let msgs = this.messages.get(chatId);
    if (!msgs || msgs.length === 0) {
      try {
        const chat = await this.client.getChatById(chatId);
        const fetched = await chat.fetchMessages({ limit: 40 });
        msgs = fetched.map((m) => this.serializeMsg(m, chatId));
        this.messages.set(chatId, msgs);
        try {
          await chat.sendSeen();
        } catch {}
      } catch (e) {
        console.error("[wa] openChat failed:", e.message);
        msgs = [];
      }
    }
    const meta = this.chatMeta.get(chatId);
    if (meta) {
      meta.unread = 0;
      this.pushChats();
    }
    return msgs;
  }

  /* ------------------------- context ------------------------- */

  async buildContext(chat) {
    try {
      const fetched = await chat.fetchMessages({ limit: CTX_MESSAGES + 4 });
      const hist = [];
      for (const m of fetched) {
        if (m.type !== "chat" || !m.body) continue;
        hist.push({ role: m.fromMe ? "assistant" : "user", content: m.body });
      }
      // Drop the final entry (the current incoming message is added separately).
      if (hist.length && hist[hist.length - 1].role === "user") hist.pop();
      return hist.slice(-CTX_MESSAGES);
    } catch {
      return [];
    }
  }

  composePersona(contact) {
    const s = store.getSettings();
    const base = (contact?.customPrompt && contact.customPrompt.trim()) || s.systemPrompt;
    const tone = resolveTone(contact?.tone, s.tone);
    const lang = resolveLanguage(contact?.language, s.language);

    const parts = [base];
    if (s.ownerProfile && s.ownerProfile.trim()) {
      parts.push(
        `ABOUT YOUR OWNER (the person you reply on behalf of):\n${s.ownerProfile.trim()}\n` +
          "NEVER insult, mock or disrespect your owner. If someone asks about your owner, answer helpfully from this. " +
          "If someone is rude or explicitly asks you to, you may roast THAT person — but never the owner."
      );
    }
    parts.push(toneInstruction(tone));
    parts.push(languageInstruction(lang));
    parts.push(
      "CONTEXT RULE (critical): Never reply without understanding the conversation. Always read the previous messages in this chat first and make your reply fit that context. If someone asks about something you have no information about, be honest — say you don't remember or don't know (e.g. \"sorry, I don't remember that\") instead of making things up."
    );
    return parts.join("\n\n");
  }

  /* ------------------------- fallback chains ------------------------- */

  chatChain() {
    const s = store.getSettings();
    return [{ provider: "groq", model: s.groqModel }, ...(s.chatFallbacks || [])];
  }
  visionChain() {
    const s = store.getSettings();
    return [{ provider: "gemini", model: s.geminiModel }, ...(s.visionFallbacks || [])];
  }

  /** Try each text model in the chain until one succeeds. */
  async runChat({ systemPrompt, history, text }) {
    const s = store.getSettings();
    const errs = [];
    for (const step of this.chatChain()) {
      if (!step || !step.model) continue;
      try {
        if (step.provider === "groq") {
          const t = await groqChat({ apiKey: s.groqApiKey, model: step.model, systemPrompt, history, text });
          return { text: t, used: `Groq · ${step.model}` };
        }
        if (step.provider === "gemini") {
          const t = await geminiText({ apiKey: s.geminiApiKey, model: step.model, systemPrompt, history, text });
          return { text: t, used: `Gemini · ${step.model}` };
        }
      } catch (e) {
        errs.push(`${step.provider}/${step.model}: ${e.message}`);
        console.warn(`[wa] chat model failed (${step.provider}/${step.model}) → trying next:`, e.message);
      }
    }
    throw new Error("All chat models failed — " + errs.join(" | "));
  }

  /** Try each vision model in the chain until one succeeds. */
  async runVision({ systemPrompt, caption, mimeType, base64 }) {
    const s = store.getSettings();
    const errs = [];
    for (const step of this.visionChain()) {
      if (!step || !step.model) continue;
      try {
        if (step.provider === "gemini") {
          const t = await geminiVisionReply({ apiKey: s.geminiApiKey, model: step.model, systemPrompt, caption, mimeType, base64 });
          return { text: t, used: `Gemini · ${step.model}` };
        }
        if (step.provider === "groq") {
          const t = await groqVision({ apiKey: s.groqApiKey, model: step.model, systemPrompt, caption, mimeType, base64 });
          return { text: t, used: `Groq · ${step.model}` };
        }
      } catch (e) {
        errs.push(`${step.provider}/${step.model}: ${e.message}`);
        console.warn(`[wa] vision model failed (${step.provider}/${step.model}) → trying next:`, e.message);
      }
    }
    throw new Error("All vision models failed — " + errs.join(" | "));
  }

  /** Discover available models for the configured keys (for the Settings UI). */
  async fetchModels() {
    const s = store.getSettings();
    return fetchAll(s.groqApiKey, s.geminiApiKey);
  }

  /** Synthesize a short sample so the user can hear a TTS voice before picking it. */
  async previewVoice({ voice, model, text } = {}) {
    const s = store.getSettings();
    const sample = text || "Hey! This is how I'll sound in your WhatsApp voice replies.";
    return synthesizeSpeech({
      apiKey: s.groqApiKey,
      model: model || s.ttsModel,
      voice: voice || s.ttsVoice,
      text: sample,
    });
  }

  /* ------------------------- message pipeline ------------------------- */

  async handleMessage(msg) {
    const settings = store.getSettings();
    let chat;
    try {
      chat = await msg.getChat();
    } catch {
      return;
    }
    if (chat.isGroup && !settings.replyToGroups) return;

    const chatId = chat.id._serialized;
    const number = this.chatMeta.get(chatId)?.number || (await this.realNumber(chat));
    const name = chat.name || number;

    // Ensure the chat + contact exist and are in the list.
    if (!this.chatMeta.has(chatId)) {
      this.chatMeta.set(chatId, {
        id: chatId,
        name,
        number,
        isGroup: !!chat.isGroup,
        lastText: "",
        lastTs: 0,
        unread: 0,
      });
      store.mergeContacts([{ id: chatId, name, number }]);
    }

    // Record for the conversation view (both directions → true sync).
    const rec = this.serializeMsg(msg, chatId);
    this.recordMessage(chatId, rec);

    // Only auto-reply to incoming messages, once per id.
    if (msg.fromMe) return;
    if (this.replied.has(rec.id)) return;
    if (!settings.autoReplyEnabled) return;
    if (!store.isEnabled(chatId)) return;

    this.replied.add(rec.id);
    if (this.replied.size > 500) this.replied = new Set([...this.replied].slice(-300));

    const contact = store.getContact(chatId);
    const persona = this.composePersona(contact);
    const isImage = msg.hasMedia && msg.type === "image";
    const isVoice = msg.type === "ptt" || msg.type === "audio";

    let reply = null;
    let usedModel = null;
    let transcript = null;
    try {
      if (isImage) {
        const media = await msg.downloadMedia();
        if (!media) throw new Error("could not download image");
        const r = await this.runVision({
          systemPrompt: persona,
          caption: msg.body,
          mimeType: media.mimetype,
          base64: media.data,
        });
        reply = r.text;
        usedModel = r.used;
      } else if (isVoice) {
        const media = await msg.downloadMedia();
        if (!media) throw new Error("could not download voice note");
        transcript = await transcribeAudio({
          apiKey: settings.groqApiKey,
          model: settings.whisperModel,
          base64: media.data,
          mimetype: media.mimetype,
        });
        // Show what they said in the conversation view.
        rec.text = `🎤 “${transcript}”`;
        this.recordMessage(chatId, rec);
        if (!transcript) return;
        const context = await this.buildContext(chat);
        const r = await this.runChat({ systemPrompt: persona, history: context, text: transcript });
        reply = r.text;
        usedModel = `Whisper + ${r.used}`;
      } else {
        if (!msg.body || !msg.body.trim()) return;
        const context = await this.buildContext(chat);
        const r = await this.runChat({ systemPrompt: persona, history: context, text: msg.body });
        reply = r.text;
        usedModel = r.used;
      }
    } catch (e) {
      const errLog = store.addLog({
        contactId: chatId,
        name,
        direction: "error",
        type: "text",
        text: `Auto-reply failed: ${e.message}`,
        model: usedModel,
        ts: Date.now(),
      });
      this.pushLog(errLog);
      console.error("[wa] reply generation failed:", e.message);
      return;
    }

    if (settings.replyDelayMs > 0) {
      await new Promise((r) => setTimeout(r, settings.replyDelayMs));
    }

    // Decide voice vs text reply.
    const voicePref = contact?.voiceReply || "default";
    const wantVoice =
      isVoice && (voicePref === "voice" || (voicePref === "default" && settings.voiceReplies));

    await this.sendReply(chatId, reply, usedModel, wantVoice, settings, name);
  }

  async sendReply(chatId, text, usedModel, wantVoice, settings, name) {
    // Best-effort voice reply; always falls back to text.
    if (wantVoice) {
      try {
        const audio = await synthesizeSpeech({
          apiKey: settings.groqApiKey,
          model: settings.ttsModel,
          voice: settings.ttsVoice,
          text,
        });
        const media = new MessageMedia(audio.mimetype, audio.base64, "reply.wav");
        const sent = await this.client.sendMessage(chatId, media, { sendAudioAsVoice: true });
        const rec = this.serializeMsg(sent, chatId);
        rec.fromMe = true;
        rec.type = "voice";
        rec.text = `🎤 ${text}`;
        rec.model = `${usedModel} + TTS`;
        rec.isAutoReply = true;
        this.recordMessage(chatId, rec);
        this.pushLog(store.addLog({ contactId: chatId, name, direction: "out", type: "voice", text, model: rec.model, ts: Date.now() }));
        return;
      } catch (e) {
        console.error("[wa] voice reply failed, falling back to text:", e.message);
      }
    }
    try {
      const sent = await this.client.sendMessage(chatId, text);
      const rec = this.serializeMsg(sent, chatId);
      rec.fromMe = true;
      rec.model = usedModel;
      rec.isAutoReply = true;
      this.recordMessage(chatId, rec);
      this.pushLog(store.addLog({ contactId: chatId, name, direction: "out", type: "text", text, model: usedModel, ts: Date.now() }));
    } catch (e) {
      console.error("[wa] send failed:", e.message);
    }
  }

  /** Manual send (from chat composer or the orb). */
  async sendManual(chatId, text) {
    if (!this.client || this.status !== "connected") throw new Error("WhatsApp not connected");
    const sent = await this.client.sendMessage(chatId, text);
    const rec = this.serializeMsg(sent, chatId);
    rec.fromMe = true;
    rec.model = null;
    this.recordMessage(chatId, rec);
    return rec;
  }

  /* ------------------------- orb command brain ------------------------- */

  resolveTarget(target) {
    if (!target) return null;
    const t = String(target).toLowerCase().replace(/[^a-z0-9]/g, "");
    const digits = String(target).replace(/\D/g, "");

    if (digits && digits.length >= 6) {
      for (const c of this.chatMeta.values()) {
        if (c.number.replace(/\D/g, "").endsWith(digits)) return c.id;
      }
    }
    if (t) {
      for (const c of this.chatMeta.values()) {
        const n = c.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (n && (n.includes(t) || t.includes(n))) return c.id;
      }
      for (const c of store.getContacts()) {
        const n = (c.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (n && (n.includes(t) || t.includes(n))) return c.id;
      }
    }
    return null;
  }

  async handleCommand(text, activeChatId) {
    const settings = store.getSettings();
    if (!settings.groqApiKey) return { ok: false, reply: "Set your Groq API key in Settings first." };

    const activeName = activeChatId ? this.nameFor(activeChatId) : null;
    let action;
    try {
      action = await interpretCommand({
        apiKey: settings.groqApiKey,
        model: settings.groqModel,
        text,
        contacts: store.getContacts(),
        activeChat: activeName,
      });
    } catch (e) {
      return { ok: false, reply: `Sorry, I hit an error: ${e.message}` };
    }

    // Resolve "this/current chat" (or an empty target) to the open chat.
    const resolve = (target) => {
      const t = String(target || "").toLowerCase().trim();
      if (!target || /^(this|current|open|here|it)( chat)?$/.test(t)) return activeChatId || null;
      return this.resolveTarget(target);
    };

    const A = action?.action;
    try {
      if (A === "discuss") {
        if (!activeChatId) return { ok: false, reply: "Open a chat first, then ask me about it." };
        return this.chatAssistant(activeChatId, action.message || text);
      }
      if (A === "send_message") {
        const id = resolve(action.target);
        if (!id) return { ok: false, reply: `I couldn't find a chat matching "${action.target}".` };
        await this.sendManual(id, action.message);
        return { ok: true, reply: `Sent to ${this.nameFor(id)}: "${action.message}"`, action };
      }
      if (A === "open_chat") {
        const id = resolve(action.target);
        if (!id) return { ok: false, reply: `I couldn't find "${action.target}".` };
        await this.openChat(id);
        return { ok: true, reply: `Opening your chat with ${this.nameFor(id)}.`, action: { action: "open_chat", chatId: id, name: this.nameFor(id) } };
      }
      if (A === "set_chat_language") {
        const id = resolve(action.target);
        if (!id) return { ok: false, reply: `I couldn't find "${action.target}".` };
        store.setContact(id, { language: action.language });
        this.pushChats();
        return { ok: true, reply: `${this.nameFor(id)}'s replies will now be in ${action.language}.`, action };
      }
      if (A === "set_chat_tone") {
        const id = resolve(action.target);
        if (!id) return { ok: false, reply: `I couldn't find "${action.target}".` };
        store.setContact(id, { tone: action.tone });
        this.pushChats();
        return { ok: true, reply: `${this.nameFor(id)}'s tone is now ${action.tone}.`, action };
      }
      if (A === "set_chat_voice") {
        const id = resolve(action.target);
        if (!id) return { ok: false, reply: `I couldn't find "${action.target}".` };
        store.setContact(id, { voiceReply: action.voiceReply });
        this.pushChats();
        return { ok: true, reply: `${this.nameFor(id)} voice-reply set to ${action.voiceReply}.`, action };
      }
      if (A === "toggle_autoreply") {
        const id = resolve(action.target);
        if (!id) return { ok: false, reply: `I couldn't find "${action.target}".` };
        store.setContact(id, { enabled: !!action.enabled });
        this.pushChats();
        this.pushContacts();
        return { ok: true, reply: `Auto-reply ${action.enabled ? "ON" : "OFF"} for ${this.nameFor(id)}.`, action };
      }
      if (A === "set_global_language") {
        store.updateSettings({ language: action.language });
        this.pushSettings();
        return { ok: true, reply: `Global reply language set to ${action.language}.`, action };
      }
      if (A === "set_global_tone") {
        store.updateSettings({ tone: action.tone });
        this.pushSettings();
        return { ok: true, reply: `Global tone set to ${action.tone}.`, action };
      }
      if (A === "set_reply_delay") {
        const ms = Math.max(0, Number(action.ms) || 0);
        store.updateSettings({ replyDelayMs: ms });
        this.pushSettings();
        return { ok: true, reply: `Reply delay set to ${ms}ms.`, action };
      }
      if (A === "toggle_master") {
        store.updateSettings({ autoReplyEnabled: !!action.enabled });
        this.pushSettings();
        return { ok: true, reply: `Auto-reply is now ${action.enabled ? "active" : "paused"}.`, action };
      }
      return { ok: true, reply: action?.message || "Okay.", action };
    } catch (e) {
      return { ok: false, reply: `Something went wrong: ${e.message}` };
    }
  }
}

if (!globalThis.__waController) {
  globalThis.__waController = new WAController();
}

module.exports = globalThis.__waController;
