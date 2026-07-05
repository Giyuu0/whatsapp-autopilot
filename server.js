/**
 * Custom server: runs Next.js, Socket.IO and the WhatsApp client in ONE
 * process. Socket.IO is the only channel between the dashboard and the bot,
 * which keeps a single source of truth (no split-brain between Next routes
 * and the background client).
 */
const { createServer } = require("http");
const crypto = require("crypto");
const next = require("next");
const { Server } = require("socket.io");

/** Constant-time string compare (avoids timing attacks on the access key). */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "4499", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const store = require("./lib/store");
  const wa = require("./lib/wa/client");

  const server = createServer((req, res) => handle(req, res));
  const io = new Server(server, { cors: { origin: "*" } });

  wa.attachIo(io);

  // ---- Access gate: every socket must present the correct access key ----
  io.use((socket, next) => {
    const provided = socket.handshake.auth && socket.handshake.auth.key;
    if (provided && safeEqual(provided, store.accessKey())) return next();
    next(new Error("unauthorized"));
  });

  io.on("connection", (socket) => {
    // Send the full current state to the newcomer.
    socket.emit("state", wa.snapshot());

    // When the dashboard tab closes, no chat is "on screen" anymore — clear it
    // so incoming messages resume raising the unread badge.
    socket.on("disconnect", () => {
      wa.activeChatId = null;
    });

    socket.on("wa:restart", (ack) => {
      wa.restart();
      ack && ack({ ok: true });
    });

    socket.on("wa:logout", (ack) => {
      wa.logout();
      ack && ack({ ok: true });
    });

    socket.on("contacts:refresh", async (ack) => {
      await wa.refreshChats();
      ack && ack({ ok: true, contacts: store.getContacts(), chats: wa.chatsForClient() });
    });

    socket.on("contact:update", ({ id, patch }, ack) => {
      const updated = store.setContact(id, patch || {});
      wa.pushContacts();
      wa.pushChats();
      ack && ack({ ok: !!updated, contact: updated });
    });

    // Open a conversation → returns its messages (fetched from WhatsApp).
    socket.on("chat:open", async (chatId, ack) => {
      try {
        const messages = await wa.openChat(chatId);
        ack && ack({ ok: true, chatId, messages });
      } catch (e) {
        ack && ack({ ok: false, error: e.message });
      }
    });

    // Dismiss a manual-mode draft suggestion.
    socket.on("suggestion:clear", ({ chatId }, ack) => {
      wa.setSuggestion(chatId, null);
      ack && ack({ ok: true });
    });

    // Load an image's preview on demand (for history photos).
    socket.on("message:media", async ({ messageId }, ack) => {
      try {
        const media = await wa.fetchMedia(messageId);
        ack && ack({ ok: true, media });
      } catch (e) {
        ack && ack({ ok: false, error: e.message });
      }
    });

    // Send a file (image/document/voice) from the composer.
    socket.on("message:sendMedia", async ({ chatId, media }, ack) => {
      try {
        const message = await wa.sendMediaManual(chatId, media || {});
        ack && ack({ ok: true, message });
      } catch (e) {
        ack && ack({ ok: false, error: e.message });
      }
    });

    // Delete a message for everyone.
    socket.on("message:delete", async ({ chatId, messageId }, ack) => {
      try {
        await wa.deleteMessage(chatId, messageId);
        ack && ack({ ok: true });
      } catch (e) {
        ack && ack({ ok: false, error: e.message });
      }
    });

    // Edit one of your own messages.
    socket.on("message:edit", async ({ chatId, messageId, text }, ack) => {
      try {
        await wa.editMessage(chatId, messageId, text);
        ack && ack({ ok: true });
      } catch (e) {
        ack && ack({ ok: false, error: e.message });
      }
    });

    // Send a message manually from the chat composer.
    socket.on("message:send", async ({ chatId, text }, ack) => {
      try {
        const message = await wa.sendManual(chatId, text);
        ack && ack({ ok: true, message });
      } catch (e) {
        ack && ack({ ok: false, error: e.message });
      }
    });

    // Discover available models for the configured API keys (Settings UI).
    // (payload is unused; the ack callback is always the last arg.)
    socket.on("models:fetch", async (_payload, ack) => {
      const cb = typeof _payload === "function" ? _payload : ack;
      try {
        const models = await wa.fetchModels();
        cb && cb({ ok: true, ...models });
      } catch (e) {
        cb && cb({ ok: false, error: e.message });
      }
    });

    // Preview a TTS voice — synthesize a short sample and return the audio.
    socket.on("voice:preview", async (payload, ack) => {
      try {
        const audio = await wa.previewVoice(payload || {});
        ack && ack({ ok: true, ...audio });
      } catch (e) {
        ack && ack({ ok: false, error: e.message });
      }
    });

    // Orb assistant: interpret a natural-language command and execute it.
    // chatId (optional) is the chat currently open on screen, so "this chat"
    // and "talk about this" resolve correctly.
    socket.on("assistant:command", async ({ text, chatId }, ack) => {
      try {
        const res = await wa.handleCommand(text, chatId);
        ack && ack(res);
      } catch (e) {
        ack && ack({ ok: false, reply: `Error: ${e.message}` });
      }
    });

    // Composer helper: translate + rewrite the owner's own draft before sending.
    socket.on("composer:rewrite", async ({ text, lang }, ack) => {
      try {
        const rewritten = await wa.rewriteDraft(text, lang);
        ack && ack({ ok: true, text: rewritten });
      } catch (e) {
        ack && ack({ ok: false, error: e.message });
      }
    });

    // Private @bot side-channel for an open chat (never sent to the person).
    socket.on("chat:assistant", async ({ chatId, text }, ack) => {
      try {
        const res = await wa.chatAssistant(chatId, text);
        ack && ack(res);
      } catch (e) {
        ack && ack({ ok: false, reply: `Error: ${e.message}` });
      }
    });

    socket.on("settings:update", (partial, ack) => {
      // Only overwrite keys when a non-empty value is sent (so blanking a
      // field in the UI doesn't wipe a stored key).
      const clean = { ...partial };
      if (clean.groqApiKey === "" || clean.groqApiKey === undefined) delete clean.groqApiKey;
      if (clean.geminiApiKey === "" || clean.geminiApiKey === undefined) delete clean.geminiApiKey;
      // Never let the access key be blanked, and ignore attempts to change it
      // while it is locked by .env.
      if (clean.accessKey === "" || clean.accessKey === undefined || store.accessKeyLocked()) {
        delete clean.accessKey;
      }
      store.updateSettings(clean);
      wa.pushSettings();
      ack && ack({ ok: true, settings: wa.publicSettings() });
    });

    socket.on("logs:clear", (ack) => {
      store.clearLogs();
      io.emit("state", wa.snapshot());
      ack && ack({ ok: true });
    });
  });

  server.listen(port, () => {
    console.log(`\n  ▶ WhatsApp AutoPilot running:  http://localhost:${port}\n`);
    // Boot the WhatsApp client (async — QR will stream to the dashboard).
    wa.init().catch((e) => console.error("[server] wa init error:", e.message));
  });

  // Graceful shutdown → close the headless browser so it doesn't linger and
  // lock the session for the next launch.
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      if (wa.client) await wa.client.destroy();
    } catch {}
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
});
