"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export type Language = "default" | "auto" | "english" | "hindi" | "hinglish" | "english-slang";
export type VoiceReply = "default" | "voice" | "text";
export type Tone = "default" | "professional" | "friendly" | "flirty";

export type Contact = {
  id: string;
  name: string;
  number: string;
  enabled: boolean;
  customPrompt?: string;
  language?: Language;
  tone?: Tone;
  voiceReply?: VoiceReply;
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
  customPrompt?: string;
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
  groqModel: string;
  geminiModel: string;
  systemPrompt: string;
  autoReplyEnabled: boolean;
  replyDelayMs: number;
  replyToGroups: boolean;
  language: Exclude<Language, "default">; // "auto" | "english" | "hindi" | "hinglish" | "english-slang"
  tone: Exclude<Tone, "default">; // "professional" | "friendly" | "flirty"
  ownerProfile: string;
  whisperModel: string;
  voiceReplies: boolean;
  ttsModel: string;
  ttsVoice: string;
  chatFallbacks: { provider: "groq" | "gemini"; model: string }[];
  visionFallbacks: { provider: "groq" | "gemini"; model: string }[];
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

export type Status =
  | "idle" | "initializing" | "qr" | "authenticating"
  | "connected" | "disconnected" | "error";

export type Snapshot = {
  status: Status;
  qr: string | null;
  me: { number: string; name: string } | null;
  error: string | null;
  startedAt: number;
  settings: Settings;
  contacts: Contact[];
  chats: Chat[];
  logs: LogEntry[];
  stats: Stats;
};

const KEY_STORAGE = "wa_access_key";

export function useWaSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
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
      setSnap((prev) => (prev ? { ...prev, status: p.status, qr: p.qr, me: p.me, error: p.error } : prev))
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

  const assistantCommand = useCallback(
    async (text: string) => {
      return emit("assistant:command", { text });
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
    emit,
    openChat,
    sendMessage,
    assistantCommand,
    fetchModels,
    previewVoice,
    authState,
    authError,
    login,
    lock,
  };
}
