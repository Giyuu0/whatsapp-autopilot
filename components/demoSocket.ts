"use client";

/**
 * A stand-in for the Socket.IO connection, used only by the public demo
 * (NEXT_PUBLIC_DEMO=1, served as a static site with no server).
 *
 * It speaks the same events as server.js, backed by a handful of fictional
 * chats, and plays the app's core loop on a timer: a message arrives, the
 * typing indicator shows, and an AI reply goes out — but only for the chats
 * switched on. Toggles, settings, the @bot aside and the assistant orb all
 * respond, so the dashboard can be explored for real. Nothing leaves the
 * browser and every person in it is made up.
 */
import type { Chat, Contact, LogEntry, Message, Settings, Snapshot } from "./useWaSocket";

export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

type Handler = (...args: any[]) => void;

const MIN = 60_000;
const REPLY_MODEL = "openai/gpt-oss-120b";

let seq = 0;
const nextId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

function chat(
  id: string,
  name: string,
  over: Partial<Chat> = {}
): Chat {
  return {
    id,
    name,
    number: "",
    isGroup: false,
    lastText: "",
    lastTs: Date.now(),
    unread: 0,
    enabled: false,
    language: "default",
    tone: "default",
    voiceReply: "default",
    manualReply: "default",
    personaMode: "off",
    gender: "",
    ...over,
  };
}

