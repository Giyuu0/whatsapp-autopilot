# WhatsApp AutoPilot — production image for Railway / Render / Fly.io / any Docker host.
FROM node:20-slim

# --- System Chromium + libraries required by whatsapp-web.js (puppeteer) ---
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium dumb-init \
    ca-certificates fonts-liberation fonts-noto-color-emoji \
    libatk-bridge2.0-0 libatk1.0-0 libasound2 libcairo2 libcups2 \
    libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 \
    libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcomposite1 libxdamage1 \
    libxext6 libxfixes3 libxrandr2 libxkbcommon0 \
    && rm -rf /var/lib/apt/lists/*

# Use the system Chromium instead of downloading puppeteer's copy.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
# Chromium wants writable config/cache dirs in a container.
ENV XDG_CONFIG_HOME=/tmp/.chromium-config
ENV XDG_CACHE_HOME=/tmp/.chromium-cache

WORKDIR /app

# Install deps — dev deps INCLUDED (tailwind/postcss/typescript are needed for
# the Next.js build; NODE_ENV=production above would otherwise skip them).
COPY package*.json ./
RUN npm ci --include=dev --no-audit --no-fund

# Build the Next.js app.
COPY . .
RUN npm run build

# The server reads $PORT (Railway/Render inject it); defaults to 4499.
EXPOSE 4499
# dumb-init reaps zombie Chromium child processes and forwards SIGTERM so the
# app shuts down cleanly (flushes the store, closes the browser).
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
