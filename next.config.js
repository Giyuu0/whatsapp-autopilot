/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // whatsapp-web.js / puppeteer must never be bundled by Next — they run only in server.js
  webpack: (config) => {
    config.externals = config.externals || [];
    config.externals.push('whatsapp-web.js', 'puppeteer', 'puppeteer-core');
    return config;
  },
};

module.exports = nextConfig;
