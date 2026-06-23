# 🎯 PixelKava Goal Bar — free OBS goal widget

A free, **no-signup, no-code** goal bar widget for **OBS / Twitch** (donation or follower goals).
Set it up in the visual builder, copy the link, and add it as a **Browser Source**. That's it.

![Free OBS Goal Bar](preview.png)

## ✨ Features
- 🆓 **Free, no sign-up, no code**
- 🌍 **5 languages** (English, Українська, Español, Português, Deutsch) with auto-detect
- 🎨 Customizable: title, current/goal, prefix/suffix, color themes or custom color, bar style (rounded / flat / striped), text color, height
- 🏁 **Milestones**, **message at 100%**, smooth animation, shine, celebration glow
- 💾 Auto-saves your setup · import settings from an existing link
- 🔒 **Privacy-first:** no tracking, no cookies, no data collection, strict CSP

## 🚀 How to use
1. Open the **builder** (`index.html`) — or the hosted page.
2. Configure your goal and style (live preview).
3. Click **Copy link**.
4. In OBS: **Sources → + → Browser** → paste the link (size ~600×150).
5. Done! To update the number, change *Current* and paste the new link.

## ⚡ Live mode — auto-update from Ko-fi (optional)
Want the bar to fill up **automatically** as donations come in? Use the **Connect page** (`connect.html`):
1. Paste your **Ko-fi Verification Token** (Ko-fi → Settings → Advanced → Webhooks).
2. Get a ready **widget link**, a **webhook URL**, and a private **reset bookmark**.
3. Add the webhook URL in Ko-fi, paste the widget link in OBS — donations now update the bar live.

How it works: a tiny serverless function (Cloudflare Worker + KV) receives the Ko-fi webhook, keeps the total, and the widget polls it every few seconds. No personal data is stored — only your Ko-fi token, kept private, to verify your donations. Open the reset bookmark before a stream to start from 0.

## 🔧 Widget parameters (`goal.html?...`)
`label` · `current` · `goal` · `prefix` · `suffix` · `theme` (teal/coral/sun/lilac/green) · `color` (custom hex) · `bg` · `text` · `height` · `style` (rounded/flat/striped) · `milestones` (comma-separated values) · `done` (message at 100%) · `showvalues` (1/0)

## 🔐 Privacy & security
Fully static — no backend, no third-party libraries, no analytics by default, nothing leaves your browser. Hardened with a Content-Security-Policy and `noopener`. See the project's security checklist.

## 🗺️ Roadmap
- ✅ **Live auto-update** (Ko-fi via a serverless Cloudflare Worker) — see *Live mode* above
- Multi-streamer self-serve **Connect page** (each streamer uses their own Ko-fi)
- More widgets: *Starting Soon* timer, recent followers, sub goal, now playing
- **Localized culture theme packs** (vyshyvanka / regional) — premium

## 💛 Support
Free for streamers to use. If it helps, you can support development:
**ko-fi.com/pixelkava**

---
© 2026 **PixelKava** · made with care 🌻 · free to use on your streams (please don't resell as your own)
