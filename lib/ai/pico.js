// Free persona chat via buildpicoapps' hosted chatbot WebSocket — the same
// backend the masstree.in widgets use. Costs no Groq/Gemini tokens.
//
// Protocol: one WebSocket per message. Send { chatId, appId, systemPrompt,
// message }, the reply streams back in frames, close code 1000 = complete.
// IMPORTANT: chatId MUST be a UUID — anything else is silently dropped
// (the server holds ~10s and closes 1006 with no reply).
const WebSocket = require("ws");
const { randomUUID } = require("crypto");

const PICO_URL = "wss://backend.buildpicoapps.com/api/chatbot/chat";

/**
 * Send one message and resolve with the full streamed reply.
 * The backend keeps its own conversation memory per chatId, so reuse a stable
 * UUID per WhatsApp contact to get continuity for free.
 */
function picoChat({ appId, chatId, systemPrompt, message, timeoutMs = 45000 }) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(PICO_URL);
    } catch (e) {
      return reject(new Error("pico connect failed: " + e.message));
    }
    let out = "";
    const t = setTimeout(() => {
      try { ws.terminate(); } catch {}
      reject(new Error("pico timed out" + (out ? " (partial reply)" : "")));
    }, timeoutMs);
    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          chatId: chatId || randomUUID(),
          appId,
          // The literal word "Hinglish" makes pico return an EMPTY reply
          // (verified by bisection); the same instruction phrased differently
          // works fine, so rewrite it.
          systemPrompt: String(systemPrompt || "").replace(/hinglish/gi, "Hindi-English mixed in Roman script"),
          message: String(message || ""),
        })
      );
    });
    ws.on("message", (d) => { out += d.toString(); });
    ws.on("close", (code) => {
      clearTimeout(t);
      const text = out.trim();
      if (code === 1000 && text) resolve(text);
      else reject(new Error(`pico closed ${code}${text ? " with partial reply" : " with no reply"}`));
    });
    ws.on("error", (e) => {
      clearTimeout(t);
      reject(new Error("pico error: " + e.message));
    });
  });
}

module.exports = { picoChat };