/** Build the fictional history once, relative to "now". */
function buildFixtures() {
  const now = Date.now();
  const at = (minsAgo: number) => now - minsAgo * MIN;
  const m = (
    chatId: string,
    minsAgo: number,
    fromMe: boolean,
    text: string,
    extra: Partial<Message> = {}
  ): Message => ({
    id: nextId("m"),
    chatId,
    fromMe,
    type: "text",
    text,
    ts: at(minsAgo),
    model: null,
    ack: fromMe ? 3 : undefined,
    ...extra,
  });
  const ai = (chatId: string, minsAgo: number, text: string) =>
    m(chatId, minsAgo, true, text, { isAutoReply: true, model: REPLY_MODEL });

  const msgs: Record<string, Message[]> = {
    priya: [
      m("priya", 190, false, "heyy did you watch the new episode??"),
      ai("priya", 189, "not yet 😭 no spoilers pls, weekend plan hai"),
      m("priya", 64, false, "ok ok. coffee tomorrow?"),
      ai("priya", 63, "haan done ☕ 5 baje usual place?"),
      m("priya", 62, false, "perfect 🙌"),
    ],
    rahul: [
      m("rahul", 240, false, "Hi, could you share the deck before the 4pm review?"),
      ai("rahul", 239, "Sure — sending it over within the hour. Anything specific you want me to cover?"),
      m("rahul", 238, false, "Just the Q3 numbers, thanks!"),
      ai("rahul", 237, "Got it, I'll make sure the Q3 slide is up front."),
    ],
    mom: [
      m("mom", 30, false, "Beta khana kha liya?"),
      m("mom", 29, false, "Call me when free"),
    ],
    gym: [
      m("gym", 120, false, "Leg day tomorrow 6am, no excuses 🦵"),
      m("gym", 95, false, "who's in?"),
    ],
    arjun: [
      m("arjun", 50, false, "bro can you lend me your camera for the trip?"),
    ],
    neha: [
      m("neha", 15, false, "Reached home safe, thanks for the ride!", { type: "voice" }),
      ai("neha", 14, "yay good to hear 😊 sleep well!"),
    ],
  };

  const chats: Chat[] = [
    chat("priya", "Priya", { number: "1 202 555 0101", enabled: true, tone: "friendly", language: "hinglish", favorite: true, gender: "female" }),
    chat("rahul", "Rahul (work)", { number: "1 202 555 0102", enabled: true, tone: "professional", language: "english", gender: "male" }),
    chat("neha", "Neha", { number: "1 202 555 0103", enabled: true, tone: "friendly", voiceReply: "voice", gender: "female" }),
    chat("arjun", "Arjun", { number: "1 202 555 0104", enabled: true, manualReply: "on", gender: "male" }),
    chat("mom", "Mom ❤️", { number: "1 202 555 0105", favorite: true, unread: 2 }),
    chat("gym", "Gym Buddies 💪", { number: "1 202 555 0106", isGroup: true, unread: 1 }),
  ];
  for (const c of chats) {
    const last = msgs[c.id]?.[msgs[c.id].length - 1];
    if (last) {
      c.lastText = last.text;
      c.lastTs = last.ts;
    }
  }

  const contacts: Contact[] = chats
    .filter((c) => !c.isGroup)
    .map((c) => ({
      id: c.id,
      name: c.name,
      number: c.number,
      enabled: c.enabled,
      language: c.language,
      tone: c.tone,
      voiceReply: c.voiceReply,
      manualReply: c.manualReply,
      favorite: c.favorite,
      personaMode: c.personaMode,
      gender: c.gender,
    }));

  const settings: Settings = {
    chatChain: [
      { provider: "groq", model: "openai/gpt-oss-120b" },
      { provider: "groq", model: "openai/gpt-oss-20b" },
      { provider: "gemini", model: "gemini-flash-lite-latest" },
    ],
    visionChain: [
      { provider: "groq", model: "qwen/qwen3.8-27b" },
      { provider: "gemini", model: "gemini-flash-lite-latest" },
    ],
    hasSystemPrompt: true,
    autoReplyEnabled: true,
    replyDelayMs: 2500,
    replyToGroups: false,
    manualReply: false,
    hideSensitive: true,
    typingIndicator: true,
    attentionAlerts: true,
    attentionHold: true,
    groqOnly: false,
    language: "auto",
    tone: "friendly",
    hasOwnerProfile: true,
    whisperModel: "whisper-large-v3-turbo",
    voiceReplies: true,
    ttsModel: "canopylabs/orpheus-v1-english",
    ttsVoice: "hannah",
    hasGroqKey: true,
    groqKeyCount: 1,
    hasGeminiKey: true,
    accessKeyLocked: false,
  };

  const logs: LogEntry[] = [];
  for (const c of chats) {
    for (const msg of msgs[c.id] || []) {
      if (!msg.fromMe) {
        logs.push({ id: nextId("l"), contactId: c.id, name: c.name, direction: "in", type: msg.type === "voice" ? "voice" : "text", text: msg.text, model: null, ts: msg.ts });
      } else if (msg.isAutoReply) {
        logs.push({ id: nextId("l"), contactId: c.id, name: c.name, direction: "out", type: "text", text: msg.text, model: msg.model, ts: msg.ts });
      }
    }
  }
  logs.sort((a, b) => a.ts - b.ts);

  const snapshot: Snapshot = {
    status: "connected",
    qr: null,
    pairingCode: null,
    // 555-01xx numbers are reserved for fiction.
    me: { number: "1 202 555 0147", name: "You (demo)" },
    error: null,
    startedAt: at(300),
    settings,
    contacts,
    chats,
    logs,
    stats: { received: 0, sent: 0, enabledContacts: 0, totalContacts: 0 },
    sync: { syncing: false, done: 0, total: 0 },
    suggestions: {
      arjun: { text: "haan sure, bas wapas kar dena trip ke baad 📷", model: REPLY_MODEL, ts: at(49) },
    },
  };
  return { snapshot, msgs };
}

/** What people text next, and what the AI says back (in each chat's tone). */
const SCRIPT: { chatId: string; text: string; reply: string; attention?: string }[] = [
  { chatId: "priya", text: "wait which cafe were we going to 😅", reply: "the one near the metro — blue door wala ☕" },
  { chatId: "rahul", text: "Are you free for a quick call before the review?", reply: "", attention: "asking when you're free" },
  { chatId: "neha", text: "btw you left your charger in my car", reply: "omg thank you 🙈 I'll grab it tomorrow" },
  { chatId: "mom", text: "Sunday lunch at home ok?", reply: "" },
  { chatId: "arjun", text: "also do you have the tripod?", reply: "yes, tripod bhi le jaa — same case mein hai" },
  { chatId: "priya", text: "also bring the book you promised!!", reply: "haha yes yes, already in my bag 📚" },
  { chatId: "gym", text: "6am sharp tomorrow, don't be late", reply: "" },
];

export class DemoSocket {
  private handlers: Record<string, Handler[]> = {};
  private timers: ReturnType<typeof setTimeout>[] = [];
  private snap: Snapshot;
  private msgs: Record<string, Message[]>;
  private step = 0;
  private closed = false;

