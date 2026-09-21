import "./globals.css";
import type { Metadata, Viewport } from "next";

import { DemoBanner } from "@/components/DemoBanner";

// Metadata URLs aren't prefixed with the basePath automatically (the demo is
// served from a sub-path), so do it here. Empty for a normal install.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "WhatsApp AutoPilot",
  description: "Auto-reply on WhatsApp with Groq (text) + Gemini (vision) — you choose which contacts.",
  manifest: `${BASE}/manifest.json`,
  icons: { icon: `${BASE}/icon.svg` },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AutoPilot",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Keyboard shrinks the layout viewport (and 100dvh) instead of overlaying it,
  // so the message composer stays above the on-screen keyboard on mobile.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0f14" },
    { media: "(prefers-color-scheme: light)", color: "#edf1f6" },
  ],
};

// Set the theme before first paint to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('wa-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <DemoBanner />
      </body>
    </html>
  );
}
