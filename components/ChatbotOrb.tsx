"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Chat, Message } from "@/components/useWaSocket";

/* ------------------------------------------------------------------ */
/* Inline icons (kept local so the orb is self-contained)              */
/* ------------------------------------------------------------------ */
const SvgBase = (p: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p} />
);
const Icons = {
  Sparkle: (p: any) => (
    <SvgBase {...p}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M12 8.5 13.4 11l2.5 1-2.5 1L12 15.5 10.6 13 8 12l2.6-1L12 8.5Z" />
    </SvgBase>
  ),
  Chat: (p: any) => (
    <SvgBase {...p}>
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" />
    </SvgBase>
  ),
  Mic: (p: any) => (
    <SvgBase {...p}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 19v3" />
    </SvgBase>
  ),
  Send: (p: any) => (
    <SvgBase {...p}>
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    </SvgBase>
  ),
  Close: (p: any) => (
    <SvgBase {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </SvgBase>
  ),
  SpeakerOn: (p: any) => (
    <SvgBase {...p}>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </SvgBase>
  ),
  SpeakerOff: (p: any) => (
    <SvgBase {...p}>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="m22 9-6 6M16 9l6 6" />
    </SvgBase>
  ),
  Back: (p: any) => (
    <SvgBase {...p}>
      <path d="m15 18-6-6 6-6" />
    </SvgBase>
  ),
  Search: (p: any) => (
    <SvgBase {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </SvgBase>
  ),
};

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type Mode = "assistant" | "picker" | "chat";

const GREETING =
  "Hi! Tell me what to do — e.g. “message Rahul I’ll be late”, “reply to Mom in Hindi”, or “talk about this chat”.";

const EXAMPLES = [
  "Message Rahul I’ll be late",
  "Talk about this chat",
  "Reply to this in Hindi",
  "Pause auto-reply",
];

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const initials = (name: string) => {
  const n = (name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
export function ChatbotOrb(props: {
  onCommand: (text: string, chatId?: string) => Promise<{ ok?: boolean; reply?: string; action?: any }>;
  connected: boolean;
  chats: Chat[];
  messagesByChat: Record<string, Message[]>;
  onOpenChat: (chatId: string) => void;
  onSendMessage: (chatId: string, text: string) => Promise<any>;
  onChatAssistant: (chatId: string, command: string) => Promise<{ ok?: boolean; reply?: string }>;
  activeChatId: string | null;
  activeChatName: string | null;
}) {
  const {
    onCommand,
    connected,
    chats,
    messagesByChat,
    onOpenChat,
    onSendMessage,
    onChatAssistant,
    activeChatName,
  } = props;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("assistant");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([
    { id: uid(), role: "assistant", text: GREETING },
  ]);

  // Chat-picker search + chat-mode composer.
  const [search, setSearch] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);

  // Is the Web Speech recognition API available?
  const [sttSupported, setSttSupported] = useState(false);

  const recognitionRef = useRef<any>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  // Guard against sending twice for one recognition session.
  const sentThisSessionRef = useRef(false);

  /* ---- capability detection (client-only, defensive) ---- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSttSupported(!!SR);
  }, []);

  /* ---- speak a reply aloud ---- */
  const speak = useCallback(
    (text: string) => {
      if (!speakOn) return;
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1;
        u.pitch = 1;
        window.speechSynthesis.speak(u);
      } catch {
        /* ignore synthesis errors */
      }
    },
    [speakOn]
  );

  /* ---- open a chat (from picker or voice command) ---- */
  const enterChat = useCallback(
    (chatId: string) => {
      onOpenChat(chatId);
      setActiveChatId(chatId);
      setMode("chat");
      setChatInput("");
    },
    [onOpenChat]
  );

  /* ---- send a command to the backend ---- */
  const submit = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || thinking) return;

      setInput("");
      setMessages((m) => [...m, { id: uid(), role: "user", text }]);
      setThinking(true);

      try {
        const res = await onCommand(text);
        const reply =
          (res && res.reply) ||
          (res && res.ok === false
            ? "Sorry, I couldn’t do that."
            : "Done.");
        setMessages((m) => [...m, { id: uid(), role: "assistant", text: reply }]);
        speak(reply);

        // Assistant can open a chat by voice/command.
        if (
          res &&
          res.action &&
          res.action.action === "open_chat" &&
          res.action.chatId
        ) {
          enterChat(res.action.chatId);
        }
      } catch (err) {
        const reply = "Something went wrong reaching the server. Please try again.";
        setMessages((m) => [...m, { id: uid(), role: "assistant", text: reply }]);
        speak(reply);
      } finally {
        setThinking(false);
      }
    },
    [onCommand, speak, thinking, enterChat]
  );

  /* ---- microphone / speech recognition ---- */
  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    // Toggle off if already listening.
    if (listening) {
      stopListening();
      return;
    }

    let rec: any;
    try {
      rec = new SR();
    } catch {
      return;
    }
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    sentThisSessionRef.current = false;

    rec.onresult = (e: any) => {
      let interim = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (finalText) {
        setInput(finalText);
        if (!sentThisSessionRef.current) {
          sentThisSessionRef.current = true;
          // auto-send the final transcript
          submit(finalText);
        }
      } else {
        setInput(interim);
      }
    };

    rec.onerror = () => {
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening, stopListening, submit]);

  /* ---- cleanup on unmount ---- */
  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.onresult = null;
          rec.onerror = null;
          rec.onend = null;
          rec.abort ? rec.abort() : rec.stop();
        } catch {
          /* ignore */
        }
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  /* ---- when muting, cancel any ongoing speech ---- */
  useEffect(() => {
    if (!speakOn && typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
  }, [speakOn]);

  /* ---- autoscroll assistant message list ---- */
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking, open, mode]);

  /* ---- autoscroll chat-mode message list on new messages ---- */
  const activeMessages: Message[] =
    (activeChatId && messagesByChat[activeChatId]) || [];
  useEffect(() => {
    const el = chatListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeMessages, mode, activeChatId]);

  /* ---- focus the right input when opening / switching mode ---- */
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (mode === "chat") chatInputRef.current?.focus();
      else if (mode === "assistant") inputRef.current?.focus();
    }, 60);
    return () => clearTimeout(t);
  }, [open, mode]);

  const toggleOpen = useCallback(() => {
    setOpen((o) => {
      const next = !o;
      if (!next && listening) stopListening();
      return next;
    });
  }, [listening, stopListening]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  };

  /* ---- does the current draft start with "@bot"? ---- */
  const isBotDraft = /^@bot\b/i.test(chatInput.trimStart());

  /* ---- chat-mode: send a manual reply into the real chat ---- */
  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || !activeChatId || !connected || sending) return;

    // "@bot …" is a private aside to the assistant, not a real message.
    const botMatch = /^@bot\b/i.exec(text);
    setSending(true);
    setChatInput("");
    try {
      if (botMatch) {
        const command = text.slice(botMatch[0].length).trim();
        if (command) {
          await onChatAssistant(activeChatId, command);
        }
      } else {
        await onSendMessage(activeChatId, text);
      }
    } catch {
      /* the live message stream will reflect success; ignore local errors */
    } finally {
      setSending(false);
    }
  }, [chatInput, activeChatId, connected, sending, onSendMessage, onChatAssistant]);

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  /* ---- sorted + filtered chats for the picker ---- */
  const sortedChats = useMemo(
    () => [...(chats || [])].sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0)),
    [chats]
  );
  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedChats;
    return sortedChats.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.number || "").toLowerCase().includes(q) ||
        (c.lastText || "").toLowerCase().includes(q)
    );
  }, [sortedChats, search]);

  const activeChat = useMemo(
    () => (activeChatId ? (chats || []).find((c) => c.id === activeChatId) || null : null),
    [chats, activeChatId]
  );

  const orbGlow = useMemo(
    () =>
      listening
        ? "shadow-[0_0_0_1px_rgba(248,113,113,0.35),0_10px_40px_-6px_rgba(248,113,113,0.55)]"
        : "shadow-[0_0_0_1px_rgba(37,211,102,0.25),0_10px_40px_-8px_rgba(37,211,102,0.5)]",
    [listening]
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-5 sm:right-5">
      {/* -------------------- Panel -------------------- */}
      {open && (
        <div
          className="card animate-fade-up flex max-h-[70vh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden shadow-2xl sm:w-96"
          role="dialog"
          aria-label="Assistant"
        >
          {/* =========================================================== */}
          {/* CHAT MODE HEADER                                            */}
          {/* =========================================================== */}
          {mode === "chat" ? (
            <div className="flex items-center gap-2 border-b border-fg/5 bg-gradient-to-r from-wa-teal/20 to-wa-green/10 px-3 py-3">
              <button
                type="button"
                onClick={() => {
                  setMode("picker");
                }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-fg/5 text-fg/75 transition hover:bg-fg/10 hover:text-fg"
                title="Back to chats"
                aria-label="Back to chats"
              >
                <Icons.Back width={16} height={16} />
              </button>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-wa-green to-wa-teal text-[12px] font-bold text-ink-950 shadow-glow">
                {initials(activeChat?.name || activeChat?.number || "?")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-fg">
                  {activeChat?.name || activeChat?.number || "Chat"}
                </div>
                <div className="truncate text-[11px] text-fg/60">
                  {activeChat?.number ? `+${activeChat.number}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={toggleOpen}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-fg/5 text-fg/60 transition hover:bg-fg/10 hover:text-fg/90"
                title="Close"
                aria-label="Close assistant"
              >
                <Icons.Close width={16} height={16} />
              </button>
            </div>
          ) : (
            /* =========================================================== */
            /* ASSISTANT / PICKER HEADER                                   */
            /* =========================================================== */
            <div className="flex items-center gap-3 border-b border-fg/5 bg-gradient-to-r from-wa-teal/20 to-wa-green/10 px-4 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-wa-green to-wa-teal text-ink-950 shadow-glow">
                <Icons.Sparkle width={18} height={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-fg">
                  {mode === "picker" ? "Chats" : "Assistant"}
                </div>
                <div className="truncate text-[11px] text-fg/60">
                  {mode === "picker"
                    ? "pick a conversation to open"
                    : "talk or type to control WhatsApp"}
                </div>
              </div>

              {/* Chats toggle */}
              <button
                type="button"
                onClick={() => setMode((m) => (m === "picker" ? "assistant" : "picker"))}
                className={`grid h-8 w-8 place-items-center rounded-lg transition ${
                  mode === "picker"
                    ? "bg-wa-green/20 text-wa-green hover:bg-wa-green/30"
                    : "bg-fg/5 text-fg/60 hover:bg-fg/10 hover:text-fg/90"
                }`}
                title={mode === "picker" ? "Back to assistant" : "Open chats"}
                aria-label={mode === "picker" ? "Back to assistant" : "Open chats"}
                aria-pressed={mode === "picker"}
              >
                <Icons.Chat width={16} height={16} />
              </button>

              {/* Speaker mute toggle */}
              <button
                type="button"
                onClick={() => setSpeakOn((s) => !s)}
                className={`grid h-8 w-8 place-items-center rounded-lg transition ${
                  speakOn
                    ? "bg-wa-green/15 text-wa-green hover:bg-wa-green/25"
                    : "bg-fg/5 text-fg/60 hover:bg-fg/10"
                }`}
                title={speakOn ? "Voice replies on — tap to mute" : "Voice replies muted — tap to unmute"}
                aria-label={speakOn ? "Mute voice replies" : "Unmute voice replies"}
              >
                {speakOn ? (
                  <Icons.SpeakerOn width={16} height={16} />
                ) : (
                  <Icons.SpeakerOff width={16} height={16} />
                )}
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={toggleOpen}
                className="grid h-8 w-8 place-items-center rounded-lg bg-fg/5 text-fg/60 transition hover:bg-fg/10 hover:text-fg/90"
                title="Close"
                aria-label="Close assistant"
              >
                <Icons.Close width={16} height={16} />
              </button>
            </div>
          )}

          {/* =========================================================== */}
          {/* ASSISTANT MODE                                              */}
          {/* =========================================================== */}
          {mode === "assistant" && (
            <>
              {/* Not-connected note */}
              {!connected && (
                <div className="border-b border-amber-400/10 bg-amber-400/5 px-4 py-1.5 text-[11px] text-amber-300/90">
                  WhatsApp not connected yet — commands may not fully apply.
                </div>
              )}

              {/* Messages */}
              <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-snug ${
                        m.role === "user"
                          ? "rounded-br-sm bg-wa-green/20 text-emerald-950 dark:text-wa-light"
                          : "rounded-bl-sm bg-fg/5 text-fg/90"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}

                {/* Example chips (only while it's just the greeting) */}
                {messages.length === 1 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => submit(ex)}
                        className="chip border border-fg/10 bg-fg/5 text-fg/75 transition hover:border-wa-green/40 hover:bg-wa-green/10 hover:text-wa-green"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                )}

                {/* Thinking indicator */}
                {thinking && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-fg/5 px-3 py-2.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer / composer */}
              <div className="border-t border-fg/5 bg-surface-2/40 p-2.5">
                {activeChatName && (
                  <div className="mb-2 flex items-center gap-1.5 px-1 text-[11px] text-fg/60">
                    <span className="inline-flex items-center gap-1 rounded-full border border-wa-green/30 bg-wa-green/10 px-2 py-0.5 font-medium text-wa-green">
                      <span className="h-1.5 w-1.5 rounded-full bg-wa-green" />
                      Context: {activeChatName}
                    </span>
                  </div>
                )}
                {listening && (
                  <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-medium text-red-300">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400/70" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
                    </span>
                    Listening… tap the mic to stop
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type or speak a command…"
                    className="input flex-1"
                    aria-label="Command input"
                  />

                  {/* Mic (only if supported) */}
                  {sttSupported ? (
                    <button
                      type="button"
                      onClick={startListening}
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${
                        listening
                          ? "bg-red-500/20 text-red-300 ring-2 ring-red-400/40"
                          : "bg-fg/5 text-fg/75 hover:bg-fg/10 hover:text-wa-green"
                      }`}
                      title={listening ? "Stop listening" : "Speak a command"}
                      aria-label={listening ? "Stop listening" : "Speak a command"}
                      aria-pressed={listening}
                    >
                      <Icons.Mic width={17} height={17} />
                    </button>
                  ) : (
                    <div
                      className="grid h-9 w-9 shrink-0 cursor-not-allowed place-items-center rounded-xl bg-fg/5 text-fg/40"
                      title="Voice input not supported in this browser"
                      aria-label="Voice input not supported in this browser"
                    >
                      <Icons.Mic width={17} height={17} />
                    </div>
                  )}

                  {/* Send */}
                  <button
                    type="button"
                    onClick={() => submit(input)}
                    disabled={!input.trim() || thinking}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-wa-green text-ink-950 shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Send"
                    aria-label="Send command"
                  >
                    <Icons.Send width={17} height={17} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* =========================================================== */}
          {/* CHAT PICKER MODE                                            */}
          {/* =========================================================== */}
          {mode === "picker" && (
            <>
              {/* Search */}
              <div className="border-b border-fg/5 bg-surface-2/40 p-2.5">
                <div className="flex items-center gap-2 rounded-xl bg-fg/5 px-2.5">
                  <Icons.Search width={15} height={15} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search chats…"
                    className="w-full bg-transparent py-2 text-sm text-fg/90 placeholder:text-fg/45 focus:outline-none"
                    aria-label="Search chats"
                  />
                </div>
              </div>

              {/* Chat list */}
              <div className="flex-1 overflow-y-auto px-1.5 py-1.5">
                {!connected ? (
                  <div className="px-3 py-8 text-center text-[13px] text-fg/45">
                    WhatsApp not connected yet — chats will appear here once linked.
                  </div>
                ) : filteredChats.length === 0 ? (
                  <div className="px-3 py-8 text-center text-[13px] text-fg/45">
                    {search.trim() ? "No chats match your search." : "No chats yet."}
                  </div>
                ) : (
                  filteredChats.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => enterChat(c.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-fg/5"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-wa-teal/60 to-wa-green/50 text-[13px] font-bold text-ink-950">
                        {initials(c.name || c.number)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-fg">
                            {c.name || c.number}
                          </span>
                        </div>
                        <div className="truncate text-[12px] text-fg/60">
                          {c.lastText || (c.number ? `+${c.number}` : "")}
                        </div>
                      </div>
                      {c.unread > 0 && (
                        <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-wa-green px-1.5 text-[11px] font-bold text-ink-950">
                          {c.unread > 99 ? "99+" : c.unread}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {/* =========================================================== */}
          {/* CHAT MODE                                                   */}
          {/* =========================================================== */}
          {mode === "chat" && (
            <>
              {/* Bubbles */}
              <div ref={chatListRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {activeMessages.length === 0 ? (
                  <div className="px-3 py-8 text-center text-[13px] text-fg/45">
                    No messages loaded yet…
                  </div>
                ) : (
                  activeMessages.map((m) => {
                    const icon =
                      m.type === "voice" || m.type === "audio"
                        ? "🎤 "
                        : m.type === "image"
                        ? "📷 "
                        : "";

                    /* Private @bot/@yati asides — visibly separate from real messages. */
                    if (m.private) {
                      return (
                        <div
                          key={m.id}
                          className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl border border-dashed px-3 py-2 text-sm leading-snug ${
                              m.fromMe
                                ? "rounded-br-sm border-amber-400/50 bg-amber-400/10 text-amber-800 dark:text-amber-100"
                                : "rounded-bl-sm border-violet-400/50 bg-violet-400/10 text-violet-800 dark:text-violet-100"
                            }`}
                          >
                            <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide opacity-80">
                              🔒 Private
                            </span>
                            {(icon || m.text) && (
                              <span>
                                {icon}
                                {m.text || (icon ? "" : "")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={m.id}
                        className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-snug ${
                            m.fromMe
                              ? "rounded-br-sm bg-wa-green/20 text-emerald-950 dark:text-wa-light"
                              : "rounded-bl-sm bg-fg/5 text-fg/90"
                          }`}
                        >
                          {(icon || m.text) && (
                            <span>
                              {icon}
                              {m.text || (icon ? "" : "")}
                            </span>
                          )}
                          {m.isAutoReply && m.model && (
                            <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-wa-green/80">
                              auto · {m.model}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Not-connected note */}
              {!connected && (
                <div className="border-t border-amber-400/10 bg-amber-400/5 px-4 py-1.5 text-[11px] text-amber-300/90">
                  WhatsApp not connected — sending is disabled.
                </div>
              )}

              {/* Composer */}
              <div className="border-t border-fg/5 bg-surface-2/40 p-2.5">
                <div className="flex items-end gap-2">
                  <input
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder={
                      connected
                        ? 'Type a message — or "@bot …" to ask privately'
                        : "Connect WhatsApp to reply…"
                    }
                    disabled={!connected}
                    className={`input flex-1 disabled:cursor-not-allowed disabled:opacity-50 ${
                      isBotDraft ? "ring-2 ring-amber-400/60 focus:ring-amber-400/70" : ""
                    }`}
                    aria-label="Message input"
                  />
                  <button
                    type="button"
                    onClick={sendChat}
                    disabled={!chatInput.trim() || !connected || sending}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-wa-green text-ink-950 shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Send message"
                    aria-label="Send message"
                  >
                    <Icons.Send width={17} height={17} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* -------------------- Orb -------------------- */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
        className={`relative grid h-[60px] w-[60px] place-items-center rounded-full bg-gradient-to-br from-wa-green to-wa-teal text-ink-950 transition duration-200 hover:scale-105 active:scale-95 ${orbGlow}`}
      >
        {/* pulsing rings */}
        <span
          className={`pointer-events-none absolute inset-0 rounded-full ${
            listening ? "bg-red-400/50" : "bg-wa-green/40"
          } animate-pulse-ring`}
        />
        <span
          className={`pointer-events-none absolute inset-0 rounded-full ${
            listening ? "bg-red-400/40" : "bg-wa-green/30"
          } animate-pulse-ring [animation-delay:0.9s]`}
        />
        {/* icon */}
        <span className="relative">
          {open ? (
            <Icons.Close width={24} height={24} />
          ) : listening ? (
            <Icons.Mic width={24} height={24} />
          ) : (
            <Icons.Chat width={24} height={24} />
          )}
        </span>
      </button>
    </div>
  );
}

export default ChatbotOrb;
