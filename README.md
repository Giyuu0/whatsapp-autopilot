<div align="center">

# 🤖 WhatsApp AutoPilot

### Your personal AI that replies on WhatsApp — only to the people you choose.

Text → **Groq** · Images → **Gemini Vision** · Voice notes → **Whisper**
Per-chat **tone**, **language**, and a talking **assistant orb** that runs the whole thing.

![Next.js](https://img.shields.io/badge/Next.js%2014-000000?logo=next.js&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-F55036?logo=groq&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-8E75FF?logo=googlegemini&logoColor=white)
![whatsapp-web.js](https://img.shields.io/badge/whatsapp--web.js-25D366?logo=whatsapp&logoColor=white)

</div>

---

## ✨ What it does

A beautiful, self-hosted dashboard that connects to WhatsApp (by scanning a QR code, like WhatsApp Web) and **auto-replies with AI** — but only for the contacts you switch on. Everyone else is left alone.

- 💬 **WhatsApp-style chat UI** — a real two-pane view: chat list on the left, live conversation on the right. Messages sync **both ways** in real time.
- 🎯 **Per-chat control** — flip a toggle per person to enable auto-reply.
- ✍️ **Manual (draft) mode** — global or per-chat: the AI writes a suggested reply but **doesn't send it** — you review, edit, and send it yourself.
- 🛡️ **Sensitive guard** — OTPs, bank/transaction alerts and promotional spam are **hidden and never auto-replied to**.
- 🧠 **Contact memory** — learns and remembers durable facts about each person and uses them in replies (editable per chat).
- 📄 **Reads links & PDFs** — if someone shares a URL or a PDF, it reads the content and replies about it.
- ⌨️ **Typing indicator**, 📎 **send images/files/voice** from the dashboard, and 🔔 **browser notifications**.
- 🧠 **Smart routing + fallback chains** — text → **Groq**, images → **Gemini Vision**, voice notes → **Groq Whisper**. Each has an ordered fallback chain that's tried in turn if a model errors or is rate-limited.
- 🔁 **Multi-key rotation** — give Groq **several API keys** (comma-separated) and it rotates to the next one the moment one hits its rate limit. Combined with the model fallback chain, replies keep flowing well past a single key's daily cap.
- 🚻 **Gender-aware** — infers each contact's gender from the conversation and tailors phrasing/pronouns accordingly.
- 🎭 **Per-chat tone** — reply **Professional**, **Friendly** (witty, roast-back), or **Flirty** — different for every chat.
- 🗣️ **Per-chat language** — **Auto-detect** (mirror the sender), English, Hindi, Hinglish, or English + slang.
- 🎙️ **Voice notes** — incoming voice messages are transcribed, **playable in the dashboard**, and answered; optionally reply *with a real voice note* too (Groq TTS → Ogg/Opus via bundled ffmpeg). **Preview any voice** (▶ Play) in Settings. Turn it on in Settings ("Reply to voice notes with a voice note") or per chat (Voice = Voice).
- ✏️ **Delete & edit** sent messages — for everyone — from the chat (hover a message) or via `@bot delete` / `@bot edit … to …`.
- 🧩 **Context-aware** — reads the recent conversation before replying, and says so honestly when it doesn't know something.
- 🪄 **Assistant orb** — a floating voice/text control center. Talk or type to send messages, change a chat's tone/language, toggle auto-reply, or **open any conversation right inside the orb** so you and the AI can both reply.
- 🔒 **Access-key gate** + **secure settings** — the dashboard is locked behind a key, and your API keys are write-only (never sent back to the browser).
- 📱 **Mobile-first** — a genuine full-screen phone experience: the conversation, per-chat settings sheet, and orb all work cleanly on a real phone, not just a shrunk desktop layout.

---

## 🚀 Quick start

### One click (Windows)
Double-click **`start-all.bat`** — it checks Node, installs dependencies on first run, starts the server, and opens the dashboard automatically.

### Manual
```bash
npm install     # first run also downloads Chromium
npm run dev     # → http://localhost:4499
```

### First-time setup
1. Open **http://localhost:4499** and enter the **access key** (default `wa-admin-2025`).
2. Add your **Groq** & **Gemini** keys in **Settings** (or in `.env`).
   - Groq → <https://console.groq.com/keys> · Gemini → <https://aistudio.google.com/apikey>
3. **Scan the QR code** with WhatsApp → *Linked devices → Link a device*.
4. Hit **Sync chats**, toggle **auto-reply ON** for the people you want, and set each chat's **tone** & **language**.

---

## 🎭 Tones

Set a **global** tone in Settings, or override it **per chat** from the conversation header.

| Tone | Vibe |
|---|---|
| **Professional** | Polished, courteous, articulate — no slang, no jokes at anyone's expense. |
| **Friendly** | Witty best-friend energy: humour, playful roasting, meme lines, clever comebacks. Fires back (in the same language) if the other person gets rude. |
| **Flirty** | Charming and playful with tasteful lines — classy and respectful, never crosses the line. |

## 🗣️ Languages

| Option | Style |
|---|---|
| **Auto-detect** | Replies in whatever language the sender used (default) |
| English / Hindi | Clean English · Devanagari हिंदी |
| Hinglish | Roman-script Hindi/English mix ("haan bro, aa raha hoon") |
| English + slang | Casual with modern texting slang |

## 🎙️ The assistant orb

The floating orb at the bottom-right (it appears once WhatsApp is connected) is a **voice + text control center**. Click it, then type or tap the mic:

- *"Message Priya that I'll call her tonight"* — sends a WhatsApp message
- *"Reply to Dad in Hinglish"* / *"Set Rahul's tone to flirty"*
- *"Open my chat with Mom"* — opens that conversation **inside the orb** so you can reply yourself
- *"Pause auto-reply"* / *"Switch global language to Hindi"*

It uses your browser's built-in speech recognition and speech synthesis — no extra keys needed (Chrome/Edge work best). It also knows **which chat is open on screen**, so *"talk about this"* works.

## 🔒 Private `@bot` side-channel

Inside any open conversation, start a message with **`@bot`** to talk to your assistant **privately** — it is **never sent to the other person**:

```
@bot what should I reply to this?
```

The bot reads the conversation and answers you inline, addressed **`@yati`** (also private, dashed/highlighted so you can't confuse it with a real message). Use it to brainstorm replies, get context, or ask questions mid-chat. Works in the main chat view and inside the orb.

**It's smart about intent:** if your `@bot` note is actually a *correction or instruction to send* (e.g. after a wrong image guess you type `@bot it is ghevar`), it phrases a natural reply and **sends it to the person** ("ohh my bad 😅 that's actually ghevar!"). If it's a question to you, it stays private.

## 🖼️ Photo previews

Incoming (and outgoing) photos show as real **image previews** in the chat, not just a placeholder. Older photos load on demand (**Tap to view**), and **"view once"** photos are captured and shown too, clearly labelled 👁️.

---

## 🧠 How replies are routed

| Incoming | Pipeline |
|---|---|
| Text | **Groq** (`llama-3.3-70b` → smaller/OSS Groq models) → **Gemini** text |
| Image | **Gemini Vision** (primary) → fallback chain → Groq vision |
| Voice note | **Groq Whisper** (transcribe) → text pipeline → optional voice reply |

Every model is a **separate rate-limit bucket**, so the chain walks down them on a `429`. Within each Groq model, your **comma-separated keys are rotated** too — so a reply only fails once *every model × every key* is exhausted. Keys set in the environment always **win over** whatever's stored in Settings.

A contact only gets a reply when **the master switch is ON** *and* **that chat's toggle is ON**.

---

## 🏗️ Architecture

```
server.js ──► Next.js (dashboard) + Socket.IO + whatsapp-web.js   (one process)
   │
   ├─ lib/wa/client.js   WhatsApp lifecycle, chat sync, reply pipeline, orb brain
   ├─ lib/ai/            groq · gemini · whisper · tts · language · tone · assistant · models
   └─ lib/store.js       JSON persistence (settings, per-chat config)
```

The browser talks to the bot **only over Socket.IO**, so there's a single source of truth — no split-brain between the UI and the background client.

---

## ☁️ Deploying

> **Use Railway / Render / Fly.io / a VPS — not Vercel.**
> This is a persistent server running a headless browser and an open WebSocket for hours; serverless platforms can't host it.

The repo ships a **`Dockerfile`** (bundling Puppeteer's Chrome-for-Testing) and **`railway.json`**. On Railway: deploy from GitHub, add a **Volume** at `/data`, and set `ACCESS_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `DATA_DIR=/data`, `WWEBJS_DIR=/data/.wwebjs_auth`. The WhatsApp session lives on the volume, so redeploys don't force a re-scan. Set `GROQ_API_KEY` to a **comma-separated list** to run several keys in rotation.

---

## 🔐 Security

- Dashboard locked behind an **access key** (change it in Settings or via `ACCESS_KEY` in `.env`), enforced server-side on every connection.
- API keys are **write-only** — stored server-side, never returned to the browser.
- Secrets live in a git-ignored **`.env`**; your WhatsApp session and local data never leave your machine.

## ⚠️ Note

`whatsapp-web.js` automates WhatsApp Web through a headless browser — it's unofficial and can violate WhatsApp's Terms of Service. Use it responsibly, on a number you're comfortable with.

<div align="center">

Built by [Yati Bhardwaj](https://masstree.in) · New Delhi

</div>

## 📄 Licence

Released under the **[MIT Licence with Attribution Requirement](LICENSE)** — use it,
fork it, rebrand it, sell what you build with it.

### ⭐ One condition: attribution

Credit to the original author stays visible:

- the dashboard footer reads *"Designed & developed by Yati Bhardwaj"* and links to
  **[@ys941](https://github.com/ys941)**, and
- the server will not start until you set `ATTRIBUTION_ACK="https://github.com/ys941"`
  in your environment — nothing is transmitted, both checks are local.

See [`lib/attribution.js`](lib/attribution.js) and [COPYRIGHT.md](COPYRIGHT.md).
A purely private deployment nobody else uses is exempt.
