"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useWaSocket, type Language, type Tone, type VoiceReply, type ManualReply } from "@/components/useWaSocket";
import { ConnectionCard } from "@/components/ConnectionCard";
import { ChatView } from "@/components/ChatView";
import { ChatbotOrb } from "@/components/ChatbotOrb";
import { StatCards } from "@/components/StatCards";
import { LoginScreen } from "@/components/LoginScreen";
import { Footer } from "@/components/Footer";
import { Toggle } from "@/components/ui";

export default function Dashboard() {
  const {
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
    clearSuggestion,
    enableNotifications,
    loadMedia,
    authState,
    authError,
    login,
    lock,
  } = useWaSocket();

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [notifOn, setNotifOn] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  React.useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setNotifOn(Notification.permission === "granted");
    try {
      const t = localStorage.getItem("wa-theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("wa-theme", next);
    } catch {}
  };

  if (authState === "unauthorized") {
    return <LoginScreen onSubmit={login} error={authError} />;
  }

  if (!snap) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-fg/10 border-t-wa-green" />
          <p className="text-sm text-fg/60">
            {connected ? "Loading dashboard…" : "Connecting to server…"}
          </p>
        </div>
      </div>
    );
  }

  const s = snap.settings;
  const isConnected = snap.status === "connected";

  const handleOpenChat = (id: string) => {
    setActiveChatId(id);
    openChat(id);
  };
  const patchContact = (id: string, patch: any) => emit("contact:update", { id, patch });

  return (
    <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="logo-glow flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-wa-green to-wa-teal text-ink-950">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm5.8 14.06c-.25.7-1.44 1.33-1.99 1.37-.53.04-1.02.24-3.45-.72-2.9-1.14-4.75-4.1-4.9-4.29-.14-.2-1.17-1.55-1.17-2.96s.74-2.1 1-2.39c.25-.29.55-.36.73-.36l.53.01c.17.01.4-.06.62.48.25.6.85 2.08.92 2.23.07.15.12.32.02.51-.1.2-.15.32-.29.49l-.44.51c-.14.14-.29.3-.12.58.17.29.76 1.25 1.63 2.03 1.12 1 2.07 1.3 2.36 1.45.29.14.46.12.63-.07.17-.2.73-.85.92-1.14.2-.29.4-.24.67-.14.27.1 1.7.8 1.99.95.29.14.48.22.55.34.07.12.07.72-.18 1.42Z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tighter text-fg sm:text-xl">
              WhatsApp <span className="text-gradient-wa">AutoPilot</span>
            </h1>
            <p className="text-xs text-fg/60">
              Groq replies to text &amp; voice · Gemini sees images · you pick who gets replies
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
          {/* Master switch */}
          <div className="card card-hover flex flex-1 items-center gap-3 !rounded-2xl px-3 py-2.5 sm:flex-none sm:px-4">
            <div className="mr-auto text-left sm:mr-0 sm:text-right">
              <p className="text-sm font-semibold text-fg">Auto-reply</p>
              <p className={`text-xs ${s.autoReplyEnabled ? "text-wa-green" : "text-fg/45"}`}>
                {s.autoReplyEnabled ? "Active" : "Paused"}
              </p>
            </div>
            <Toggle
              checked={s.autoReplyEnabled}
              onChange={(v) => emit("settings:update", { autoReplyEnabled: v })}
            />
          </div>

          {/* Icon actions — consistent pill group */}
          <div className="card flex items-center gap-1 !rounded-2xl p-1">
            {/* Notifications */}
            <button
              onClick={async () => {
                const p = await enableNotifications();
                setNotifOn(p === "granted");
              }}
              title={notifOn ? "Notifications on" : "Enable browser notifications"}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-fg/5 ${
                notifOn ? "text-wa-green" : "text-fg/60 hover:text-fg/90"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-fg/60 transition-colors hover:bg-fg/5 hover:text-wa-green"
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            {/* Settings link */}
            <Link
              href="/settings"
              title="Settings"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-fg/60 transition-colors hover:bg-fg/5 hover:text-wa-green"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </Link>

            {/* Lock */}
            <button
              onClick={lock}
              title="Lock dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-fg/60 transition-colors hover:bg-fg/5 hover:text-red-300"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="mb-6">
        <StatCards stats={snap.stats} />
      </div>

      {/* Main content */}
      {!isConnected ? (
        <div className="mx-auto max-w-md">
          <ConnectionCard
            snap={snap}
            onLogout={() => emit("wa:logout")}
            onRestart={() => emit("wa:restart")}
            onRefresh={() => emit("contacts:refresh")}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* slim connected toolbar */}
          <div className="card card-hover flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-wa-green opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-wa-green" />
              </span>
              <span className="min-w-0 break-words text-fg/90">
                Connected as <b>{snap.me?.name || "you"}</b>{" "}
                <span className="text-fg/45">+{snap.me?.number}</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="btn-ghost !py-1.5 text-xs"
                onClick={() => emit("contacts:refresh")}
                disabled={snap.sync?.syncing}
              >
                {snap.sync?.syncing ? "Syncing…" : "Sync chats"}
              </button>
              <button className="btn-ghost !py-1.5 text-xs" onClick={() => emit("wa:restart")}>
                Restart
              </button>
              <button className="btn-danger !py-1.5 text-xs" onClick={() => emit("wa:logout")}>
                Log out
              </button>
            </div>
          </div>

          {/* sync progress bar */}
          {snap.sync?.syncing && (
            <div className="card animate-fade-up px-4 py-3.5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-fg/75">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-fg/15 border-t-wa-green" />
                  Syncing your chats &amp; contacts…
                </span>
                <span className="tabular-nums text-fg/60">
                  {snap.sync.done}/{snap.sync.total || "…"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-fg/10 ring-1 ring-inset ring-fg/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-wa-green to-wa-teal shadow-[0_0_10px_rgba(37,211,102,0.45)] transition-all duration-300"
                  style={{ width: `${snap.sync.total ? Math.round((snap.sync.done / snap.sync.total) * 100) : 8}%` }}
                />
              </div>
            </div>
          )}

          <ChatView
            chats={snap.chats}
            activeChatId={activeChatId}
            messages={activeChatId ? messages[activeChatId] || [] : []}
            me={snap.me}
            connected={isConnected}
            onOpenChat={handleOpenChat}
            onSendMessage={sendMessage}
            onToggleEnabled={(id, enabled) => patchContact(id, { enabled })}
            onSetLanguage={(id, language: Language) => patchContact(id, { language })}
            onSetTone={(id, tone: Tone) => patchContact(id, { tone })}
            onSetVoiceReply={(id, pref: VoiceReply) => patchContact(id, { voiceReply: pref })}
            onSetManual={(id, mode: ManualReply) => patchContact(id, { manualReply: mode })}
            onSetMemory={(id, memory) => patchContact(id, { memory })}
            onSetCustomPrompt={(id, prompt) => patchContact(id, { customPrompt: prompt })}
            onToggleFavorite={(id, favorite) => patchContact(id, { favorite })}
            onChatAssistant={chatAssistant}
            onLoadMedia={loadMedia}
            onSendMedia={sendMedia}
            onDeleteMessage={deleteMessage}
            onEditMessage={editMessage}
            typing={activeChatId ? !!typing[activeChatId] : false}
            suggestion={activeChatId ? snap.suggestions?.[activeChatId] || null : null}
            onClearSuggestion={clearSuggestion}
          />
        </div>
      )}

      {/* Floating assistant orb — only once WhatsApp is connected */}
      {isConnected && (
        <ChatbotOrb
          onCommand={(text, chatId) => assistantCommand(text, chatId ?? activeChatId)}
          connected={isConnected}
          chats={snap.chats}
          messagesByChat={messages}
          onOpenChat={handleOpenChat}
          onSendMessage={sendMessage}
          onSendMedia={sendMedia}
          onChatAssistant={chatAssistant}
          activeChatId={activeChatId}
          activeChatName={snap.chats.find((c) => c.id === activeChatId)?.name || null}
        />
      )}

      <Footer live={connected} />
    </main>
  );
}
