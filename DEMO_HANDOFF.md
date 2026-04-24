# Demo Handoff — Stem Player

> **Paste the snippet below into the interview chat at the start of the round.**
> Lets the interviewer follow along on their screen while you demo on yours.

---

## 📋 Chat-ready snippet (copy this in)

```
Stem Player — browser-based multi-stem audio player with an AI mixing engineer
that has 18 tools mapped onto a real audio engine.

🌐 Live: https://stem-player-demo.vercel.app
📂 Repo: https://github.com/isaacsight/stem-player-demo
🎬 30-sec walkthrough: https://github.com/isaacsight/stem-player-demo/raw/main/docs/walkthrough.mp4

What to try:
1. Click "Load procedural demo set" (top of the page)
2. Click any of the 6 chips in the chat panel (try "🔥 Festival drop")
3. Watch the agent stream tool calls — schedule arrangement, FX, sections
4. The mix auto-plays when ready
5. Click "Render mix → WAV" to download the result

The interesting engineering: an 18-tool agent loop with streaming tool-use over
SSE, sample-perfect sync via Web Audio, AudioWorklet for custom DSP, and an
arrangement scheduler that fires automation events as the playhead crosses them.
```

---

## 🎬 Video preview (renders in GitHub)

<video src="docs/walkthrough.mp4" controls width="100%"></video>

If the video tag doesn't render: download `docs/walkthrough.mp4` (~1MB).

---

## 🆘 If something fails live

| Failure | Fallback |
|---|---|
| Live site doesn't load | Run locally: `cd scratch/stem-player-demo && npm run dev` → `localhost:5174` |
| Local AI endpoints fail | Set `ANTHROPIC_API_KEY` in `.env`, run `vercel dev` instead of `npm run dev` |
| Browser blocks audio | Click anywhere on the page to grant audio gesture. Worst case: open dev console, then click |
| Agent endpoint slow / timeouts | The error states are now friendly ("Mix engineer hit a snag — try again"). Click a different chip. |
| Demo stems sound bad | They're procedural (intentionally cheap, ~20 sec, no setup). Drop your own real stems via the dropzone for a richer demo. |
| Screen-share blocked | Send the live URL + video link in chat. They can click + watch their side. |

---

## 🎯 Demo flow you've rehearsed

**The 30-second flash demo:**

1. Open `stem-player-demo.vercel.app` (already cleared localStorage, fresh state)
2. *"Drop in stems, here's the procedurally-generated demo set."* → click **Load procedural demo set**
3. *"AI mixing engineer panel — let me ask it for an arrangement."* → click **🔥 Festival drop**
4. *(Pause while agent streams text + tool calls)*
5. *"Watch — it's calling tools that actually change the mix. Section labels, per-stem FX, scheduled automation events."*
6. *(Auto-play kicks in)*
7. *"And I can take it home."* → click **Render mix → WAV**
8. *"That's the loop: AI listens, AI rearranges, I take the result."*

**Total: ~45 sec. Stop. Let them ask questions.**

---

## 📦 Where everything is

| | Path |
|---|---|
| **Live deploy** | https://stem-player-demo.vercel.app |
| **Public repo** | https://github.com/isaacsight/stem-player-demo |
| **Walkthrough video** | `docs/walkthrough.mp4` (968 KB MP4) |
| **Walkthrough video (WebM)** | `docs/walkthrough.webm` (2.7 MB) |
| **Hero screenshot** | `docs/screenshot-loaded.png` |
| **Empty-state w/ chips** | `docs/screenshot-loaded-with-chips.png` |
| **Demo script (full)** | `DEMO_SCRIPT.md` |
| **Interview prep folder** | `interview-prep/` (8 docs: thesis, talking points, anticipated Qs) |
| **Local dev** | `npm run dev` → `localhost:5174` |
| **Local with AI** | `vercel dev` (needs `ANTHROPIC_API_KEY` in `.env`) |

---

## 🔄 Re-recording the walkthrough video

If something changes in the demo and you want a fresh recording:

```bash
node scripts/record-walkthrough.mjs
# OR with a custom URL:
node scripts/record-walkthrough.mjs https://staging.example.com
```

Drives Playwright through: page load → demo set → Festival drop chip → wait for
agent → auto-play → render. Saves `docs/walkthrough.webm`. Convert to MP4 with:

```bash
cd docs && ffmpeg -y -i walkthrough.webm -c:v libx264 -crf 23 \
  -preset fast -movflags +faststart -an walkthrough.mp4
```

---

## ⚡ The single sentence

> **AI listens, AI rearranges, you take the result home.**

Everything in the demo serves that arc.
