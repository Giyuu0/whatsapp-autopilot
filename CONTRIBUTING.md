<div align="center">

# 🤝 Contributing to WhatsApp AutoPilot

**The point isn't that an AI answers your WhatsApp.**<br>
It's that the replies read like *you* wrote them.

<sub>Bug reports · features · docs · tests · a better prompt — all of it counts</sub>

</div>

---

## 👋 Start here

This was built by one person, learning as they went, mostly after midnight on a
two-core laptop. Two things follow:

1. **There are rough edges.** You'll find things that make you think *"why on earth
   is it done like this?"* Sometimes there's a reason. Often it just never got cleaned
   up. Ask — or fix it.
2. **Your first pull request is welcome here.** Genuinely. Questions are not an
   imposition.

No contribution is too small. Fixing one confusing sentence in the README counts.

---

## 🔏 Read this before anything else

This project touches **real private conversations** — yours and other people's. That
puts a duty on contributors that most projects don't have.

> ### ⚠️ Never put real messages in the repo
>
> Not in an issue, not in a PR description, not in a test fixture, not in a screenshot.
> Redact phone numbers, contact names and message text. If you need sample data, invent
> it.
>
> ### ⚠️ Opt-in is not negotiable
>
> Auto-reply is **off by default and opt-in per contact** — a master switch *plus* a
> per-chat toggle. Never change a default so the bot speaks to someone the operator
> didn't explicitly authorise. A PR that makes it "reply to everyone by default" will be
> declined however convenient it is.
>
> ### ⚠️ Sensitive messages stay ignored
>
> One-time passcodes, bank alerts and promotional spam are recognised, never stored and
> never answered. Keep it that way.

---

## 🚀 Getting it running

You need **Node 18+** and a phone with WhatsApp. No database, no paid accounts.

```bash
git clone https://github.com/ys941/whatsapp-autopilot.git
cd whatsapp-autopilot
npm install

cp .env.example .env.local
npm run dev            # http://localhost:4499
```

Two variables are needed to boot:

| Variable | What it's for |
|---|---|
| `ACCESS_KEY` | The key you type to get past the lock screen — pick anything |
| `ATTRIBUTION_ACK` | Set to `https://github.com/ys941` — the server won't start without it ([why](#-attribution)) |

Everything else is optional: without an AI key the dashboard, the chat list and the
settings all still work — you just won't get generated replies.

> 💡 **Use a spare number if you can.** You'll be scanning a QR to pair a real WhatsApp
> account, and development means restarting the process a lot.
>
> 💡 `npm run dev:preview` runs on port 4610 with an **isolated session**, so you can
> test without disturbing a paired account.

---

## 🧭 Where things live

```
server.js               custom server — Next.js + Socket.IO + the WhatsApp client, one process
lib/
├─ attribution.js       the attribution gate
├─ settings-schema.js   what a valid settings object looks like
└─ …                    style profiles, reply generation, media handling
components/             the dashboard UI
app/                    Next.js routes
```

Socket.IO is the **only** channel between the dashboard and the bot — that's deliberate,
it keeps one source of truth instead of a split brain between Next routes and the
background client. Keep it that way.

---

## 💡 Things worth doing

Nobody's working on these. No permission needed — just say so in a PR or discussion so
two people don't do the same work twice.

| | Area | Why it matters |
|:--:|---|---|
| 🧪 | **Tests** | There is no test suite. Biggest gap, and the easiest start — the style profiling, duplicate detection and settings validation are pure functions needing no WhatsApp account. |
| ♿ | **Accessibility** | The dashboard has never been audited for keyboard or screen-reader use. |
| 🔁 | **Reconnection** | Staying paired across restarts and network drops could be much more graceful. |
| 🌍 | **Languages** | Replies handle English, Hindi and Hinglish. Other languages need the same care. |
| 📖 | **Docs** | A setup guide written by someone who just did the setup — including where they got stuck. |
| 🎙️ | **Voice** | Transcription accuracy and more natural outgoing voice notes. |

---

## 🔀 Sending a pull request

```bash
git checkout -b fix/replies-to-muted-contact
# ... make the change ...
npm run build          # must pass
git commit -m "fix: respect the per-chat toggle when a contact is muted"
git push origin fix/replies-to-muted-contact
```

What helps:

- **Say what changed and why.** One honest paragraph beats a formal template.
- **Keep it focused.** One idea per PR.
- **Screenshots for UI changes** — with names and numbers blurred.
- **Say if you're unsure.** "I couldn't test the voice-note path" is useful information.

Reviews may take a few days — this is nobody's day job. A nudge after a week is fine.

---

## ⭐ Attribution

This project is free to use, fork, self-host, rebrand and build a business on. There is
one condition, and it is deliberately small:

**Credit to the original author stays visible.**

- The dashboard footer reads *"Designed & developed by Yati Bhardwaj"* and links to
  [@ys941](https://github.com/ys941). Everything around it is yours to change.
- The server runs two checks at start-up: `ATTRIBUTION_ACK="https://github.com/ys941"`
  must be set in your environment, **and** the footer must still contain the credit.
  Strip the credit and the app refuses to boot. Nothing is transmitted — both checks
  are local.

This is **clause 2 of the [licence](LICENSE)**, so it applies whether or not the check
is present — deleting [`lib/attribution.js`](lib/attribution.js) does not remove the
obligation.

Full detail on what you may and may not do: [COPYRIGHT.md](COPYRIGHT.md).

---

## 🎨 Code style

No linter gate, no formatting police. Match the surrounding code.

---

## 🐛 Reporting bugs

Open an issue with whatever you have. Rough is fine — what you expected, what happened,
and anything from the console.

> ⚠️ **Redact phone numbers, contact names and message text.** A bug report should never
> contain someone else's messages.

## 🔐 Security issues

Please **don't** open a public issue. Email **ys9410017064@gmail.com** and give it a few
days before disclosing publicly. You'll be credited unless you'd rather not be.

Anything that could expose an operator's conversations, session or access key is in
scope and taken seriously.

---

## 📜 Licence

Contributions are made under the [MIT Licence with Attribution Requirement](LICENSE),
the same as the project.

See [COPYRIGHT.md](COPYRIGHT.md) for exactly what you may and may not do — the short
version is "almost anything, just keep the credit".

---

<div align="center">

**Thank you for being here.** ⭐

<sub>Not sure where to start? Open a discussion and say what you'd like to work on.</sub>

</div>
