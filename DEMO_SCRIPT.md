# Demo Script — Stem Player

> Print this. Have it next to you. When nerves hit, look here.

**Live URL:** https://stem-player-demo.vercel.app
**Repo:** https://github.com/isaacsight/stem-player-demo

---

## 30-second flash demo (your default)

**Setup (do once before screen-share):**
1. Open `stem-player-demo.vercel.app` in a clean tab
2. Click **Load procedural demo set**
3. Wait 2 seconds for stems to render

**Live (in the round):**

> *"This is a browser-based stem player. The interesting part is the AI engineer — let me ask it to mix this for me."*

4. Click **🎚️ Downtempo lo-fi arrangement** (the first chip)

> *"Watch what happens — it's calling tools to actually change the audio."*

5. Wait ~15-25 seconds while the agent streams text and calls tools. Don't fill silence — let them watch the dots and badges populate.

6. When playback auto-starts:

> *"It scheduled a four-section arrangement, applied per-stem FX — drums get a lowpass for vinyl warmth, lead gets reverb. Sample-perfect sync. Now I can render the whole thing as a WAV."*

7. Click **Render mix → WAV**. File downloads. Pick it up off the desktop.

> *"That's the loop: AI listens, AI rearranges, I take the result home."*

**Total: ~45 seconds.** Stop. Let them ask.

---

## 3-minute deep-dive (when they pull on it)

After the flash demo, expand into any of these depending on what they ask:

### "How does the agent actually work?"

> *"Server-side it's Claude Sonnet with 18 tools mapped onto a real audio engine — volume, filter, pan, reverb send, schedule_arrangement, set_loop_region, label sections. Streaming tool-use. The client engine receives tool_use blocks, executes them locally against the AudioEngine, posts tool_results back. Multi-turn — it can refine, iterate, ask for `describe_session` to check its own work."*

### "Show me the architecture."

Open the README — `Architecture` section has the ASCII diagram.

> *"React + Web Audio + AudioWorklet on the client. Vercel edge functions for the AI endpoints. No database — localStorage handles per-file persistence with SHA-256 file-hash keying."*

### "What's the audio engine doing?"

> *"Per-stem chain: source → BiquadFilter → StereoPanner → gain → master, with a parallel reverb send into a shared ConvolverNode using a synthetic exponential-decay impulse response. Master crusher is an AudioWorkletNode with k-rate AudioParams. Sample-perfect sync via 50ms scheduling lookahead — every BufferSource starts at the same `ctx.currentTime + 0.05` so they share a transport."*

### "What's the bandpass for telephone, lowpass at 600Hz for underwater?"

> *"Standard producer reference settings. The agent's tool descriptions include those values as guidance — so when someone asks for 'underwater', the model has the right starting point baked in."*

### "How do you handle the agent making mistakes?"

> *"Three layers. First, the tools validate inputs — `set_volume("nonexistent_stem", 0.5)` returns an error, agent sees it and recovers. Second, every tool call is visible in the trace UI — the user can see what the agent did and undo if needed. Third, multi-turn: agent calls `describe_session` to verify its own state, so if it lost track it can re-orient."*

### "Why this for Pro-Create specifically?"

> *"Pro-Create's product is the bridge between Suno's generation and a producer's workflow. This demo is that exact shape, miniature: AI generates / analyzes / rearranges, producer takes the result into their workflow. The 12-stem export from Suno drops directly into this player."*

### Tests / production-readiness

> *"34 tests across 5 modules. Test suite caught a real refractory-period bug — beat detection was rounding 150ms minimum down to 139ms. Lazy-loaded the chat panel, so initial bundle is ~70KB gzip even with react-markdown."*

---

## What to AVOID

- **Don't open with "let me show you the code."** Open with the working demo. Code comes if they ask.
- **Don't apologize for what's missing.** No `.als` export, no cloud sessions — these aren't gaps, they're scope decisions. Move on.
- **Don't fill silence while the agent is thinking.** The streaming UI does the work — let them watch.
- **Don't oversell the personalization daemon.** That's K:BOT, not this demo. Different system.

---

## If something breaks live

| Failure | What to do |
|---|---|
| Agent endpoint times out | *"Vercel edge fn cold start — let me try again."* Click chip again. |
| Audio doesn't play | Check page focus. Click Play manually. Worst case: skip to "let me show you what it CAN do" and share the GitHub repo. |
| Agent returns malformed tool call | Hard refresh, try a different chip. |
| Vercel down (rare) | Run `npm run dev` locally, demo from `localhost:5174` — same code, no deploy dependency. |

---

## The single sentence to internalize

> **"AI listens, AI rearranges, I take the result home."**

Everything in this demo serves that arc. Don't drift off it.