  constructor() {
    const { snapshot, msgs } = buildFixtures();
    this.snap = snapshot;
    this.msgs = msgs;
    this.recount();
    this.later(250, () => {
      this.fire("connect");
      this.fire("state", this.clone(this.snap));
    });
    // First live message soon after load, so visitors see the loop straight away.
    this.later(6_000, () => this.incoming());
  }

  on(event: string, fn: Handler) {
    (this.handlers[event] ||= []).push(fn);
    return this;
  }

  close() {
    this.closed = true;
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  emit(event: string, payload?: any, ack?: (res: any) => void) {
    const res = this.handle(event, payload);
    this.later(200 + Math.random() * 300, () => ack?.(res));
    return this;
  }

  // ── internals ────────────────────────────────────────────────────────────

  private fire(event: string, ...args: any[]) {
    if (this.closed) return;
    for (const fn of this.handlers[event] || []) fn(...args);
  }

  private later(ms: number, fn: () => void) {
    const t = setTimeout(() => !this.closed && fn(), ms);
    this.timers.push(t);
  }

  private clone<T>(v: T): T {
    return JSON.parse(JSON.stringify(v));
  }

  private chatById(id: string) {
    return this.snap.chats.find((c) => c.id === id);
  }

  private recount() {
    const people = this.snap.chats.filter((c) => !c.isGroup);
    let received = 0;
    let sent = 0;
    for (const arr of Object.values(this.msgs)) {
      for (const m of arr) {
        if (!m.fromMe) received++;
        else if (m.isAutoReply) sent++;
      }
    }
    this.snap.stats = {
      received,
      sent,
      enabledContacts: people.filter((c) => c.enabled).length,
      totalContacts: people.length,
    };
  }

  private pushStats() {
    this.recount();
    this.fire("stats", this.clone(this.snap.stats));
  }

  private log(entry: Omit<LogEntry, "id" | "ts">) {
    const full: LogEntry = { ...entry, id: nextId("l"), ts: Date.now() };
    this.snap.logs = [...this.snap.logs, full].slice(-250);
    this.fire("log", full);
  }

  private addMessage(chatId: string, message: Message, bumpUnread = false) {
    (this.msgs[chatId] ||= []).push(message);
    const c = this.chatById(chatId);
    if (c && !message.private) {
      c.lastText = message.text;
      c.lastTs = message.ts;
      if (bumpUnread) c.unread += 1;
      this.snap.chats = [c, ...this.snap.chats.filter((x) => x.id !== chatId)];
      this.fire("chats", this.clone(this.snap.chats));
    }
    this.fire("message", { chatId, message: this.clone(message) });
  }

  /** One turn of the demo loop: someone texts, and the AI answers if allowed to. */
  private incoming() {
    const line = SCRIPT[this.step++ % SCRIPT.length];
    const c = this.chatById(line.chatId);
    if (c) {
      const msg: Message = {
        id: nextId("m"),
        chatId: c.id,
        fromMe: false,
        type: "text",
        text: line.text,
        ts: Date.now(),
        model: null,
        attention: !!line.attention,
        attentionReason: line.attention,
      };
      this.addMessage(c.id, msg, true);
      this.log({ contactId: c.id, name: c.name, direction: "in", type: "text", text: line.text, model: null });
      if (line.attention) {
        this.fire("attention", { chatId: c.id, name: c.name, text: line.text, reason: line.attention });
      }
      // A flagged message waits for you: the AI never commits to plans for you.
      if (!(line.attention && this.snap.settings.attentionHold)) this.maybeReply(c, line.reply);
      this.pushStats();
    }
    this.later(18_000 + Math.random() * 12_000, () => this.incoming());
  }

  private maybeReply(c: Chat, reply: string) {
    const s = this.snap.settings;
    if (!reply || !s.autoReplyEnabled || !c.enabled || (c.isGroup && !s.replyToGroups)) return;

    const manual = c.manualReply === "on" || (c.manualReply === "default" && s.manualReply);
    if (manual) {
      // Draft mode: the AI writes a suggestion but never sends it.
      const suggestion = { text: reply, model: REPLY_MODEL, ts: Date.now() };
      this.snap.suggestions = { ...this.snap.suggestions, [c.id]: suggestion };
      this.later(2_000, () => this.fire("suggestion", { chatId: c.id, suggestion }));
      return;
    }

    this.later(1_200, () => this.fire("typing", { chatId: c.id, on: true }));
    this.later(1_200 + Math.min(s.replyDelayMs, 4_000), () => {
      this.fire("typing", { chatId: c.id, on: false });
      const out: Message = {
        id: nextId("m"),
        chatId: c.id,
        fromMe: true,
        type: "text",
        text: reply,
        ts: Date.now(),
        model: REPLY_MODEL,
        isAutoReply: true,
        ack: 3,
      };
      this.addMessage(c.id, out);
      this.log({ contactId: c.id, name: c.name, direction: "out", type: "text", text: reply, model: REPLY_MODEL });
      this.pushStats();
    });
  }

  private patchChat(id: string, patch: Partial<Chat>) {
    this.snap.chats = this.snap.chats.map((c) => (c.id === id ? { ...c, ...patch } : c));
    this.snap.contacts = this.snap.contacts.map((c) => (c.id === id ? { ...c, ...(patch as Partial<Contact>) } : c));
    this.fire("chats", this.clone(this.snap.chats));
    this.fire("contacts", this.clone(this.snap.contacts));
    this.pushStats();
  }

  private assistantReply(text: string, chatId?: string) {
    const t = text.toLowerCase();
    const who = this.snap.chats.find((c) => t.includes(c.name.toLowerCase().split(/[ (]/)[0]));
    const s = this.snap.settings;

    // "Message Rahul I'll be late" — send it for you.
    const send = text.match(/^(?:message|text|tell)\s+(\S+)\s+(?:that\s+)?(.+)$/i);
    if (who && send) {
      const body = send[2].trim();
      this.handle("message:send", { chatId: who.id, text: body });
      return { ok: true, reply: `Sent to ${who.name}: “${body}”`, action: { action: "open_chat", chatId: who.id } };
    }
    if (/\b(pause|stop|turn off|disable)\b.*\bauto-?reply\b/.test(t) && !who) {
      this.handle("settings:update", { autoReplyEnabled: false });
      return { ok: true, reply: "Auto-reply is paused for everyone. Say “resume auto-reply” to switch it back on." };
    }
    if (/\b(resume|start|turn on|enable)\b.*\bauto-?reply\b/.test(t) && !who) {
      this.handle("settings:update", { autoReplyEnabled: true });
      return { ok: true, reply: "Auto-reply is back on for the chats you've enabled." };
    }
    const here = chatId ? this.chatById(chatId) : undefined;
    if (/\b(this chat|about this)\b/.test(t)) {
      return {
        ok: true,
        reply: here
          ? `${here.name}: ${this.msgs[here.id]?.length || 0} messages, auto-reply ${here.enabled ? "on" : "off"}, tone ${here.tone}. The real assistant would summarise the conversation too.`
          : "Open a chat first, then ask me about it.",
      };
    }
    if (/\bin hindi\b/.test(t)) {
      return { ok: true, reply: "In the real app I'd write that reply in Hindi for you. The demo doesn't call the AI, so try toggling someone instead." };
    }
    if (who && /\b(turn on|enable|start|switch on)\b/.test(t)) {
      this.patchChat(who.id, { enabled: true });
      return { ok: true, reply: `Done — I'll reply to ${who.name} from now on.` };
    }
    if (who && /\b(turn off|disable|stop|switch off|pause)\b/.test(t)) {
      this.patchChat(who.id, { enabled: false });
      return { ok: true, reply: `Okay — I won't reply to ${who.name} any more.` };
    }
    if (who && /\b(open|show|go to)\b/.test(t)) {
      return { ok: true, reply: `Opening your chat with ${who.name}.`, action: { action: "open_chat", chatId: who.id } };
    }
    return {
      ok: true,
      reply:
        "In this demo I can switch auto-reply on or off for someone, or open a chat — try “turn off auto-reply for Rahul” or “open Priya”. The real assistant understands much more.",
    };
  }

  private handle(event: string, p: any): any {
    switch (event) {
      case "chat:open": {
        const id = String(p);
        const c = this.chatById(id);
        if (c && c.unread) this.patchChat(id, { unread: 0 });
        return { ok: true, messages: this.clone(this.msgs[id] || []) };
      }
      case "message:send": {
        const msg: Message = { id: nextId("m"), chatId: p.chatId, fromMe: true, type: "text", text: p.text, ts: Date.now(), model: null, ack: 1 };
        this.addMessage(p.chatId, msg);
        this.later(900, () => this.fire("message", { chatId: p.chatId, message: { ...msg, ack: 3 } }));
        return { ok: true };
      }
      case "message:sendMedia": {
        const isVoice = !!p.media?.asVoice || /^audio\//.test(p.media?.mimetype || "");
        const msg: Message = {
          id: nextId("m"), chatId: p.chatId, fromMe: true, type: isVoice ? "voice" : "image",
          text: p.media?.caption || "", ts: Date.now(), model: null, ack: 3,
          media: p.media?.base64 ? `data:${p.media.mimetype};base64,${p.media.base64}` : null,
        };
        this.addMessage(p.chatId, msg);
        return { ok: true };
      }
      case "message:delete":
      case "message:edit": {
        const arr = this.msgs[p.chatId] || [];
        const m = arr.find((x) => x.id === p.messageId);
        if (!m) return { ok: false, error: "not found" };
        if (event === "message:delete") Object.assign(m, { deleted: true, text: "" });
        else Object.assign(m, { edited: true, text: p.text });
        this.fire("message", { chatId: p.chatId, message: this.clone(m) });
        return { ok: true };
      }
      case "chat:assistant": {
        const aside: Message = { id: nextId("m"), chatId: p.chatId, fromMe: true, type: "text", text: `@bot ${p.text}`, ts: Date.now(), model: null, private: true };
        this.addMessage(p.chatId, aside);
        const c = this.chatById(p.chatId);
        this.later(1_200, () =>
          this.addMessage(p.chatId, {
            id: nextId("m"), chatId: p.chatId, fromMe: false, type: "text", ts: Date.now(), model: REPLY_MODEL, private: true,
            text: `@you ${c ? `${c.name.split(" ")[0]} seems relaxed —` : ""} in the real app I'd read this chat and answer privately. This is a demo, so I'm just waving 👋`,
          })
        );
        return { ok: true };
      }
      case "assistant:command":
        return this.assistantReply(String(p?.text || ""), p?.chatId);
      case "contact:update":
        this.patchChat(p.id, p.patch || {});
        return { ok: true };
      case "settings:update":
        this.snap.settings = { ...this.snap.settings, ...(p || {}) };
        this.fire("settings", this.clone(this.snap.settings));
        return { ok: true, settings: this.clone(this.snap.settings) };
      case "suggestion:clear": {
        const next = { ...this.snap.suggestions };
        delete next[p.chatId];
        this.snap.suggestions = next;
        this.fire("suggestion", { chatId: p.chatId, suggestion: null });
        return { ok: true };
      }
      case "logs:clear":
        this.snap.logs = [];
        this.fire("state", this.clone(this.snap));
        return { ok: true };
      case "composer:rewrite":
        return { ok: false, error: "Rewriting needs the AI — self-host to try it." };
      case "models:fetch":
        return {
          ok: true,
          groq: {
            all: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b", "whisper-large-v3", "whisper-large-v3-turbo", "canopylabs/orpheus-v1-english"],
            chat: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"],
            vision: ["qwen/qwen3.8-27b"],
            whisper: ["whisper-large-v3", "whisper-large-v3-turbo"],
            tts: ["canopylabs/orpheus-v1-english"],
          },
          gemini: {
            all: ["gemini-flash-latest", "gemini-flash-lite-latest"],
            chat: ["gemini-flash-latest", "gemini-flash-lite-latest"],
            vision: ["gemini-flash-latest", "gemini-flash-lite-latest"],
          },
          voices: ["troy", "hannah", "austin", "autumn"],
        };
      case "voice:preview":
        return { ok: false, error: "Voice previews need your own Groq key — self-host to hear them." };
      case "message:media":
        return { ok: false };
      case "pair:phone":
        return { ok: false, error: "This is a demo — there's no WhatsApp to pair." };
      default:
        // wa:logout, wa:restart, contacts:refresh … nothing to do in a demo.
        return { ok: true };
    }
  }
}
