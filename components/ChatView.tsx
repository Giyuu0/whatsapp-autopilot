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
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${
          mine
            ? "rounded-br-md bg-wa-green/15 text-wa-light"
            : "rounded-bl-md bg-white/5 text-white/90"
        }`}
      >
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {msg.type === "voice" && <span className="mr-1">🎤</span>}
          {msg.type === "audio" && <span className="mr-1">🎧</span>}
          {msg.type === "image" && <span className="mr-1">📷</span>}
          {msg.text || (msg.type === "voice" ? "Voice message" : msg.type === "image" ? "Photo" : "")}
        </div>
        <div
          className={`mt-1 flex items-center gap-2 text-[10px] ${
            mine ? "justify-end text-wa-light/60" : "text-white/40"
          }`}
        >
          {showModel && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-medium text-white/60">
              {prettyModel(msg.model)}
            </span>
          )}
          <span>{fmtTime(msg.ts)}</span>
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
    connected,
  } = props;

  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");

  const endRef = useRef<HTMLDivElement | null>(null);

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

  // auto-scroll to newest on message change / chat switch
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, activeChatId]);

  // reset the persona editor when switching chats
  useEffect(() => {
    setShowPrompt(false);
    setPromptDraft(activeChat?.customPrompt || "");
    setDraft("");
  }, [activeChatId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    const text = draft.trim();
    if (!text || !activeChatId || !connected || sending) return;
    setSending(true);
    try {
      await onSendMessage(activeChatId, text);
      setDraft("");
    } catch {
      /* keep draft on failure so the user can retry */
    } finally {
      setSending(false);
    }
  }

  const wallpaper: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.01)",
    backgroundImage:
      "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
    backgroundSize: "22px 22px",
  };

  return (
    <div className="card overflow-hidden p-0">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* ------------------------------ LEFT: list ------------------------------ */}
        <aside
          className={`flex flex-col border-white/10 md:border-r ${
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
          <div className="max-h-[70vh] flex-1 space-y-1 overflow-y-auto p-2">
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
          className={`flex min-h-[60vh] flex-col ${
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
                className="max-h-[70vh] flex-1 space-y-2 overflow-y-auto p-4"
                style={wallpaper}
              >
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-sm text-white/40">
                    No messages in this conversation yet
                  </div>
                ) : (
                  messages.map((m) => <MessageBubble key={m.id} msg={m} />)
                )}
                <div ref={endRef} />
              </div>

              {/* composer */}
              <div className="border-t border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder={connected ? "Type a message" : "Disconnected…"}
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
                    className="btn-primary h-10 w-10 shrink-0 !p-0"
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
