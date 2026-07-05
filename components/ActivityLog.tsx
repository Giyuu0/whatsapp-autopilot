"use client";

import React, { useMemo, useState } from "react";
import type { LogEntry } from "./useWaSocket";

function fmtTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const DIR_META: Record<LogEntry["direction"], { icon: string; color: string; label: string }> = {
  in: { icon: "↓", color: "text-sky-300", label: "Received" },
  out: { icon: "↑", color: "text-wa-green", label: "Auto-reply" },
  error: { icon: "!", color: "text-red-300", label: "Error" },
};

/**
 * Collapsible activity feed — what the bot received, sent and any errors.
 * Wired to the server's log store (`logs` in the snapshot + live `log` events)
 * and the `logs:clear` socket event.
 */
export function ActivityLog({ logs, onClear }: { logs: LogEntry[]; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const recent = useMemo(() => [...logs].slice(-30).reverse(), [logs]);
  const errors = useMemo(() => logs.filter((l) => l.direction === "error").length, [logs]);

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-fg/[0.03]"
      >
        <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg/60">
          Activity
          <span className="rounded-full bg-fg/10 px-2 py-0.5 text-[10px] font-bold text-fg/60">{logs.length}</span>
          {errors > 0 && (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-300">
              {errors} error{errors > 1 ? "s" : ""}
            </span>
          )}
        </span>
        <span className={`text-fg/40 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="animate-fade-up border-t border-fg/10">
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-fg/40">No activity yet.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {recent.map((l) => {
                const meta = DIR_META[l.direction] || DIR_META.in;
                return (
                  <li key={l.id} className="flex items-start gap-2.5 border-b border-fg/5 px-4 py-2 text-xs last:border-b-0">
                    <span className={`mt-0.5 w-3 shrink-0 text-center font-bold ${meta.color}`} title={meta.label}>
                      {meta.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium text-fg/80">{l.name || l.contactId}</span>
                        <span className="shrink-0 tabular-nums text-fg/35">{fmtTime(l.ts)}</span>
                      </div>
                      <p className="truncate text-fg/50">{l.text}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {logs.length > 0 && (
            <div className="border-t border-fg/10 px-4 py-2 text-right">
              <button type="button" className="btn-ghost !py-1 text-xs" onClick={onClear}>
                Clear activity
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
