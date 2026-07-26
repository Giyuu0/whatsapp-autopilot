# WhatsApp AutoPilot — production image for Railway / Render / Fly.io / any Docker host.
FROM node:20-slim

# --- Shared libraries Chrome needs (puppeteer downloads its OWN matched
# Chrome-for-Testing build — the Debian chromium package dies silently under
# puppeteer in this container, so we use the binary puppeteer is built for) ---
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    ca-certificates fonts-liberation fonts-noto-color-emoji \
    libatk-bridge2.0-0 libatk1.0-0 libasound2 libcairo2 libcups2 \
    libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 \
    libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libx11-6 libx11-xcb1 \
    libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 \
    libxi6 libxrandr2 libxrender1 libxss1 libxtst6 libxkbcommon0 \
    libxshmfence1 libu2f-udev libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer downloads Chrome for Testing during npm ci into this fixed path.
ENV PUPPETEER_CACHE_DIR=/app/.puppeteer-cache
# NOTE: NODE_ENV is deliberately NOT set to production here — it is set AFTER
# the build (below). With NODE_ENV=production in scope, npm treats the install
# as production-only and `npm ci --include=dev` did not reliably keep the dev
# dependencies, so `next build` died with "Cannot find module 'tailwindcss'".
# That stayed hidden for weeks behind a warm Docker layer cache and only
# surfaced when the cache was evicted, taking the service down.
# Keep the Node heap modest so usage-based billing stays low (the app idles
# around ~150MB; Chromium is managed separately by puppeteer).
ENV NODE_OPTIONS=--max-old-space-size=256
# Chromium wants writable config/cache dirs in a container.
ENV XDG_CONFIG_HOME=/tmp/.chromium-config
ENV XDG_CACHE_HOME=/tmp/.chromium-cache

WORKDIR /app

# Install deps — dev deps INCLUDED (tailwind/postcss/typescript are needed by
# `next build`). Belt and braces: --include=dev AND npm_config_production=false,
# with a verification step so a missing build dep fails HERE with a clear
# message instead of 200 lines of webpack noise later.
COPY package*.json ./
RUN npm_config_production=false npm ci --include=dev --no-audit --no-fund \
    && node -e "require.resolve('tailwindcss'); require.resolve('postcss'); require.resolve('autoprefixer'); console.log('build deps present')"

# Build the Next.js app.
COPY . .
RUN npm run build

# Runtime env — set only AFTER the build so it can't strip build dependencies.
ENV NODE_ENV=production

# The server reads $PORT (Railway/Render inject it); defaults to 4499.
EXPOSE 4499
# dumb-init reaps zombie Chromium child processes and forwards SIGTERM so the
# app shuts down cleanly (flushes the store, closes the browser).
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
