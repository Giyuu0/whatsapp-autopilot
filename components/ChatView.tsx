"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Toggle, Select } from "./ui";
import type { Chat, Message, Language, Tone, VoiceReply, ManualReply, Suggestion } from "./useWaSocket";

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

/**
 * Delivery status shown on your own sent messages as three colored dots:
 * red = sent, yellow = delivered, green = read (played counts as read).
 * Pending shows dim grey dots.
 */
function Ticks({ ack }: { ack?: number }) {
  const a = ack ?? 1;
  let color = "rgba(219,248,198,0.35)"; // pending / unknown → dim
  let label = "Pending";
  if (a >= 3) {
    color = "#22c55e"; // read (or played) → green
    label = "Read";
  } else if (a === 2) {
    color = "#facc15"; // delivered → yellow
    label = "Delivered";
  } else if (a === 1) {
    color = "#ef4444"; // sent → red
    label = "Sent";
  }
  return (
    <span className="inline-flex items-center gap-[3px]" title={label} aria-label={label}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-[5px] w-[5px] rounded-full"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
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

const MANUAL_OPTIONS: { value: ManualReply; label: string }[] = [
  { value: "default", label: "Default (global)" },
  { value: "off", label: "Auto-send" },
  { value: "on", label: "Manual (draft only)" },
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
  onToggleFavorite,
}: {
  chat: Chat;
  active: boolean;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string, favorite: boolean) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(chat.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(chat.id);
        }
      }}
      className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
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
          <div className="ml-1 flex shrink-0 items-center gap-1.5">
            {chat.unread > 0 && (
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-wa-green px-1.5 text-[11px] font-bold text-ink-950">
                {chat.unread > 99 ? "99+" : chat.unread}
              </span>
            )}
            {/* favorite star — visible when starred, or on hover */}
            <button
              type="button"
              title={chat.favorite ? "Remove from favorites" : "Add to favorites"}
              aria-label={chat.favorite ? "Remove from favorites" : "Add to favorites"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(chat.id, !chat.favorite);
              }}
              className={`text-base leading-none transition ${
                chat.favorite
                  ? "text-amber-400"
                  : "text-white/30 opacity-0 hover:text-amber-300 group-hover:opacity-100"
              }`}
            >
              {chat.favorite ? "★" : "☆"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- sticker loader --------------------------- */

/** Stickers always auto-preview: fetch the media once on mount, no button. */
function StickerLoader({ onLoad }: { onLoad: () => Promise<any> }) {
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    onLoad().catch(() => {});
  }, [onLoad]);
  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-black/10">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-wa-green" />
    </div>
  );
}

/* --------------------------------- bubble --------------------------------- */

