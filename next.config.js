// NEXT_PUBLIC_DEMO=1 builds the public demo: a static export served from
// NEXT_PUBLIC_BASE_PATH, with fictional chats in place of the server
// (components/demoSocket.ts). A normal build is unaffected.
const isDemo = process.env.NEXT_PUBLIC_DEMO === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // whatsapp-web.js / puppeteer must never be bundled by Next — they run only in server.js
  webpack: (config) => {
    config.externals = config.externals || [];
    config.externals.push('whatsapp-web.js', 'puppeteer', 'puppeteer-core');
    return config;
  },
  ...(isDemo
    ? {
        output: "export",
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

module.exports = nextConfig;
