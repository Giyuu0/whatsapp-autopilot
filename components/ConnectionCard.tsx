"use client";

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./ui";
import type { Snapshot } from "./useWaSocket";

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  idle: { label: "Idle", color: "text-fg/60", dot: "bg-fg/40" },
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
  onPairPhone,
}: {
  snap: Snapshot;
  onLogout: () => void;
  onRestart: () => void;
  onRefresh: () => void;
  onPairPhone?: (number: string) => Promise<{ ok?: boolean; code?: string; error?: string }>;
}) {
  const meta = STATUS_META[snap.status] || STATUS_META.idle;
  const connected = snap.status === "connected";
  const preparing = snap.status === "authenticating" || snap.status === "initializing";
  const pct = Math.max(0, Math.min(100, snap.loadingPercent ?? 0));

  // "Link with phone number" alternative to the QR.
  const [mode, setMode] = useState<"qr" | "phone">("qr");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pairing, setPairing] = useState(false);
  const [pairErr, setPairErr] = useState<string | null>(null);
  async function requestCode() {
    setPairErr(null);
    setPairing(true);
    try {
      const res = await onPairPhone?.(phoneNumber);
      if (!res?.ok) setPairErr(res?.error || "Couldn't get a code — try again.");
    } catch (e: any) {
      setPairErr(e?.message || "Couldn't get a code — try again.");
    } finally {
      setPairing(false);
    }
  }

  // Track how long we've been preparing, so we can nudge the user if it stalls.
  const [waited, setWaited] = useState(0);
  const startRef = useRef<number>(Date.now());
  useEffect(() => {
    if (!preparing) {
      startRef.current = Date.now();
      setWaited(0);
      return;
    }
    startRef.current = Date.now();
    const t = setInterval(() => setWaited(Math.round((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
    // Reset the timer whenever we (re)enter a preparing phase.
  }, [preparing]);

  return (
    <div className="card card-hover p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg/60">
          Connection
        </h2>
        <span className={`chip border border-fg/10 bg-fg/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${meta.color}`}>
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
          <div className="rounded-full bg-gradient-to-br from-wa-green/60 via-wa-green/20 to-wa-teal/40 p-[2px] shadow-glow">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-2 text-wa-green">
              <Icon.Power className="h-9 w-9" />
            </div>
          </div>
          <div className="animate-fade-up">
            <p className="text-lg font-semibold tracking-tight text-fg">{snap.me?.name || "Linked"}</p>
            <p className="text-sm text-fg/60 tabular-nums">+{snap.me?.number}</p>
          </div>
        </div>
      ) : snap.qr || snap.pairingCode ? (
        <div className="flex flex-col items-center gap-4 py-2">
          {mode === "qr" ? (
            <>
              <div className="animate-fade-up rounded-3xl bg-fg p-3.5 shadow-[0_0_0_1px_rgba(37,211,102,0.25),0_12px_40px_-12px_rgba(37,211,102,0.35)] ring-4 ring-fg/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {snap.qr && <img src={snap.qr} alt="WhatsApp QR" className="h-52 w-52 rounded-xl sm:h-56 sm:w-56" />}
              </div>
              <p className="max-w-xs text-center text-xs leading-relaxed text-fg/60">
                Open WhatsApp → <b className="text-fg/90">Linked devices</b> → <b className="text-fg/90">Link a device</b> → scan this code.
              </p>
              <button
                type="button"
                onClick={() => { setMode("phone"); setPairErr(null); }}
                className="text-xs font-semibold text-wa-green underline-offset-2 hover:underline"
              >
                Link with phone number instead →
              </button>
            </>
          ) : (
            <div className="w-full max-w-xs animate-fade-up">
              {snap.pairingCode ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-center text-xs text-fg/60">Enter this code in WhatsApp:</p>
                  <div className="rounded-2xl border border-wa-green/30 bg-wa-green/5 px-5 py-3">
                    <span className="select-all font-mono text-3xl font-bold tracking-[0.2em] text-fg">{snap.pairingCode}</span>
                  </div>
                  <p className="text-center text-xs leading-relaxed text-fg/60">
                    On your phone: <b className="text-fg/90">WhatsApp → Linked devices → Link a device →</b>{" "}
                    <b className="text-fg/90">Link with phone number instead</b>, then type this code.
                  </p>
                  <button type="button" onClick={requestCode} disabled={pairing} className="btn-ghost text-xs">
                    {pairing ? "Refreshing…" : "Get a new code"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <label className="text-xs font-medium text-fg/70">Your WhatsApp number (with country code)</label>
                  <input
                    className="input"
                    inputMode="tel"
                    placeholder="e.g. 919812345678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") requestCode(); }}
                  />
                  {pairErr && <p className="text-xs text-red-300">{pairErr}</p>}
                  <button
                    type="button"
                    onClick={requestCode}
                    disabled={pairing || phoneNumber.replace(/\D/g, "").length < 8}
                    className="btn-primary"
                  >
                    {pairing ? "Getting code…" : "Get pairing code"}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => { setMode("qr"); setPairErr(null); }}
                className="mt-3 w-full text-center text-xs font-semibold text-fg/50 underline-offset-2 hover:underline"
              >
                ← Scan QR code instead
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-fg/10 border-t-wa-green" />
          <p className="text-sm text-fg/60">
            {snap.error ? snap.error : "Preparing WhatsApp session…"}
            {preparing && !snap.error && pct > 0 && (
              <span className="ml-1 font-semibold text-fg/80">{pct}%</span>
            )}
          </p>

          {/* progress bar (shows sync moving vs. stuck) */}
          {preparing && !snap.error && (
            <div className="w-full max-w-[220px]">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-fg/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-wa-green to-wa-teal transition-all duration-500"
                  style={{ width: `${pct > 0 ? pct : 6}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] tabular-nums text-fg/40">{waited}s elapsed</p>
            </div>
          )}

          {/* nudge if it's clearly stalling */}
          {preparing && !snap.error && waited >= 45 && (
            <div className="mt-1 max-w-[240px] rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-[11px] leading-relaxed text-amber-300/90">
              This is taking longer than usual. WhatsApp is still syncing — give it
              another moment, or hit <b>Restart</b> below to relaunch the session.
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-fg/5 pt-4">
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
