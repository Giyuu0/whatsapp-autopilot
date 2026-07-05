/**
 * Custom server: runs Next.js, Socket.IO and the WhatsApp client in ONE
 * process. Socket.IO is the only channel between the dashboard and the bot,
 * which keeps a single source of truth (no split-brain between Next routes
 * and the background client).
 */
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

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
    if (provided && provided === store.accessKey()) return next();
    next(new Error("unauthorized"));
  });

  io.on("connection", (socket) => {
    // Send the full current state to the newcomer.
    socket.emit("state", wa.snapshot());

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

    // Load an image's preview on demand (for history photos).
    socket.on("message:media", async ({ messageId }, ack) => {
      try {
        const media = await wa.fetchMedia(messageId);
        ack && ack({ ok: true, media });
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
});
