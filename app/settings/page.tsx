"use client";

import React from "react";
import Link from "next/link";
import { useWaSocket } from "@/components/useWaSocket";
import { LoginScreen } from "@/components/LoginScreen";
import { SettingsForm } from "@/components/SettingsForm";
import { Footer } from "@/components/Footer";

export default function SettingsPage() {
  const { connected, snap, emit, authState, authError, login, lock, fetchModels, previewVoice } = useWaSocket();

  if (authState === "unauthorized") {
    return <LoginScreen onSubmit={login} error={authError} />;
  }

  if (!snap) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-fg/10 border-t-wa-green" />
          <p className="text-sm text-fg/60">
            {connected ? "Loading settings…" : "Connecting to server…"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6">
        <Link
          href="/"
          className="text-sm text-fg/60 transition hover:text-wa-green"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-fg">Settings</h1>
      </header>

      <SettingsForm
        settings={snap.settings}
        onSave={async (patch) => {
          await emit("settings:update", patch);
        }}
        onLock={lock}
        onFetchModels={fetchModels}
        onPreviewVoice={previewVoice}
      />
      <Footer />
    </main>
  );
}
