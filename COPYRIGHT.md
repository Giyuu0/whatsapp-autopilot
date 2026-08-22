# Copyright & Attribution

**WhatsApp AutoPilot**
Copyright © 2026 **Yati Bhardwaj** ([@ys941](https://github.com/ys941))

Licensed under the [MIT Licence with Attribution Requirement](LICENSE).

---

## The short version

**You may:** use it, run it, self-host it, fork it, modify it, use it commercially,
build a business on it, and re-skin it entirely as your own brand.

**You must:** keep the copyright notice, and keep the author credit visible. Both are
licence conditions, not requests.

**You may not:** claim you wrote it, or strip the attribution and pass it off as
original work.

That's the whole deal.

---

## ✅ What you are free to do

| | |
|---|---|
| 🏢 **Use it commercially** | Run it for clients, charge for it, keep the money. No revenue share, no licence fee, no permission needed. |
| 🎨 **Re-brand it completely** | Change the name, colours, personas, tones and copy. It can look entirely like yours. |
| 🔧 **Modify anything** | Fork it, rip parts out, bolt parts on. No obligation to contribute changes back (though pull requests are welcome). |
| 📦 **Redistribute it** | Ship it to clients, bundle it, host it for others. |
| 🔒 **Keep your changes private** | This is MIT, not GPL. Your fork does not have to be open source. |

---

## ⭐ What is required in return

### 1. Keep the copyright notice

The licence requires the notice in [`LICENSE`](LICENSE) to travel with the software.
Keep that file in any copy or substantial portion you distribute.

### 2. Keep the author credit visible

**This is clause 2 of the [licence](LICENSE), not a courtesy.** Any deployment other
people can see must display legible credit to the author:

> Built by Yati Bhardwaj — https://github.com/ys941

The dashboard footer does this for you out of the box. Everything *around* it is yours
to change — the app name above it follows your Brand settings — but the credit itself
must stay, and the link must keep working.

The server also declines to start unless **both** are true:

```bash
ATTRIBUTION_ACK="https://github.com/ys941"   # set in your environment
```

...and the footer still contains the credit. Removing it stops the app from booting.

Nothing is transmitted anywhere. No network call is made, no telemetry is collected,
no licence server is contacted. The value is compared to a string in
[`lib/attribution.ts`](lib/attribution.ts) and that is all.

> **A note on the check:** it is easy to delete, and you are free to modify this
> code. But clause 2 of the licence requires the visible credit regardless of whether
> the check is present — removing the check does not remove the obligation, it just
> means the software stops reminding you of it.

---

## ❌ What is not okay

- **Claiming authorship.** Don't present this as software you wrote.
- **Removing the copyright notice or the visible credit.** Both are licence violations,
  not just bad manners.
- **Re-uploading it as your own project** with the attribution stripped.
- **Implying endorsement.** Building on this doesn't mean the author endorses, supports
  or is responsible for what you build.

---

## 🌐 What this copyright does *not* cover

This notice and the MIT licence cover **the source code in this repository only**.

They grant no rights to, and carry no warranty regarding:

- **Third-party services** the software talks to — WhatsApp (via whatsapp-web.js),
  Groq, Google (Gemini) and any other provider you configure. Each remains subject to
  that provider's own terms, and you supply your own credentials.
- **Your conversations.** The software reads and writes messages in your own WhatsApp
  account. Nothing is sent to the author, and there is no telemetry — but you are
  responsible for how you use it.
- **Messages the software sends on your behalf.** You are the account holder. You remain
  responsible for what it says in your name, for WhatsApp's own terms — which restrict
  automation — and for any local law on recording or automating conversations.

See [NOTICE.md](NOTICE.md) for the full detail.

---

## 🔏 Other people's privacy

This software reads private conversations. The people messaging you have not agreed to
be answered by a machine, and in some places automated replies or message retention
carry legal obligations. Auto-reply is off by default and opt-in per contact for exactly
that reason — please keep it that way, and tell people when it matters.

---

## 📬 Questions

Unsure whether your use is okay? Just ask — the answer is almost always yes.

**ys9410017064@gmail.com** · [github.com/ys941](https://github.com/ys941)

---

<sub>Built after hours by a medical laboratory technologist who learned to code.
If this saved you time, a star costs nothing. ⭐</sub>