function MessageBubble({
  msg,
  onLoadMedia,
  onDelete,
  onEdit,
}: {
  msg: Message;
  onLoadMedia: (id: string) => Promise<any>;
  onDelete: (messageId: string) => void;
  onEdit: (messageId: string, text: string) => void;
}) {
  const mine = msg.fromMe;
  const showModel = msg.isAutoReply && msg.model;
  const [loadingImg, setLoadingImg] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(msg.text || "");
  const caption = msg.text && msg.text !== "📷 Photo" ? msg.text : "";
  const isVoice = msg.type === "voice" || msg.type === "audio";
  // Edit/delete affordances only for your own, non-private, non-deleted messages.
  const canModify = msg.fromMe && !msg.private && !msg.deleted;

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

  // Deleted-for-everyone tombstone — muted italic, no media / ticks / actions.
  if (msg.deleted) {
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div
          className={`relative max-w-[75%] rounded-2xl px-3 py-1.5 shadow-md ring-1 ring-inset ${
            mine
              ? "rounded-br-sm bg-gradient-to-br from-wa-green/15 to-wa-teal/10 ring-wa-green/10"
              : "rounded-bl-sm bg-ink-700/40 ring-white/5"
          }`}
        >
          <div className="whitespace-pre-wrap break-words pr-1 text-sm italic leading-relaxed text-white/40">
            🚫 You deleted this message
          </div>
          <div
            className={`mt-0.5 flex items-center gap-1.5 text-[10px] ${
              mine ? "justify-end text-wa-light/40" : "text-white/30"
            }`}
          >
            <span>{fmtTime(msg.ts)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[75%] rounded-2xl px-3 py-1.5 shadow-md ring-1 ring-inset ${
          mine
            ? "rounded-br-sm bg-gradient-to-br from-wa-green/25 to-wa-teal/15 text-wa-light ring-wa-green/10"
            : "rounded-bl-sm bg-ink-700/60 text-white/90 ring-white/5"
        }`}
      >
        {/* hover actions — edit / delete your own messages */}
        {canModify && !editing && (
          <div
            className={`absolute -top-2 ${
              mine ? "right-2" : "left-2"
            } flex items-center gap-1 rounded-full bg-ink-900/90 px-1 py-0.5 opacity-0 shadow ring-1 ring-white/10 transition group-hover:opacity-100`}
          >
            <button
              type="button"
              onClick={() => {
                setEditDraft(msg.text || "");
                setEditing(true);
              }}
              className="rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Edit message"
              title="Edit"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Delete this message for everyone?")) onDelete(msg.id);
              }}
              className="rounded-full p-1 text-white/60 transition hover:bg-rose-500/20 hover:text-rose-300"
              aria-label="Delete message"
              title="Delete"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>
        )}

        {editing ? (
          <div className="min-w-[220px]">
            <textarea
              className="input min-h-[70px] w-full resize-y text-sm"
              value={editDraft}
              autoFocus
              onChange={(e) => setEditDraft(e.target.value)}
            />
            <div className="mt-1.5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn-ghost !py-1 text-xs"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary !py-1 text-xs"
                onClick={() => {
                  const next = editDraft.trim();
                  onEdit(msg.id, next);
                  setEditing(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        ) : msg.type === "image" ? (
          <div className={msg.sticker ? "max-w-[160px]" : "max-w-[260px]"}>
            {msg.viewOnce && (
              <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-amber-300/90">
                👁️ View once
              </div>
            )}
            {msg.media ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={msg.media}
                alt={msg.sticker ? "sticker" : "photo"}
                className={
                  msg.sticker
                    ? "max-h-40 w-auto object-contain drop-shadow-sm"
                    : "max-h-72 w-full rounded-xl object-cover"
                }
              />
            ) : msg.sticker ? (
              // Sticker media is auto-loaded server-side; if it isn't ready yet,
              // fetch it silently once (no button — stickers always preview).
              <StickerLoader onLoad={() => onLoadMedia(msg.id)} />
            ) : (
              <button
                type="button"
                onClick={async () => {
                  setLoadingImg(true);
                  try {
                    await onLoadMedia(msg.id);
                  } finally {
                    setLoadingImg(false);
                  }
                }}
                disabled={loadingImg}
                className="flex h-32 w-full min-w-[180px] flex-col items-center justify-center gap-1 rounded-xl bg-black/25 text-xs text-white/70 transition hover:bg-black/35"
              >
                {loadingImg ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-wa-green" />
                ) : (
                  <>
                    <span className="text-2xl">📷</span>
                    <span>Tap to view photo</span>
                  </>
                )}
              </button>
            )}
            {caption && !msg.sticker && (
              <div className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{caption}</div>
            )}
          </div>
        ) : isVoice ? (
          <div className="min-w-[200px]">
            {caption && (
              <div className="mb-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                {msg.type === "voice" && <span className="mr-1">🎤</span>}
                {msg.type === "audio" && <span className="mr-1">🎧</span>}
                {caption}
              </div>
            )}
            {msg.media ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio controls src={msg.media} className="mt-1 h-9 w-full max-w-[240px]" />
            ) : (
              <button
                type="button"
                onClick={async () => {
                  setLoadingMedia(true);
                  try {
                    await onLoadMedia(msg.id);
                  } finally {
                    setLoadingMedia(false);
                  }
                }}
                disabled={loadingMedia}
                className="mt-1 flex items-center gap-2 rounded-full bg-black/25 px-3 py-1.5 text-xs text-white/70 transition hover:bg-black/35"
              >
                {loadingMedia ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-wa-green" />
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span>Play voice</span>
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words pr-1 text-sm leading-relaxed">
            {msg.text || ""}
          </div>
        )}
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
          {msg.edited && <span className="italic opacity-70">edited</span>}
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
  onSetManual: (chatId: string, mode: ManualReply) => void;
  onSetCustomPrompt: (chatId: string, prompt: string) => void;
  onSetMemory: (chatId: string, memory: string) => void;
  onToggleFavorite: (chatId: string, favorite: boolean) => void;
  onChatAssistant: (chatId: string, command: string) => Promise<any>;
  onLoadMedia: (chatId: string, messageId: string) => Promise<any>;
  onDeleteMessage: (chatId: string, messageId: string) => Promise<any>;
  onEditMessage: (chatId: string, messageId: string, text: string) => Promise<any>;
  onSendMedia: (
    chatId: string,
    media: { base64: string; mimetype: string; filename?: string; caption?: string; asVoice?: boolean }
  ) => Promise<any>;
  suggestion: Suggestion | null;
  onClearSuggestion: (chatId: string) => void;
  connected: boolean;
  typing: boolean; // the bot is composing a reply to the active chat
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
    onSetManual,
    onSetCustomPrompt,
    onSetMemory,
    onToggleFavorite,
    onChatAssistant,
    onLoadMedia,
    onDeleteMessage,
    onEditMessage,
    onSendMedia,
    suggestion,
    onClearSuggestion,
    connected,
    typing,
  } = props;

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "fav">("all");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");
  const [memoryDraft, setMemoryDraft] = useState("");
  const [sendingMedia, setSendingMedia] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);
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

  const unreadCount = useMemo(() => chats.filter((c) => c.unread > 0).length, [chats]);
  const favCount = useMemo(() => chats.filter((c) => c.favorite).length, [chats]);

  const sortedChats = useMemo(() => {
    let list = [...chats].sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
    if (filter === "unread") list = list.filter((c) => c.unread > 0);
    else if (filter === "fav") list = list.filter((c) => c.favorite);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.number || "").toLowerCase().includes(q)
    );
  }, [chats, query, filter]);

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

  // Keep the typing indicator visible if the user is pinned to the bottom.
  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [typing]);

  // reset the persona + memory editors when switching chats
  useEffect(() => {
    setShowPrompt(false);
    setPromptDraft(activeChat?.customPrompt || "");
    setMemoryDraft(activeChat?.memory || "");
    setDraft("");
  }, [activeChatId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual mode (draft only): when the bot drafts a reply, drop it straight
  // into the composer so you can edit and send it. Only auto-fills when you
  // haven't typed anything yourself (never clobbers your own text).
  useEffect(() => {
    if (suggestion && suggestion.text && !draft.trim() && activeChatId) {
      setDraft(suggestion.text);
      onClearSuggestion(activeChatId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion]);

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
        const res = await onChatAssistant(activeChatId, cmd);
        // Manual mode: the bot returns a draft instead of sending — drop it
        // straight into the composer so you can review and send it yourself.
        if (res?.draft && res.message) {
          setDraft(res.message);
          return;
        }
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

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file || !activeChatId || !connected || sendingMedia) {
      input.value = "";
      return;
    }
    setSendingMedia(true);
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          // strip the "data:...;base64," prefix
          const comma = result.indexOf(",");
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      await onSendMedia(activeChatId, {
        base64,
        mimetype: file.type,
        filename: file.name,
        caption: draft.trim() || undefined,
      });
      setDraft("");
    } catch {
      /* leave draft intact so the user can retry */
    } finally {
      setSendingMedia(false);
      input.value = "";
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
            {/* filter tabs */}
            <div className="mt-2.5 flex items-center gap-1.5">
              {([
                { key: "all", label: "All", count: 0 },
                { key: "unread", label: "Unread", count: unreadCount },
                { key: "fav", label: "★ Favorites", count: favCount },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFilter(t.key)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
                    filter === t.key
                      ? "bg-wa-green text-ink-950"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-[10px] font-bold ${
                        filter === t.key ? "bg-ink-950/20 text-ink-950" : "bg-white/10 text-white/70"
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {sortedChats.length === 0 ? (
              <div className="px-3 py-10 text-center text-sm text-white/40">
                {chats.length === 0
                  ? "No chats yet"
                  : filter === "unread"
                    ? "No unread chats"
                    : filter === "fav"
                      ? "No favorites yet — tap the ★ on a chat to add it"
                      : "No chats match your search"}
              </div>
            ) : (
              sortedChats.map((chat) => (
                <ChatRow
                  key={chat.id}
                  chat={chat}
                  active={chat.id === activeChatId}
                  onOpen={onOpenChat}
                  onToggleFavorite={onToggleFavorite}
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

                    <div className="flex items-center gap-1">
                      <span className="hidden text-[11px] text-white/50 lg:inline">Lang</span>
                      <Select
                        value={activeChat.language}
                        onChange={(v) => onSetLanguage(activeChat.id, v as Language)}
                        options={LANGUAGE_OPTIONS}
                        align="right"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="hidden text-[11px] text-white/50 lg:inline">Tone</span>
                      <Select
                        value={activeChat.tone}
                        onChange={(v) => onSetTone(activeChat.id, v as Tone)}
                        options={TONE_OPTIONS}
                        align="right"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="hidden text-[11px] text-white/50 lg:inline">Voice</span>
                      <Select
                        value={activeChat.voiceReply}
                        onChange={(v) => onSetVoiceReply(activeChat.id, v as VoiceReply)}
                        options={VOICE_OPTIONS}
                        align="right"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="hidden text-[11px] text-white/50 lg:inline">Mode</span>
                      <Select
                        value={activeChat.manualReply}
                        onChange={(v) => onSetManual(activeChat.id, v as ManualReply)}
                        options={MANUAL_OPTIONS}
                        align="right"
                      />
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

                    {/* contact memory editor */}
                    <div className="mt-4 border-t border-white/10 pt-3">
                      <label className="label">Memory (what the bot knows about this person)</label>
                      <textarea
                        className="input mt-1 min-h-[80px] resize-y text-sm"
                        placeholder="e.g. Prefers short replies. Works night shifts. Has a dog named Rex…"
                        value={memoryDraft}
                        onChange={(e) => setMemoryDraft(e.target.value)}
                      />
                      <p className="mt-1 text-[11px] text-white/40">
                        The bot updates this automatically over time — you can edit or clear it.
                      </p>
                      <div className="mt-2 flex items-center justify-end">
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => onSetMemory(activeChat.id, memoryDraft.trim())}
                        >
                          Save memory
                        </button>
                      </div>
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
                        <MessageBubble
                          msg={m}
                          onLoadMedia={(id) => onLoadMedia(activeChat.id, id)}
                          onDelete={(id) => onDeleteMessage(activeChat.id, id)}
                          onEdit={(id, t) => onEditMessage(activeChat.id, id, t)}
                        />
                      </React.Fragment>
                    );
                  })
                )}
                {typing && (
                  <div className="animate-fade-up flex justify-start">
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-ink-700/60 px-3 py-2.5 shadow-md ring-1 ring-inset ring-white/5">
                      <span className="sr-only">typing…</span>
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50" />
                    </div>
                  </div>
                )}
              </div>

              {/* manual-mode suggested reply (drafted, not sent) */}
              {suggestion && (
                <div className="animate-fade-up border-t border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 font-medium text-amber-300">
                      🤖 Suggested reply {suggestion.model && <span className="text-amber-200/50">· {prettyModel(suggestion.model)}</span>}
                    </span>
                    <button
                      type="button"
                      className="text-white/40 hover:text-white/70"
                      onClick={() => onClearSuggestion(activeChat.id)}
                    >
                      ✕
                    </button>
                  </div>
                  <p className="mb-2 whitespace-pre-wrap break-words text-sm text-slate-100">{suggestion.text}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary !py-1.5 text-xs"
                      disabled={!connected || sending}
                      onClick={async () => {
                        setSending(true);
                        try {
                          await onSendMessage(activeChat.id, suggestion.text);
                        } finally {
                          setSending(false);
                        }
                      }}
                    >
                      Send as-is
                    </button>
                    <button
                      type="button"
                      className="btn-ghost !py-1.5 text-xs"
                      onClick={() => {
                        setDraft(suggestion.text);
                        onClearSuggestion(activeChat.id);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}

              {/* composer */}
              <div className="border-t border-white/10 bg-black/20 p-3">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf,audio/*"
                    className="hidden"
                    onChange={handleFile}
                  />
                  <button
                    type="button"
                    className="btn-ghost h-11 w-11 shrink-0 rounded-full !p-0 transition active:scale-95"
                    onClick={() => fileRef.current?.click()}
                    disabled={!connected || sendingMedia}
                    aria-label="Attach a file"
                    title="Attach image, PDF or audio"
                  >
                    {sendingMedia ? (
                      <span className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-wa-green" />
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="mx-auto h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M21.44 11.05 12.25 20.24a5 5 0 0 1-7.07-7.07l9.19-9.19a3.34 3.34 0 0 1 4.72 4.72l-9.2 9.19a1.67 1.67 0 0 1-2.36-2.36l8.49-8.48" />
                      </svg>
                    )}
                  </button>
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
