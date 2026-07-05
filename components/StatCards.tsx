"use client";

import React from "react";
import { Icon } from "./ui";
import type { Stats } from "./useWaSocket";

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="card card-hover flex items-center gap-3 p-3.5 sm:gap-3.5 sm:p-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-inset ring-white/10 ${accent}`}
      >
        {icon}
      </div>
      <div className="min-w-0 animate-fade-up">
        <div className="text-2xl font-bold leading-none tracking-tight text-slate-100 tabular-nums sm:text-[1.75rem]">
          {value}
        </div>
        <div className="mt-1.5 truncate text-xs text-slate-400">{label}</div>
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
      />
      <Stat
        icon={<Icon.Send className="h-5 w-5" />}
        label="Auto-replies sent"
        value={stats.sent}
        accent="from-wa-green/25 to-wa-teal/10 text-wa-green"
      />
      <Stat
        icon={<Icon.Bolt className="h-5 w-5" />}
        label="Active contacts"
        value={stats.enabledContacts}
        accent="from-amber-500/25 to-amber-500/5 text-amber-300"
      />
      <Stat
        icon={<Icon.Users className="h-5 w-5" />}
        label="Total contacts"
        value={stats.totalContacts}
        accent="from-violet-500/25 to-violet-500/5 text-violet-300"
      />
    </div>
  );
}
