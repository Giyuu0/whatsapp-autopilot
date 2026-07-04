"use client";

import React from "react";
import { Icon } from "./ui";
import type { Snapshot } from "./useWaSocket";

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  idle: { label: "Idle", color: "text-slate-400", dot: "bg-slate-400" },
  initializing: { label: "Starting…", color: "text-amber-300", dot: "bg-amber-300" },
  qr: { label: "Scan QR to link", color: "text-sky-300", dot: "bg-sky-300" },
  authenticating: { label: "Authenticating…", color: "text-amber-300", dot: "bg-amber-300" },
  connected: { label: "Connected", color: "text-wa-green", dot: "bg-wa-green" },
  disconnected: { label: "Disconnected", color: "text-red-300", dot: "bg-red-300" },
  error: { label: "Error", color: "text-red-300", dot: "bg-red-300" },
};

export function ConnectionCard({
  snap,
  onLogout,
  onRestart,
  onRefresh,
}: {
  snap: Snapshot;
  onLogout: () => void;
  onRestart: () => void;
  onRefresh: () => void;
}) {
  const meta = STATUS_META[snap.status] || STATUS_META.idle;
  const connected = snap.status === "connected";

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Connection
        </h2>
        <span className={`chip bg-white/5 ${meta.color}`}>
          <span className="relative flex h-2 w-2">
            {connected && (
              <span className={`absolute inline-flex h-full w-full rounded-full ${meta.dot} opacity-60 animate-pulse-ring`} />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${meta.dot}`} />
          </span>
          {meta.label}
        </span>
      </div>

      {/* QR / connected state */}
      {connected ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-wa-green/15 text-wa-green">
            <Icon.Power className="h-9 w-9" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-100">{snap.me?.name || "Linked"}</p>
            <p className="text-sm text-slate-400">+{snap.me?.number}</p>
          </div>
        </div>
      ) : snap.qr ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="rounded-2xl bg-white p-3 shadow-glow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={snap.qr} alt="WhatsApp QR" className="h-56 w-56" />
          </div>
          <p className="text-center text-xs text-slate-400">
            Open WhatsApp → <b className="text-slate-200">Linked devices</b> → <b className="text-slate-200">Link a device</b> → scan this code.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-wa-green" />
          <p className="text-sm text-slate-400">
            {snap.error ? snap.error : "Preparing WhatsApp session…"}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-ghost flex-1" onClick={onRefresh} disabled={!connected}>
          <Icon.Refresh className="h-4 w-4" /> Sync contacts
        </button>
        <button className="btn-ghost" onClick={onRestart} title="Restart session">
          <Icon.Power className="h-4 w-4" />
        </button>
        <button className="btn-danger" onClick={onLogout} disabled={snap.status === "idle"}>
          Log out
        </button>
      </div>
    </div>
  );
}
