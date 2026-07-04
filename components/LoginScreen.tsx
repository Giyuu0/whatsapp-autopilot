"use client";

import React, { useState } from "react";

export function LoginScreen({
  onSubmit,
  error,
}: {
  onSubmit: (key: string) => void;
  error?: string | null;
}) {
  const [key, setKey] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-7 animate-fade-up">
        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wa-green text-ink-950 shadow-glow">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
              <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm5.8 14.06c-.25.7-1.44 1.33-1.99 1.37-.53.04-1.02.24-3.45-.72-2.9-1.14-4.75-4.1-4.9-4.29-.14-.2-1.17-1.55-1.17-2.96s.74-2.1 1-2.39c.25-.29.55-.36.73-.36l.53.01c.17.01.4-.06.62.48.25.6.85 2.08.92 2.23.07.15.12.32.02.51-.1.2-.15.32-.29.49l-.44.51c-.14.14-.29.3-.12.58.17.29.76 1.25 1.63 2.03 1.12 1 2.07 1.3 2.36 1.45.29.14.46.12.63-.07.17-.2.73-.85.92-1.14.2-.29.4-.24.67-.14.27.1 1.7.8 1.99.95.29.14.48.22.55.34.07.12.07.72-.18 1.42Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-50">WhatsApp AutoPilot</h1>
            <p className="mt-1 text-sm text-slate-400">Enter your access key to continue</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) onSubmit(key);
          }}
        >
          <label className="label">Access key</label>
          <input
            type="password"
            autoFocus
            className="input"
            placeholder="••••••••"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
          <button type="submit" className="btn-primary mt-4 w-full" disabled={!key.trim()}>
            Unlock dashboard
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-600">
          Default key is <code className="text-slate-400">wa-admin-2025</code> — change it in Settings or via <code className="text-slate-400">.env</code>.
        </p>
      </div>
    </div>
  );
}
