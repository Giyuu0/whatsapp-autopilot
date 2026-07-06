"use client";

import React, { useEffect, useRef, useState } from "react";

/** A fully-themed dropdown (native <select> menus can't be styled and look
 *  broken on Windows). Button + popover list, closes on outside-click/escape. */
export function Select<T extends string>({
  value,
  onChange,
  options,
  buttonClassName = "",
  align = "left",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  buttonClassName?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  // On phones the menu is rendered position:fixed (anchored to the button) so
  // horizontally-scrollable rows (chat header controls) can never clip it.
  // Desktop keeps the original absolute popover — visually unchanged.
  const [mobileRect, setMobileRect] = useState<{ top: number; left?: number; right?: number } | null>(
    null
  );
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) {
      setMobileRect(null);
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // A fixed-position menu doesn't follow its button — close on any scroll.
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    if (mobileRect) {
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onScroll);
    }
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, mobileRect]);

  const toggleOpen = () => {
    if (
      !open &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches &&
      btnRef.current
    ) {
      const r = btnRef.current.getBoundingClientRect();
      setMobileRect(
        align === "right"
          ? { top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) }
          : { top: r.bottom + 4, left: Math.max(8, r.left) }
      );
    } else {
      setMobileRect(null);
    }
    setOpen((o) => !o);
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className={`flex h-9 items-center justify-between gap-1.5 rounded-lg border border-fg/10 bg-surface-2/80 px-2.5 text-xs text-fg outline-none transition hover:border-fg/20 active:scale-[0.98] md:h-8 ${
          open ? "border-wa-green/60 ring-2 ring-wa-green/20" : ""
        } ${buttonClassName}`}
      >
        <span className="truncate">{current?.label ?? "Select"}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`h-3.5 w-3.5 shrink-0 text-fg/60 transition ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className={`animate-fade-up min-w-[9rem] overflow-hidden rounded-xl border border-fg/10 bg-surface-1 p-1 shadow-xl shadow-black/40 ${
            mobileRect
              ? "fixed z-50"
              : `absolute z-40 mt-1 ${align === "right" ? "right-0" : "left-0"}`
          }`}
          style={
            mobileRect
              ? { top: mobileRect.top, left: mobileRect.left, right: mobileRect.right }
              : undefined
          }
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2.5 text-left text-xs transition active:bg-fg/10 md:py-1.5 ${
                  active ? "bg-wa-green/15 text-wa-green" : "text-fg/90 hover:bg-fg/10"
                }`}
              >
                <span className="truncate">{o.label}</span>
                {active && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5 shrink-0">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: "sm" | "md";
}) {
  const w = size === "sm" ? "w-9 h-5" : "w-11 h-6";
  const dot = size === "sm" ? "w-3.5 h-3.5" : "w-4.5 h-4.5";
  const shift = size === "sm" ? "translate-x-4" : "translate-x-5";
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex ${w} shrink-0 items-center rounded-full transition ${
        checked ? "bg-wa-green" : "bg-fg/15"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block ${dot} transform rounded-full bg-fg shadow transition ${
          checked ? shift : "translate-x-1"
        }`}
      />
    </button>
  );
}

export const Icon = {
  Bolt: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" strokeLinejoin="round" />
    </svg>
  ),
  Image: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m21 16-5-5L5 21" />
    </svg>
  ),
  Users: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Send: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="m22 2-7 20-4-9-9-4 20-7Z" strokeLinejoin="round" />
    </svg>
  ),
  Inbox: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </svg>
  ),
  Cog: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  ),
  Power: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
    </svg>
  ),
  Refresh: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
    </svg>
  ),
  Search: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
};
