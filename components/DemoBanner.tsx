"use client";

import { useState } from "react";

import { IS_DEMO } from "./demoSocket";

/** A dismissible note shown only in the public demo build. */
export function DemoBanner() {
  const [open, setOpen] = useState(true);
  if (!IS_DEMO || !open) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-fg/10 bg-surface-1/95 px-4 py-2.5 text-xs text-fg/80 shadow-2xl backdrop-blur sm:text-sm">
      <span className="flex-1">
        <b className="text-wa-green">Live demo</b> — fictional chats that reply on their own, right in your browser. Nothing
        is sent anywhere.{" "}
        <a className="text-wa-green underline" href="https://github.com/ys941/whatsapp-autopilot#readme" target="_blank" rel="noopener noreferrer">
          Self-host it
        </a>{" "}
        to connect your own WhatsApp.
      </span>
      <button onClick={() => setOpen(false)} aria-label="Dismiss" className="rounded-lg px-2 py-1 text-fg/50 hover:bg-fg/5 hover:text-fg">
        ✕
      </button>
    </div>
  );
}
