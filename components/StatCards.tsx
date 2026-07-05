"use client";

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./ui";
import type { Stats } from "./useWaSocket";

/** Smoothly animates a number toward its target whenever the target changes. */
function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const duration = 600;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

function Stat({
  icon,
  label,
  value,
  accent,
  glow,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
  glow: string;
}) {
  return (
    <div className="group card card-hover relative flex items-center gap-3 overflow-hidden p-3.5 sm:gap-3.5 sm:p-4">
      {/* soft colored glow that intensifies on hover */}
      <span
        className={`stat-glow bg-gradient-to-r ${glow} transition-opacity duration-300 group-hover:opacity-80`}
      />
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-inner ring-1 ring-inset ring-fg/10 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${accent}`}
      >
        {icon}
      </div>
      <div className="min-w-0 animate-fade-up">
        <div className="text-2xl font-bold leading-none tracking-tight text-fg tabular-nums sm:text-[1.75rem]">
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 truncate text-xs text-fg/60">{label}</div>
      </div>
    </div>
  );
}

export function StatCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
      <Stat
        icon={<Icon.Inbox className="h-5 w-5" />}
        label="Messages received"
        value={stats.received}
        accent="from-sky-500/25 to-sky-500/5 text-sky-300"
        glow="from-sky-500/40 to-transparent"
      />
      <Stat
        icon={<Icon.Send className="h-5 w-5" />}
        label="Auto-replies sent"
        value={stats.sent}
        accent="from-wa-green/25 to-wa-teal/10 text-wa-green"
        glow="from-wa-green/40 to-transparent"
      />
      <Stat
        icon={<Icon.Bolt className="h-5 w-5" />}
        label="Active contacts"
        value={stats.enabledContacts}
        accent="from-amber-500/25 to-amber-500/5 text-amber-300"
        glow="from-amber-500/40 to-transparent"
      />
      <Stat
        icon={<Icon.Users className="h-5 w-5" />}
        label="Total contacts"
        value={stats.totalContacts}
        accent="from-violet-500/25 to-violet-500/5 text-violet-300"
        glow="from-violet-500/40 to-transparent"
      />
    </div>
  );
}
