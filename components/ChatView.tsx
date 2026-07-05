"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Toggle } from "./ui";
import type { Chat, Message, Language, Tone, VoiceReply } from "./useWaSocket";

/* ---------------------------------- utils --------------------------------- */

function initials(name: string) {
  return (
    name
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

const AVATAR_COLORS = [
  "bg-rose-500/25 text-rose-100",
  "bg-sky-500/25 text-sky-100",
  "bg-emerald-500/25 text-emerald-100",
  "bg-amber-500/25 text-amber-100",
  "bg-violet-500/25 text-violet-100",
  "bg-cyan-500/25 text-cyan-100",
  "bg-fuchsia-500/25 text-fuchsia-100",
  "bg-teal-500/25 text-teal-100",
];
function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * 31) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

function fmtTime(ts: number) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dayLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (dayKey(ts) === dayKey(today.getTime())) return "Today";
  if (dayKey(ts) === dayKey(yest.getTime())) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

/** WhatsApp-style delivery ticks (shown on your own sent messages). */
function Ticks({ ack }: { ack?: number }) {
  const a = ack ?? 1;
  if (a <= 0) {
    // pending — a little clock
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-wa-light/50" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3l2 1.5" strokeLinecap="round" />
      </svg>
    );
  }
  const read = a >= 3;
  const color = read ? "#53bdeb" : "rgba(219,248,198,0.55)";
  if (a === 1) {
    return (
      <svg viewBox="0 0 16 12" className="h-3.5 w-4" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6.5 6 10.5 14 1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 12" className="h-3.5 w-5" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 6.5 5 10.5 13 1.5" />
      <path d="M7.5 10.2 8.5 9 13.5 1.5" />
    </svg>
  );
}

function DateDivider({ ts }: { ts: number }) {
  return (
    <div className="flex justify-center py-1">
      <span className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-medium text-white/60 shadow-sm backdrop-blur">
        {dayLabel(ts)}
      </span>
    </div>
  );
}

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "default", label: "Default (global)" },
  { value: "auto", label: "Auto-detect" },
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
  { value: "hinglish", label: "Hinglish" },
  { value: "english-slang", label: "English + slang" },
];

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: "default", label: "Default (global)" },
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "flirty", label: "Flirty" },
];

const VOICE_OPTIONS: { value: VoiceReply; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "voice", label: "Voice" },
  { value: "text", label: "Text" },
];

function prettyModel(model: string | null) {
  if (!model) return "";
  // "provider:model" or "provider/model" -> "Provider · model"
  const sep = model.includes(":") ? ":" : model.includes("/") ? "/" : null;
  if (sep) {
    const [prov, ...rest] = model.split(sep);
    const p = prov.charAt(0).toUpperCase() + prov.slice(1);
    return `${p} · ${rest.join(sep)}`;
  }
  return model;
}

/* --------------------------------- avatar --------------------------------- */

