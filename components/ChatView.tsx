"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, Toggle, Select } from "./ui";
import { VoiceRecorder } from "./VoiceRecorder";
import type { Chat, Message, Language, Tone, VoiceReply, ManualReply, Suggestion } from "./useWaSocket";

/** True on phone-width viewports (client-only; updates on resize). */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setIsMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return isMobile;
}

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
  "bg-rose-500/25 text-rose-700 dark:text-rose-100",
  "bg-sky-500/25 text-sky-700 dark:text-sky-100",
  "bg-emerald-500/25 text-emerald-700 dark:text-emerald-100",
  "bg-amber-500/25 text-amber-700 dark:text-amber-100",
  "bg-violet-500/25 text-violet-700 dark:text-violet-100",
  "bg-cyan-500/25 text-cyan-700 dark:text-cyan-100",
  "bg-fuchsia-500/25 text-fuchsia-700 dark:text-fuchsia-100",
  "bg-teal-500/25 text-teal-700 dark:text-teal-100",
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
      <span className="rounded-full bg-fg/10 px-3 py-1 text-[11px] font-medium text-fg/70 shadow-sm backdrop-blur">
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
  hasDraft,
  onOpen,
  onToggleFavorite,
}: {
  chat: Chat;
  active: boolean;
  hasDraft?: boolean;
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
      className={`group flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98] active:bg-fg/10 md:min-h-0 ${
        active ? "bg-fg/10 ring-1 ring-wa-green/40" : "hover:bg-fg/5"
      }`}
    >
      <div className="relative">
        <Avatar id={chat.id} name={chat.name} />
        {chat.enabled && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-fg/10 bg-wa-green" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {chat.isGroup && <Icon.Users className="h-3.5 w-3.5 shrink-0 text-fg/40" />}
            <span className="truncate font-semibold text-fg/90">{chat.name}</span>
          </div>
          <span className="shrink-0 text-[11px] text-fg/40">{fmtTime(chat.lastTs)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          {hasDraft ? (
            <span className="truncate text-xs">
              <span className="font-medium text-wa-green">✎ Draft</span>
              <span className="text-fg/50"> — tap to review &amp; send</span>
            </span>
          ) : (
            <span className="truncate text-xs text-fg/50">{chat.lastText || "No messages yet"}</span>
          )}
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
              className={`grid h-11 w-11 shrink-0 place-items-center text-base leading-none transition active:scale-90 md:h-auto md:w-auto md:p-1.5 ${
                chat.favorite
                  ? "text-amber-400"
                  : // No hover on touch — keep the star reachable on mobile,
                    // hover-revealed on desktop as before.
                    "text-fg/30 opacity-60 hover:text-amber-300 md:opacity-0 md:group-hover:opacity-100"
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
    <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-fg/10">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-fg/20 border-t-wa-green" />
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
              ? "rounded-br-md border-amber-400/40 bg-amber-400/10 text-amber-800 dark:text-amber-100"
              : "rounded-bl-md border-violet-400/40 bg-violet-400/10 text-violet-800 dark:text-violet-100"
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
              : "rounded-bl-sm bg-surface-3/40 ring-fg/5"
          }`}
        >
          <div className="whitespace-pre-wrap break-words pr-1 text-sm italic leading-relaxed text-fg/40">
            🚫 You deleted this message
          </div>
          <div
            className={`mt-0.5 flex items-center gap-1.5 text-[10px] ${
              mine ? "justify-end text-emerald-900/50 dark:text-wa-light/40" : "text-fg/30"
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
        className={`relative max-w-[75%] animate-bubble-in rounded-2xl px-3 py-1.5 shadow-bubble ring-1 ring-inset backdrop-blur-sm ${
          mine
            ? "rounded-br-sm bg-gradient-to-br from-wa-green/35 via-wa-green/25 to-wa-teal/20 text-emerald-950 dark:text-wa-light ring-wa-green/20"
            : "rounded-bl-sm bg-surface-3/70 text-fg/90 ring-fg/10"
        }`}
      >
        {/* hover actions — edit / delete your own messages */}
        {canModify && !editing && (
          <div
            className={`absolute -top-2 ${
              mine ? "right-2" : "left-2"
            } flex items-center gap-1 rounded-full bg-surface-2/90 px-1 py-0.5 opacity-0 shadow ring-1 ring-fg/10 transition group-hover:opacity-100`}
          >
            <button
              type="button"
              onClick={() => {
                setEditDraft(msg.text || "");
                setEditing(true);
              }}
              className="rounded-full p-1 text-fg/60 transition hover:bg-fg/10 hover:text-fg"
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
              className="rounded-full p-1 text-fg/60 transition hover:bg-rose-500/20 hover:text-rose-300"
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

        {/* "needs you" flag on incoming messages the bot held for the owner */}
        {msg.attention && !mine && (
          <div className="mb-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
            🔔 {msg.attentionReason || "needs you"}
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
                className="flex h-32 w-full min-w-[180px] flex-col items-center justify-center gap-1 rounded-xl bg-fg/10 text-xs text-fg/70 transition hover:bg-fg/20"
              >
                {loadingImg ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-fg/20 border-t-wa-green" />
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
                className="mt-1 flex items-center gap-2 rounded-full bg-fg/10 px-3 py-1.5 text-xs text-fg/70 transition hover:bg-fg/20"
              >
                {loadingMedia ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-fg/20 border-t-wa-green" />
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
            mine ? "justify-end text-emerald-900/60 dark:text-wa-light/55" : "text-fg/40"
          }`}
        >
          {showModel && (
            <span className="rounded-full bg-fg/10 px-1.5 py-0.5 text-[9px] font-medium text-fg/60">
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
  onRewrite: (text: string, lang: string) => Promise<{ ok?: boolean; text?: string; error?: string }>;
  onLoadMedia: (chatId: string, messageId: string) => Promise<any>;
  onDeleteMessage: (chatId: string, messageId: string) => Promise<any>;
  onEditMessage: (chatId: string, messageId: string, text: string) => Promise<any>;
  onSendMedia: (
    chatId: string,
    media: { base64: string; mimetype: string; filename?: string; caption?: string; asVoice?: boolean }
  ) => Promise<any>;
  suggestion: Suggestion | null;
  draftChatIds?: string[];
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
    onRewrite,
    onLoadMedia,
    onDeleteMessage,
    onEditMessage,
    onSendMedia,
    suggestion,
    draftChatIds,
    onClearSuggestion,
    connected,
    typing,
  } = props;

  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "fav">("all");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // Compose helper: rewrite/translate the draft before sending.
  const [translateOn, setTranslateOn] = useState(false);
  const [translateLang, setTranslateLang] = useState<"english" | "english-slang">("english");
  const [rewriting, setRewriting] = useState(false);
  const [rewrittenText, setRewrittenText] = useState(""); // draft is "ready to send" when it equals this
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");
  const [memoryDraft, setMemoryDraft] = useState("");
  const [sendingMedia, setSendingMedia] = useState(false);
  const [dragOver, setDragOver] = useState(false); // highlight composer while dragging a file over it

  const fileRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true); // stay pinned to the bottom unless the user scrolls up
  // Per-chat composer text, so switching chats never loses (or crosses) what
  // you were writing/editing for each person.
  const draftStore = useRef<Record<string, string>>({});
  const draftRef = useRef("");
  const prevChatRef = useRef<string | null>(null);
  // Which server draft (by timestamp) each chat's composer already picked up.
  // We do NOT clear the server-side draft on pickup — it survives a page
  // refresh; the server clears it itself when the message is actually sent.
  const consumedDraftRef = useRef<Record<string, number>>({});
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

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
  const draftSet = useMemo(() => new Set(draftChatIds || []), [draftChatIds]);

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

  // Mobile only: while a conversation is open full-screen, lock the page
  // behind it so the dashboard can't scroll underneath. Desktop untouched.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      document.body.style.overflow = activeChatId && mq.matches ? "hidden" : "";
    };
    apply();
    mq.addEventListener?.("change", apply);
    return () => {
      mq.removeEventListener?.("change", apply);
      document.body.style.overflow = "";
    };
  }, [activeChatId]);

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

  // Switch chats: reset editors, stash the previous chat's composer text, and
  // load THIS chat's own text — its saved local draft, or a pending manual-mode
  // draft. Strictly per-chat, so one person's draft can never land in another
  // person's input box.
  useEffect(() => {
    setShowPrompt(false);
    setPromptDraft(activeChat?.customPrompt || "");
    setMemoryDraft(activeChat?.memory || "");
    const prev = prevChatRef.current;
    if (prev && prev !== activeChatId) draftStore.current[prev] = draftRef.current;
    prevChatRef.current = activeChatId;
    setRewrittenText(""); // translate "ready" state never carries across chats
    let next = activeChatId ? draftStore.current[activeChatId] || "" : "";
    if (!next && suggestion?.text && activeChatId && consumedDraftRef.current[activeChatId] !== suggestion.ts) {
      next = suggestion.text; // pull in a pending manual-mode draft
      consumedDraftRef.current[activeChatId] = suggestion.ts;
    }
    setDraft(next);
  }, [activeChatId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual mode (draft only): when the bot drafts a reply for the chat you're
  // viewing, drop it straight into the composer — only if you haven't already
  // typed something yourself (never clobbers your own text).
  useEffect(() => {
    if (
      suggestion?.text &&
      !draftRef.current.trim() &&
      activeChatId &&
      consumedDraftRef.current[activeChatId] !== suggestion.ts
    ) {
      setDraft(suggestion.text);
      consumedDraftRef.current[activeChatId] = suggestion.ts;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || !activeChatId || sending || rewriting) return;
    // "@bot ..." is a PRIVATE aside to your assistant about this chat — it is
    // NOT sent to the person. The bot replies "@yati ..." (also private).
    const isBot = /^@bot\b/i.test(text);
    if (!isBot && !connected) return;

    // Translate/rewrite mode: the FIRST Enter/Send rewrites the draft in place
    // (into the chosen language); the SECOND one actually sends it. We treat
    // the draft as "ready" once it matches the last rewrite output.
    if (translateOn && !isBot && text !== rewrittenText.trim()) {
      setRewriting(true);
      try {
        const res = await onRewrite(text, translateLang);
        if (res?.ok && res.text) {
          setDraft(res.text);
          setRewrittenText(res.text);
        }
      } finally {
        setRewriting(false);
      }
      return; // don't send yet — let the user review, then Enter/Send again
    }

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
      if (activeChatId) delete draftStore.current[activeChatId];
      setDraft("");
      setRewrittenText(""); // next identical draft must go through rewrite again
    } catch {
      /* keep draft on failure so the user can retry */
    } finally {
      setSending(false);
    }
  }

  // Core send-a-file routine, shared by the attach button, paste and drag-drop.
  async function sendFile(file: File) {
    if (!file || !activeChatId || !connected || sendingMedia) return;
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
        // Pasted screenshots come through as a blank/"image.png" name — give them a unique one.
        filename: file.name || `pasted-${Date.now()}.${(file.type.split("/")[1] || "png").split("+")[0]}`,
        caption: draft.trim() || undefined,
      });
      setDraft("");
    } catch {
      /* leave draft intact so the user can retry */
    } finally {
      setSendingMedia(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (file) await sendFile(file);
    input.value = "";
  }

  // Paste an image/file straight into the composer (Ctrl/⌘+V).
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const items = Array.from(e.clipboardData?.items || []);
    const fileItem = items.find((it) => it.kind === "file");
    if (!fileItem) return; // plain text paste — let it fall through to the input
    const file = fileItem.getAsFile();
    if (file) {
      e.preventDefault();
      void sendFile(file);
    }
  }

  // Drag-and-drop a file onto the composer.
  function handleDrop(e: React.DragEvent<HTMLElement>) {
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      e.preventDefault();
      setDragOver(false);
      void sendFile(file);
    }
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="grid h-[calc(100dvh-13rem)] min-h-[440px] grid-cols-1 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* ------------------------------ LEFT: list ------------------------------ */}
        <aside
          className={`flex min-h-0 flex-col border-fg/10 md:border-r ${
            activeChatId ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="border-b border-fg/10 p-3">
            <div className="relative">
              <Icon.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
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
                  className={`flex min-h-[40px] items-center gap-1 rounded-full px-3.5 py-1 text-xs font-medium transition active:scale-[0.98] md:min-h-0 md:px-3 ${
                    filter === t.key
                      ? "bg-wa-green text-ink-950"
                      : "bg-fg/5 text-fg/60 hover:bg-fg/10 hover:text-fg/80 active:bg-fg/10"
                  }`}
                >
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-[10px] font-bold ${
                        filter === t.key ? "bg-surface/20 text-ink-950" : "bg-fg/10 text-fg/70"
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="scroll-touch min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {sortedChats.length === 0 ? (
              <div className="px-3 py-10 text-center text-sm text-fg/40">
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
                  hasDraft={draftSet.has(chat.id) && chat.id !== activeChatId}
                  onOpen={onOpenChat}
                  onToggleFavorite={onToggleFavorite}
                />
              ))
            )}
          </div>
        </aside>

        {/* --------------------------- RIGHT: conversation --------------------------- */}
        {(() => {
          const panel = (
        <section
          className={`flex min-h-0 flex-col ${activeChatId ? "h-full" : "hidden md:flex"}`}
        >
          {!activeChat ? (
            <div className="chat-wallpaper relative flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="relative animate-float">
                <span className="absolute inset-0 -z-10 rounded-full bg-wa-green/25 blur-2xl" />
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-wa-green/30 to-wa-teal/15 ring-1 ring-inset ring-wa-green/25 shadow-glow">
                  <Icon.Send className="h-8 w-8 text-wa-green" />
                </div>
              </div>
              <div className="text-base font-semibold text-fg/85">
                Select a chat to start
              </div>
              <div className="max-w-xs text-xs leading-relaxed text-fg/45">
                Pick a conversation from the list to read messages and manage its
                auto-reply settings — language, tone, voice replies and more.
              </div>
            </div>
          ) : (
            <>
              {/* header */}
              <div className="sticky top-0 z-10 border-b border-fg/10 bg-gradient-to-b from-surface-1/80 to-surface-1/50 p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl md:pt-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {/* back button (mobile only) */}
                  <button
                    type="button"
                    onClick={() => onOpenChat("")}
                    className="btn-ghost min-h-[44px] shrink-0 px-3 active:scale-[0.98] active:bg-fg/10 md:hidden"
                    aria-label="Back to chats"
                  >
                    ‹ Back
                  </button>
                  <div className="relative shrink-0">
                    <Avatar id={activeChat.id} name={activeChat.name} size="lg" />
                    {activeChat.enabled && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-fg/10 bg-wa-green"
                        title="Auto-reply active"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {activeChat.isGroup && (
                        <Icon.Users className="h-3.5 w-3.5 shrink-0 text-fg/40" />
                      )}
                      <span className="truncate font-semibold text-fg/90">
                        {activeChat.name}
                      </span>
                      <button
                        type="button"
                        title={activeChat.favorite ? "Remove from favorites" : "Add to favorites"}
                        onClick={() => onToggleFavorite(activeChat.id, !activeChat.favorite)}
                        className={`-m-1.5 shrink-0 p-1.5 text-sm leading-none transition active:scale-90 ${
                          activeChat.favorite ? "text-amber-400" : "text-fg/25 hover:text-amber-300"
                        }`}
                      >
                        {activeChat.favorite ? "★" : "☆"}
                      </button>
                    </div>
                    <div className="flex h-4 items-center truncate text-xs">
                      {typing ? (
                        <span className="flex items-center gap-1.5 font-medium text-wa-green">
                          typing
                          <span className="flex gap-0.5">
                            <span className="h-1 w-1 animate-bounce rounded-full bg-wa-green [animation-delay:-0.3s]" />
                            <span className="h-1 w-1 animate-bounce rounded-full bg-wa-green [animation-delay:-0.15s]" />
                            <span className="h-1 w-1 animate-bounce rounded-full bg-wa-green" />
                          </span>
                        </span>
                      ) : (
                        <span className="truncate text-fg/45">+{activeChat.number}</span>
                      )}
                    </div>
                  </div>

                  {/* mobile: single gear opens a full-width settings sheet
                      (the cramped inline row is hidden on phones) */}
                  <button
                    type="button"
                    onClick={() => {
                      setPromptDraft(activeChat.customPrompt || "");
                      setMemoryDraft(activeChat.memory || "");
                      setShowPrompt((s) => !s);
                    }}
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition active:scale-95 md:hidden ${
                      showPrompt ? "bg-wa-green/20 text-wa-green" : "bg-fg/5 text-fg/70"
                    }`}
                    aria-label="Chat settings"
                    title="Chat settings"
                  >
                    <Icon.Cog className="h-5 w-5" />
                  </button>

                  {/* controls — desktop inline row (hidden on mobile; see sheet below) */}
                  <div className="no-scrollbar scroll-touch -mx-1 hidden w-full flex-nowrap items-center justify-start gap-2 overflow-x-auto px-1 py-0.5 md:mx-0 md:flex md:w-auto md:flex-wrap md:justify-end md:overflow-visible md:px-0 md:py-0">
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-[11px] text-fg/50">Auto-reply</span>
                      <Toggle
                        checked={activeChat.enabled}
                        onChange={(v) => onToggleEnabled(activeChat.id, v)}
                        size="sm"
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="hidden text-[11px] text-fg/50 lg:inline">Lang</span>
                      <Select
                        value={activeChat.language}
                        onChange={(v) => onSetLanguage(activeChat.id, v as Language)}
                        options={LANGUAGE_OPTIONS}
                        align="right"
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="hidden text-[11px] text-fg/50 lg:inline">Tone</span>
                      <Select
                        value={activeChat.tone}
                        onChange={(v) => onSetTone(activeChat.id, v as Tone)}
                        options={TONE_OPTIONS}
                        align="right"
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="hidden text-[11px] text-fg/50 lg:inline">Voice</span>
                      <Select
                        value={activeChat.voiceReply}
                        onChange={(v) => onSetVoiceReply(activeChat.id, v as VoiceReply)}
                        options={VOICE_OPTIONS}
                        align="right"
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="hidden text-[11px] text-fg/50 lg:inline">Mode</span>
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
                      className={`btn-ghost h-9 shrink-0 px-2.5 active:scale-[0.98] active:bg-fg/10 md:h-8 md:px-2 ${
                        showPrompt ? "bg-fg/10 text-fg" : ""
                      }`}
                      aria-label="Edit persona"
                      title="Per-chat persona"
                    >
                      <Icon.Cog className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* inline persona editor (+ full-width per-chat controls on mobile) */}
                {showPrompt && (
                  <div className="animate-fade-up mt-3 rounded-xl border border-fg/10 bg-fg/5 p-3">
                    {/* MOBILE-ONLY: the per-chat controls as big, easy full-width rows */}
                    <div className="mb-4 space-y-1 md:hidden">
                      <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-fg/10 pb-2">
                        <span className="text-sm text-fg/80">Auto-reply</span>
                        <Toggle checked={activeChat.enabled} onChange={(v) => onToggleEnabled(activeChat.id, v)} />
                      </div>
                      <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-fg/10 pb-1 pt-1">
                        <span className="text-sm text-fg/80">Language</span>
                        <Select value={activeChat.language} onChange={(v) => onSetLanguage(activeChat.id, v as Language)} options={LANGUAGE_OPTIONS} align="right" />
                      </div>
                      <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-fg/10 pb-1 pt-1">
                        <span className="text-sm text-fg/80">Tone</span>
                        <Select value={activeChat.tone} onChange={(v) => onSetTone(activeChat.id, v as Tone)} options={TONE_OPTIONS} align="right" />
                      </div>
                      <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-fg/10 pb-1 pt-1">
                        <span className="text-sm text-fg/80">Voice reply</span>
                        <Select value={activeChat.voiceReply} onChange={(v) => onSetVoiceReply(activeChat.id, v as VoiceReply)} options={VOICE_OPTIONS} align="right" />
                      </div>
                      <div className="flex min-h-[44px] items-center justify-between gap-3 pt-1">
                        <span className="text-sm text-fg/80">Reply mode</span>
                        <Select value={activeChat.manualReply} onChange={(v) => onSetManual(activeChat.id, v as ManualReply)} options={MANUAL_OPTIONS} align="right" />
                      </div>
                    </div>
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
                    <div className="mt-4 border-t border-fg/10 pt-3">
                      <label className="label">Memory (what the bot knows about this person)</label>
                      <textarea
                        className="input mt-1 min-h-[80px] resize-y text-sm"
                        placeholder="e.g. Prefers short replies. Works night shifts. Has a dog named Rex…"
                        value={memoryDraft}
                        onChange={(e) => setMemoryDraft(e.target.value)}
                      />
                      <p className="mt-1 text-[11px] text-fg/40">
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
                className="chat-wallpaper scroll-touch min-h-0 flex-1 space-y-2 overflow-y-auto p-3 sm:p-4"
              >
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-sm text-fg/40">
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
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-surface-3/60 px-3 py-2.5 shadow-md ring-1 ring-inset ring-fg/5">
                      <span className="sr-only">typing…</span>
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg/50 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg/50 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg/50" />
                    </div>
                  </div>
                )}
              </div>

              {/* Manual-mode drafts are dropped straight into the composer
                  below (no separate suggestion card). */}

              {/* composer */}
              <div className="border-t border-fg/10 bg-fg/5 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
                {/* translate / rewrite controls */}
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTranslateOn((v) => !v);
                      setRewrittenText("");
                    }}
                    title="Rewrite your message into English before sending"
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-[0.98] md:py-1 ${
                      translateOn ? "bg-wa-green text-ink-950" : "bg-fg/5 text-fg/60 hover:bg-fg/10 hover:text-fg/80 active:bg-fg/10"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 5h7M9 3v2c0 4.5-2 7-5 9M5 9c0 2.5 2.5 5 6 6" />
                      <path d="M14 19l3-7 3 7M14.5 17h5" />
                    </svg>
                    Translate
                  </button>
                  {translateOn && (
                    <>
                      {(
                        [
                          { key: "english", label: "English" },
                          { key: "english-slang", label: "English + slang" },
                        ] as const
                      ).map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => {
                            setTranslateLang(o.key);
                            setRewrittenText("");
                          }}
                          className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium transition active:scale-[0.98] md:py-1 ${
                            translateLang === o.key
                              ? "bg-fg/15 text-fg/90 ring-1 ring-inset ring-wa-green/40"
                              : "bg-fg/5 text-fg/55 hover:bg-fg/10 active:bg-fg/10"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                      <span className="text-[11px] text-fg/40">
                        {rewriting
                          ? "Rewriting…"
                          : draft.trim() && draft.trim() === rewrittenText.trim()
                            ? "Ready — press Enter to send"
                            : "Press Enter to rewrite, again to send"}
                      </span>
                    </>
                  )}
                </div>
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
                      <span className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-fg/20 border-t-wa-green" />
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
                    className={`input flex-1 !rounded-full !bg-surface-2/80 px-4 ${
                      dragOver ? "ring-2 ring-wa-green" : /^@bot\b/i.test(draft) ? "ring-2 ring-amber-400/50" : ""
                    }`}
                    placeholder={
                      dragOver
                        ? "Drop to send…"
                        : connected
                          ? "Type a message — or “@bot …” to ask privately"
                          : "Disconnected…"
                    }
                    value={draft}
                    disabled={!connected}
                    onChange={(e) => setDraft(e.target.value)}
                    onPaste={handlePaste}
                    onDrop={handleDrop}
                    onDragOver={(e) => {
                      if (Array.from(e.dataTransfer?.types || []).includes("Files")) {
                        e.preventDefault();
                        setDragOver(true);
                      }
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <VoiceRecorder
                    disabled={!connected || sendingMedia}
                    onSend={async (base64, mimetype) => {
                      setSendingMedia(true);
                      try {
                        await onSendMedia(activeChat.id, { base64, mimetype, filename: "voice.ogg", asVoice: true });
                      } finally {
                        setSendingMedia(false);
                      }
                    }}
                  />
                  {(() => {
                    const needsRewrite =
                      translateOn && !!draft.trim() && draft.trim() !== rewrittenText.trim() && !/^@bot\b/i.test(draft);
                    return (
                      <button
                        type="button"
                        className="btn-primary h-11 w-11 shrink-0 rounded-full !p-0 transition active:scale-95"
                        onClick={() => void handleSend()}
                        disabled={!connected || !draft.trim() || sending || rewriting}
                        aria-label={needsRewrite ? "Rewrite message" : "Send message"}
                        title={needsRewrite ? "Rewrite into " + (translateLang === "english-slang" ? "English + slang" : "English") : "Send"}
                      >
                        {rewriting ? (
                          <span className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" />
                        ) : needsRewrite ? (
                          <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4L12 3z" />
                            <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
                          </svg>
                        ) : (
                          <Icon.Send className="mx-auto h-4 w-4" />
                        )}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </section>
          );
          // On phones, the open conversation is portaled to <body> as a
          // full-screen overlay. This escapes every ancestor's stacking /
          // overflow / containing-block context (deep-nested position:fixed is
          // unreliable on iOS Safari) so it always covers the whole screen with
          // nothing bleeding through. Desktop renders inline in the card grid.
          if (mounted && isMobile && activeChatId) {
            return createPortal(
              <div className="fixed inset-0 z-[60] flex flex-col bg-surface" style={{ height: "100dvh" }}>
                {panel}
              </div>,
              document.body
            );
          }
          return panel;
        })()}
      </div>
    </div>
  );
}
