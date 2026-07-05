"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export type Language = "default" | "auto" | "english" | "hindi" | "hinglish" | "english-slang";
export type VoiceReply = "default" | "voice" | "text";
export type Tone = "default" | "professional" | "friendly" | "flirty";
export type ManualReply = "default" | "on" | "off";
export type Suggestion = { text: string; model: string | null; ts: number };

export type Contact = {
  id: string;
  name: string;
  number: string;
  enabled: boolean;
  customPrompt?: string;
  language?: Language;
  tone?: Tone;
  voiceReply?: VoiceReply;
  manualReply?: ManualReply;
  memory?: string;
  favorite?: boolean;
};

export type Chat = {
  id: string;
  name: string;
  number: string;
  isGroup: boolean;
  lastText: string;
  lastTs: number;
  unread: number;
  enabled: boolean;
  language: Language;
  tone: Tone;
  voiceReply: VoiceReply;
  manualReply: ManualReply;
  memory: string;
  customPrompt?: string;
  favorite?: boolean;
};

export type Message = {
  id: string;
  chatId: string;
  fromMe: boolean;
  type: "text" | "image" | "voice" | "audio" | "other";
  text: string;
  ts: number;
  model: string | null;
  isAutoReply?: boolean;
  private?: boolean; // @bot/@yati aside — shown only to you, never sent to the person
  ack?: number; // WhatsApp delivery status: -1 err, 0 pending, 1 sent, 2 delivered, 3 read, 4 played
  media?: string | null; // image/audio preview as a data URL
  viewOnce?: boolean; // WhatsApp "view once" photo
  sticker?: boolean; // WhatsApp sticker (auto-previewed, rendered transparent)
  deleted?: boolean;
  edited?: boolean;
};

export type LogEntry = {
  id: string;
  contactId: string;
  name: string;
  direction: "in" | "out" | "error";
  type: "text" | "image" | "voice";
  text: string;
  model: string | null;
  ts: number;
};

export type Settings = {
  chatChain: ModelStep[];
  visionChain: ModelStep[];
  systemPrompt: string;
  autoReplyEnabled: boolean;
  replyDelayMs: number;
  replyToGroups: boolean;
  manualReply: boolean;
  hideSensitive: boolean;
  typingIndicator: boolean;
  contactMemoryEnabled: boolean;
  groqOnly: boolean;
  language: Exclude<Language, "default">; // "auto" | "english" | "hindi" | "hinglish" | "english-slang"
  tone: Exclude<Tone, "default">; // "professional" | "friendly" | "flirty"
  ownerProfile: string;
  whisperModel: string;
  voiceReplies: boolean;
  ttsModel: string;
  ttsVoice: string;
  hasGroqKey: boolean;
  hasGeminiKey: boolean;
  accessKeyLocked: boolean;
};

export type ModelStep = { provider: "groq" | "gemini"; model: string };

export type ModelsResult = {
  ok: boolean;
  groq: { all: string[]; chat: string[]; vision: string[]; whisper: string[]; tts: string[] };
  gemini: { all: string[]; chat: string[]; vision: string[] };
  voices: string[];
  errors?: { groq?: string; gemini?: string };
  error?: string;
};

export type VoicePreview = { ok: boolean; base64?: string; mimetype?: string; error?: string };

export type AuthState = "connecting" | "authed" | "unauthorized";

export type Stats = {
  received: number;
  sent: number;
  enabledContacts: number;
  totalContacts: number;
};

export type SyncState = { syncing: boolean; done: number; total: number };

export type Status =
  | "idle" | "initializing" | "qr" | "authenticating"
  | "connected" | "disconnected" | "error";

export type Snapshot = {
  status: Status;
  qr: string | null;
  me: { number: string; name: string } | null;
  error: string | null;
  loadingPercent?: number;
  startedAt: number;
  settings: Settings;
  contacts: Contact[];
  chats: Chat[];
  logs: LogEntry[];
  stats: Stats;
  sync: SyncState;
  suggestions: Record<string, Suggestion>;
};

const KEY_STORAGE = "wa_access_key";