function Avatar({ id, name, size = "md" }: { id: string; name: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "h-9 w-9 text-xs" : size === "lg" ? "h-11 w-11 text-sm" : "h-10 w-10 text-sm";
  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full font-semibold ${avatarColor(
        id
      )}`}
    >
      {initials(name)}
    </div>
  );
}

/* -------------------------------- chat list ------------------------------- */

function ChatRow({
  chat,
  active,
  onOpen,
}: {
  chat: Chat;
  active: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(chat.id)}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
        active ? "bg-white/10 ring-1 ring-wa-green/40" : "hover:bg-white/5"
      }`}
    >
      <div className="relative">
        <Avatar id={chat.id} name={chat.name} />
        {chat.enabled && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-900 bg-wa-green" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {chat.isGroup && <Icon.Users className="h-3.5 w-3.5 shrink-0 text-white/40" />}
            <span className="truncate font-semibold text-white/90">{chat.name}</span>
          </div>
          <span className="shrink-0 text-[11px] text-white/40">{fmtTime(chat.lastTs)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-white/50">{chat.lastText || "No messages yet"}</span>
          {chat.unread > 0 && (
            <span className="ml-1 flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-wa-green px-1.5 text-[11px] font-bold text-ink-950">
              {chat.unread > 99 ? "99+" : chat.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* --------------------------------- bubble --------------------------------- */

function MessageBubble({ msg }: { msg: Message }) {
  const mine = msg.fromMe;
  const showModel = msg.isAutoReply && msg.model;

  // Private @bot / @yati aside — only you see this; it never went to the person.
  if (msg.private) {
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[80%] rounded-2xl border border-dashed px-3 py-2 ${
            mine
              ? "rounded-br-md border-amber-400/40 bg-amber-400/10 text-amber-100"
              : "rounded-bl-md border-violet-400/40 bg-violet-400/10 text-violet-100"
          }`}
        >
          <div className="mb-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide opacity-70">
            <span>🔒</span> Private · {mine ? "to bot" : "assistant"}
          </div>
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.text}</div>
          <div className="mt-1 text-[10px] opacity-50">{fmtTime(msg.ts)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[75%] rounded-2xl px-3 py-1.5 shadow-md ring-1 ring-inset ${
          mine
            ? "rounded-br-sm bg-gradient-to-br from-wa-green/25 to-wa-teal/15 text-wa-light ring-wa-green/10"
            : "rounded-bl-sm bg-ink-700/60 text-white/90 ring-white/5"
        }`}
      >
        <div className="whitespace-pre-wrap break-words pr-1 text-sm leading-relaxed">
          {msg.type === "voice" && <span className="mr-1">🎤</span>}
          {msg.type === "audio" && <span className="mr-1">🎧</span>}
          {msg.type === "image" && <span className="mr-1">📷</span>}
          {msg.text || (msg.type === "voice" ? "Voice message" : msg.type === "image" ? "Photo" : "")}
        </div>
        <div
          className={`mt-0.5 flex items-center gap-1.5 text-[10px] ${
            mine ? "justify-end text-wa-light/55" : "text-white/40"
          }`}
        >
          {showModel && (
            <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[9px] font-medium text-white/60">
              {prettyModel(msg.model)}
            </span>
          )}
          <span>{fmtTime(msg.ts)}</span>
          {mine && <Ticks ack={msg.ack} />}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- main view ------------------------------- */

export function ChatView(props: {
  chats: Chat[];
  activeChatId: string | null;
  messages: Message[];
  me: { number: string; name: string } | null;
  onOpenChat: (chatId: string) => void;
  onSendMessage: (chatId: string, text: string) => Promise<any>;
  onToggleEnabled: (chatId: string, enabled: boolean) => void;
  onSetLanguage: (chatId: string, language: Language) => void;
  onSetTone: (chatId: string, tone: Tone) => void;
  onSetVoiceReply: (chatId: string, pref: VoiceReply) => void;
  onSetCustomPrompt: (chatId: string, prompt: string) => void;
  onChatAssistant: (chatId: string, command: string) => Promise<any>;
  connected: boolean;
}) {
  const {
    chats,
    activeChatId,
    messages,
    onOpenChat,
    onSendMessage,
    onToggleEnabled,
    onSetLanguage,
    onSetTone,
    onSetVoiceReply,
    onSetCustomPrompt,
    onChatAssistant,
    connected,
  } = props;

  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");

  const listRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true); // stay pinned to the bottom unless the user scrolls up

  function onListScroll() {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || null,
    [chats, activeChatId]
  );

  const sortedChats = useMemo(() => {
    const list = [...chats].sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.number || "").toLowerCase().includes(q)
    );
  }, [chats, query]);

  // Jump to the bottom when a chat opens.
  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      stickRef.current = true;
    }
  }, [activeChatId]);

  // On new messages, only stick to the bottom if the user was already there
  // (so reading older messages isn't interrupted). Scoped to the list — never
  // scrolls the page.
  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // reset the persona editor when switching chats
  useEffect(() => {
    setShowPrompt(false);
    setPromptDraft(activeChat?.customPrompt || "");
    setDraft("");
  }, [activeChatId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    const text = draft.trim();
    if (!text || !activeChatId || sending) return;
    // "@bot ..." is a PRIVATE aside to your assistant about this chat — it is
    // NOT sent to the person. The bot replies "@yati ..." (also private).
    const isBot = /^@bot\b/i.test(text);
    if (!isBot && !connected) return;
    setSending(true);
    try {
      if (isBot) {
        const cmd = text.replace(/^@bot\b[:,]?\s*/i, "").trim() || "help me with this chat";
        await onChatAssistant(activeChatId, cmd);
      } else {
        await onSendMessage(activeChatId, text);
      }
      setDraft("");
    } catch {
      /* keep draft on failure so the user can retry */
    } finally {
      setSending(false);
    }
  }

  const wallpaper: React.CSSProperties = {
    backgroundColor: "#0b1014",
    backgroundImage: [
      "radial-gradient(55rem 55rem at 100% 0%, rgba(37,211,102,0.06), transparent 60%)",
      "radial-gradient(45rem 45rem at 0% 100%, rgba(18,140,126,0.06), transparent 55%)",
      "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
    ].join(", "),
    backgroundSize: "auto, auto, 24px 24px",
  };

  return (
    <div className="card overflow-hidden p-0">
      <div className="grid h-[calc(100dvh-13rem)] min-h-[440px] grid-cols-1 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* ------------------------------ LEFT: list ------------------------------ */}
        <aside
          className={`flex min-h-0 flex-col border-white/10 md:border-r ${
            activeChatId ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="border-b border-white/10 p-3">
            <div className="relative">
              <Icon.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                className="input pl-9"
                placeholder="Search chats"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {sortedChats.length === 0 ? (
              <div className="px-3 py-10 text-center text-sm text-white/40">
                {chats.length === 0 ? "No chats yet" : "No chats match your search"}
              </div>
            ) : (
              sortedChats.map((chat) => (
                <ChatRow
                  key={chat.id}
                  chat={chat}
                  active={chat.id === activeChatId}
                  onOpen={onOpenChat}
                />
              ))
            )}
          </div>
        </aside>

        {/* --------------------------- RIGHT: conversation --------------------------- */}
        <section
          className={`flex min-h-0 flex-col ${
            activeChatId ? "flex" : "hidden md:flex"
          }`}
        >
          {!activeChat ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                <Icon.Send className="h-7 w-7 text-white/30" />
              </div>
              <div className="text-sm font-medium text-white/70">
                Select a chat to view the conversation
              </div>
              <div className="max-w-xs text-xs text-white/40">
                Pick a conversation from the list to read messages and manage its
                auto-reply settings.
              </div>
            </div>
          ) : (
            <>
              {/* header */}
              <div className="border-b border-white/10 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {/* back button (mobile only) */}
                  <button
                    type="button"
                    onClick={() => onOpenChat("")}
                    className="btn-ghost shrink-0 px-2 md:hidden"
                    aria-label="Back to chats"
                  >
                    ‹ Back
                  </button>
                  <Avatar id={activeChat.id} name={activeChat.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {activeChat.isGroup && (
                        <Icon.Users className="h-3.5 w-3.5 shrink-0 text-white/40" />
                      )}
                      <span className="truncate font-semibold text-white/90">
                        {activeChat.name}
                      </span>
                    </div>
                    <div className="truncate text-xs text-white/45">
                      +{activeChat.number}
                    </div>
                  </div>

                  {/* controls */}
                  <div className="flex w-full flex-wrap items-center justify-start gap-2 md:w-auto md:justify-end">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-white/50">Auto-reply</span>
                      <Toggle
                        checked={activeChat.enabled}
                        onChange={(v) => onToggleEnabled(activeChat.id, v)}
                        size="sm"
                      />
                    </div>

                    <div className="flex min-w-0 items-center gap-1">
                      <span className="hidden text-[11px] text-white/50 lg:inline">
                        Lang
                      </span>
                      <select
                        className="input h-8 w-[7.5rem] min-w-0 py-0 text-xs sm:w-auto"
                        value={activeChat.language}
                        onChange={(e) =>
                          onSetLanguage(activeChat.id, e.target.value as Language)
                        }
                      >
                        {LANGUAGE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex min-w-0 items-center gap-1">
                      <span className="hidden text-[11px] text-white/50 lg:inline">
                        Tone
                      </span>
                      <select
                        className="input h-8 w-[7.5rem] min-w-0 py-0 text-xs sm:w-auto"
                        value={activeChat.tone}
                        onChange={(e) => onSetTone(activeChat.id, e.target.value as Tone)}
                      >
                        {TONE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex min-w-0 items-center gap-1">
                      <span className="hidden text-[11px] text-white/50 lg:inline">
                        Voice reply
                      </span>
                      <select
                        className="input h-8 w-[5.5rem] min-w-0 py-0 text-xs sm:w-auto"
                        value={activeChat.voiceReply}
                        onChange={(e) =>
                          onSetVoiceReply(activeChat.id, e.target.value as VoiceReply)
                        }
                      >
                        {VOICE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPromptDraft(activeChat.customPrompt || "");
                        setShowPrompt((s) => !s);
                      }}
                      className={`btn-ghost h-8 shrink-0 px-2 ${
                        showPrompt ? "bg-white/10 text-white" : ""
                      }`}
                      aria-label="Edit persona"
                      title="Per-chat persona"
                    >
                      <Icon.Cog className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* inline persona editor */}
                {showPrompt && (
                  <div className="animate-fade-up mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                    <label className="label">Custom persona for this chat</label>
                    <textarea
                      className="input mt-1 min-h-[80px] resize-y text-sm"
                      placeholder="e.g. Reply as a cheerful assistant who keeps things short…"
                      value={promptDraft}
                      onChange={(e) => setPromptDraft(e.target.value)}
                    />
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setShowPrompt(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          onSetCustomPrompt(activeChat.id, promptDraft.trim());
                          setShowPrompt(false);
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* messages */}
              <div
                ref={listRef}
                onScroll={onListScroll}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4"
                style={wallpaper}
              >
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-sm text-white/40">
                    No messages in this conversation yet
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const prev = messages[idx - 1];
                    const showDate = !prev || dayKey(prev.ts) !== dayKey(m.ts);
                    return (
                      <React.Fragment key={m.id}>
                        {showDate && <DateDivider ts={m.ts} />}
                        <MessageBubble msg={m} />
                      </React.Fragment>
                    );
                  })
                )}
              </div>

              {/* composer */}
              <div className="border-t border-white/10 bg-black/20 p-3">
                <div className="flex items-center gap-2">
                  <input
                    className={`input flex-1 !rounded-full !bg-ink-800/80 px-4 ${
                      /^@bot\b/i.test(draft) ? "ring-2 ring-amber-400/50" : ""
                    }`}
                    placeholder={connected ? "Type a message — or “@bot …” to ask privately" : "Disconnected…"}
                    value={draft}
                    disabled={!connected}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-primary h-11 w-11 shrink-0 rounded-full !p-0 transition active:scale-95"
                    onClick={() => void handleSend()}
                    disabled={!connected || !draft.trim() || sending}
                    aria-label="Send message"
                  >
                    <Icon.Send className="mx-auto h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
