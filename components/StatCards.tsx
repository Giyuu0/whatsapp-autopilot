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
    <div className="card flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold leading-none text-slate-100">{value}</div>
        <div className="mt-1 text-xs text-slate-400">{label}</div>
      </div>
    </div>
  );
}

export function StatCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        icon={<Icon.Inbox className="h-5 w-5" />}
        label="Messages received"
        value={stats.received}
        accent="bg-sky-500/15 text-sky-300"
      />
      <Stat
        icon={<Icon.Send className="h-5 w-5" />}
        label="Auto-replies sent"
        value={stats.sent}
        accent="bg-wa-green/15 text-wa-green"
      />
      <Stat
        icon={<Icon.Bolt className="h-5 w-5" />}
        label="Active contacts"
        value={stats.enabledContacts}
        accent="bg-amber-500/15 text-amber-300"
      />
      <Stat
        icon={<Icon.Users className="h-5 w-5" />}
        label="Total contacts"
        value={stats.totalContacts}
        accent="bg-violet-500/15 text-violet-300"
      />
    </div>
  );
}