export function useWaSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [authState, setAuthState] = useState<AuthState>("connecting");
  const [authError, setAuthError] = useState<string | null>(null);
  const [keyTick, setKeyTick] = useState(0);

  useEffect(() => {
    const key =
      typeof window !== "undefined" ? localStorage.getItem(KEY_STORAGE) || "" : "";

    if (!key) {
      setAuthState("unauthorized");
      return;
    }

    setAuthState("connecting");
    const socket = io({
      transports: ["websocket", "polling"],
      auth: { key },
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setAuthState("authed");
      setAuthError(null);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err: any) => {
      if (err?.message === "unauthorized") {
        setAuthState("unauthorized");
        setAuthError("Invalid access key. Please try again.");
        socket.close();
      }
    });

    socket.on("state", (s: Snapshot) => setSnap(s));
    socket.on("status", (p: any) =>
      setSnap((prev) =>
        prev ? { ...prev, status: p.status, qr: p.qr, me: p.me, error: p.error, loadingPercent: p.loadingPercent } : prev
      )
    );
    socket.on("settings", (settings: Settings) =>
      setSnap((prev) => (prev ? { ...prev, settings } : prev))
    );
    socket.on("contacts", (contacts: Contact[]) =>
      setSnap((prev) => (prev ? { ...prev, contacts } : prev))
    );
    socket.on("chats", (chats: Chat[]) =>
      setSnap((prev) => (prev ? { ...prev, chats } : prev))
    );
    socket.on("stats", (stats: Stats) =>
      setSnap((prev) => (prev ? { ...prev, stats } : prev))
    );
    socket.on("sync", (sync: SyncState) =>
      setSnap((prev) => (prev ? { ...prev, sync } : prev))
    );
    socket.on("typing", ({ chatId, on }: { chatId: string; on: boolean }) =>
      setTyping((prev) => ({ ...prev, [chatId]: on }))
    );
    socket.on("suggestion", ({ chatId, suggestion }: { chatId: string; suggestion: Suggestion | null }) =>
      setSnap((prev) => {
        if (!prev) return prev;
        const next = { ...prev.suggestions };
        if (suggestion) next[chatId] = suggestion;
        else delete next[chatId];
        return { ...prev, suggestions: next };
      })
    );
    socket.on("log", (entry: LogEntry) =>
      setSnap((prev) => (prev ? { ...prev, logs: [...prev.logs, entry].slice(-250) } : prev))
    );

    // Live message → append to that chat if we've loaded it.
    socket.on("message", ({ chatId, message }: { chatId: string; message: Message }) => {
      setMessages((prev) => {
        const arr = prev[chatId];
        if (!arr) return prev; // not loaded yet; will fetch on open
        const i = arr.findIndex((m) => m.id === message.id);
        const next = i >= 0 ? arr.map((m) => (m.id === message.id ? { ...m, ...message } : m)) : [...arr, message];
        return { ...prev, [chatId]: next.slice(-80) };
      });
      // Browser notification for a genuinely new incoming message while the tab
      // is in the background.
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        !message.fromMe &&
        !message.private &&
        document.hidden
      ) {
        try {
          new Notification("New WhatsApp message", { body: message.text || "", tag: chatId });
        } catch {}
      }
    });

    return () => {
      socket.close();
    };
  }, [keyTick]);

  const emit = useCallback((event: string, payload?: any) => {
    return new Promise<any>((resolve) => {
      const s = socketRef.current;
      if (!s) return resolve({ ok: false });
      s.emit(event, payload, (res: any) => resolve(res || { ok: true }));
    });
  }, []);

  const openChat = useCallback(
    async (chatId: string) => {
      const res = await emit("chat:open", chatId);
      if (res?.ok) {
        setMessages((prev) => ({ ...prev, [chatId]: res.messages || [] }));
      }
      return res;
    },
    [emit]
  );

  const sendMessage = useCallback(
    async (chatId: string, text: string) => {
      return emit("message:send", { chatId, text });
    },
    [emit]
  );

  const deleteMessage = useCallback(
    async (chatId: string, messageId: string) => emit("message:delete", { chatId, messageId }),
    [emit]
  );
  const editMessage = useCallback(
    async (chatId: string, messageId: string, text: string) => emit("message:edit", { chatId, messageId, text }),
    [emit]
  );

  const sendMedia = useCallback(
    async (
      chatId: string,
      media: { base64: string; mimetype: string; filename?: string; caption?: string; asVoice?: boolean }
    ) => {
      return emit("message:sendMedia", { chatId, media });
    },
    [emit]
  );

  const assistantCommand = useCallback(
    async (text: string, chatId?: string | null) => {
      return emit("assistant:command", { text, chatId: chatId || undefined });
    },
    [emit]
  );

  const chatAssistant = useCallback(
    async (chatId: string, text: string) => {
      return emit("chat:assistant", { chatId, text });
    },
    [emit]
  );

  const rewriteDraft = useCallback(
    async (text: string, lang: string): Promise<{ ok?: boolean; text?: string; error?: string }> => {
      return emit("composer:rewrite", { text, lang });
    },
    [emit]
  );

  const clearSuggestion = useCallback(
    async (chatId: string) => emit("suggestion:clear", { chatId }),
    [emit]
  );

  const enableNotifications = useCallback(async (): Promise<NotificationPermission | "unsupported"> => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    try {
      return await Notification.requestPermission();
    } catch {
      return "denied";
    }
  }, []);

  const loadMedia = useCallback(
    async (chatId: string, messageId: string) => {
      const res = await emit("message:media", { messageId });
      if (res?.ok && res.media) {
        setMessages((prev) => {
          const arr = prev[chatId];
          if (!arr) return prev;
          return { ...prev, [chatId]: arr.map((m) => (m.id === messageId ? { ...m, media: res.media } : m)) };
        });
      }
      return res;
    },
    [emit]
  );

  const fetchModels = useCallback(async (): Promise<ModelsResult> => {
    return emit("models:fetch", {});
  }, [emit]);

  const previewVoice = useCallback(
    async (voice: string, model: string): Promise<VoicePreview> => {
      return emit("voice:preview", { voice, model });
    },
    [emit]
  );

  const login = useCallback((key: string) => {
    if (typeof window !== "undefined") localStorage.setItem(KEY_STORAGE, key.trim());
    setAuthError(null);
    setKeyTick((t) => t + 1);
  }, []);

  const lock = useCallback(() => {
    if (typeof window !== "undefined") localStorage.removeItem(KEY_STORAGE);
    socketRef.current?.close();
    setConnected(false);
    setSnap(null);
    setMessages({});
    setAuthError(null);
    setAuthState("unauthorized");
  }, []);

  return {
    connected,
    snap,
    messages,
    typing,
    emit,
    openChat,
    sendMessage,
    sendMedia,
    deleteMessage,
    editMessage,
    assistantCommand,
    chatAssistant,
    rewriteDraft,
    clearSuggestion,
    enableNotifications,
    loadMedia,
    fetchModels,
    previewVoice,
    authState,
    authError,
    login,
    lock,
  };
}
