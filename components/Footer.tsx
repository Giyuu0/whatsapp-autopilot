"use client";

import React from "react";

/** App footer with the maker credit + optional live status. */
export function Footer({ live }: { live?: boolean }) {
  return (
    <footer className="mx-auto mt-12 max-w-lg px-4 pb-8">
      {/* gradient divider */}
      <div className="mb-5 h-px w-full bg-gradient-to-r from-transparent via-wa-green/25 to-transparent" />

      <div className="flex flex-col items-center gap-3 text-center">
        {live !== undefined && (
          <span className="chip bg-fg/5 text-xs">
            <span className="relative flex h-2 w-2">
              {live && (
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-wa-green opacity-60" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? "bg-wa-green" : "bg-amber-400"}`} />
            </span>
            <span className={live ? "text-wa-green" : "text-amber-400"}>
              {live ? "Live" : "Reconnecting…"}
            </span>
          </span>
        )}

        <p className="text-sm text-fg/60">
          Designed &amp; developed by{" "}
          <a
            href="https://github.com/ys941"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 font-semibold"
          >
            <span className="bg-gradient-to-r from-wa-green to-wa-teal bg-clip-text text-transparent transition group-hover:brightness-125">
              Yati Bhardwaj
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4 text-fg/45 transition group-hover:text-wa-green"
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 2.5-.34c.85 0 1.71.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
            </svg>
          </a>
        </p>
      </div>
    </footer>
  );
}
