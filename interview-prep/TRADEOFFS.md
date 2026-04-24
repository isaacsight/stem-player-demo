# Tradeoffs — Stem Player

> Every engineering decision with: **what we got**, **what we gave up**,
> and the **flip condition** (what would change the call).
>
> Use this when interviewers ask "why did you pick X over Y?"

---

## 1. Vercel for AI endpoints (instead of Supabase edge functions)

**Got:** Single domain (`stem-player-demo.vercel.app`) for frontend + `/api/*`. Zero CORS config. The `export const config = { runtime: 'edge' }` idiom is universally recognized.

**Gave up:** Doesn't reuse the Supabase project I already have authenticated for kernel.chat — slightly more infrastructure to point to.

**Flip condition:** If this had real users + auth, I'd move sessions to Supabase but keep the AI endpoints on Vercel. Each tool to its layer.

---

## 2. localStorage for persistence (instead of Supabase + auth)

**Got:** Zero-friction demo. Drop in, mix, reload, restored. SHA-256 file-hash keying gives it the same per-file resume behavior as a real account would.

**Gave up:** No cross-device sync. No share links. No leaderboards.

**Flip condition:** Real users would want their work to follow them. Move to Supabase auth + a `sessions` table with RLS the day someone asks for it.

---

## 3. Procedural demo stems (instead of bundling real Suno stems)

**Got:** App demos itself with no setup. ~20s of musical content generated via `OfflineAudioContext` — no download, no licensing, no IR file dependency.

**Gave up:** Procedural drums sound like a Game Boy. Real Suno stems would land harder.

**Flip condition:** Drop a real Suno stem set into `public/demo-stems/` and load by default. 10-minute change once you have the stems.

---

## 4. Render-to-WAV (skipped Ableton `.als` export)

**Got:** A working "take it home" path that's universal — every DAW reads WAV.

**Gave up:** The "drop into Ableton, all stems on separate tracks" magic moment.

**Flip condition:** ~3-4 hours of careful XML schema work + a real Ableton install for testing. Worth it for a portfolio piece, but a broken `.als` is worse than no `.als` — too risky for a demo deadline.

---

## 5. AudioWorklet bitcrusher on master bus only (not per-stem)

**Got:** One worklet processor file, one shared instance, no per-stem worklet management complexity.

**Gave up:** Can't crush just the drums while leaving the lead clean.

**Flip condition:** Per-stem crusher needs a worklet node per stem (cheap) + UI to expose it. ~30 min if a producer asks for it.

---

## 6. Synthesized impulse response for reverb (no IR file)

**Got:** Reverb works out of the box, ~10 lines of code, no asset to ship.

**Gave up:** Doesn't sound like a real space. A producer would notice.

**Flip condition:** Bundle a real IR — Sound on Sound has CC-licensed ones. ~50KB extra in `public/`, much better tonal character.

---

## 7. Anthropic Claude as the only LLM (not multi-provider)

**Got:** Tool-use that *actually works* on the first call. Sonnet 4.6 reliably emits structured tool inputs without hallucinating arg names. Streaming is mature.

**Gave up:** Vendor lock-in. If Anthropic raises prices or has an outage, the agent is offline.

**Flip condition:** OpenAI/Gemini have catching-up tool-use APIs. Multi-provider via a thin adapter layer would be ~3 hours. Worth it the first time Anthropic has a 30-min outage.

---

## 8. Server-side AI key (not BYOK from the user)

**Got:** Demo "just works" — visitor doesn't need an API key. Lower friction.

**Gave up:** I'm paying per request. A viral hit would be expensive.

**Flip condition:** Add a "use your own API key" toggle if traffic gets uncomfortable. Anthropic key in `localStorage`, never sent to my server.

---

## 9. React 19 + Vite (not Next.js)

**Got:** Simpler mental model — it's a static SPA with serverless functions. No SSR ceremony I don't need. Vite's HMR is faster than Next's.

**Gave up:** No server components, no built-in routing, no Next-specific deploy advantages.

**Flip condition:** This is a single-page demo. Next.js would be overkill. If the product grew into multi-page (sign-in flow, dashboard, etc.), I'd port to Next.

---

## 10. Web Audio API (not WebAssembly DSP / no Tone.js)

**Got:** Native browser API, zero dependencies, deeply optimized by browser vendors. AudioWorklet handles per-sample work in the audio thread. `AudioBufferSourceNode` is sample-perfect.

**Gave up:** Effects vocabulary is limited to BiquadFilter / StereoPanner / ConvolverNode + whatever I write in worklets.

**Flip condition:** If I needed pitch-shift, time-stretch, or anything beyond what `BiquadFilterNode` can do, I'd reach for Tone.js or Wasm DSP. Current scope doesn't need it.

---

## 11. localStorage SHA-256 keying (not session UUID)

**Got:** Same file → same key, regardless of when uploaded. The user can drop the same file a year later and their mix is back.

**Gave up:** Slight CPU cost on file load (SHA-256 a multi-MB buffer takes ~100ms).

**Flip condition:** A user dropping huge multi-stem sets every session would notice the hash time. Could memo by `name+size` as a cheap proxy if needed.

---

## 12. Lazy-loaded AgentChat (paid the code-split cost)

**Got:** Initial page bundle is 72KB gzip instead of 122KB. The chat (with react-markdown, ~52KB gzip) is fetched only when stems load.

**Gave up:** Brief loading state when stems first land — chat appears with a 200ms delay.

**Flip condition:** If usage data showed users opening the chat instantly, I'd preload it on idle instead of lazy-load. Currently lazy is the right call.

---

## 13. 18 tools (not 30+)

**Got:** Each tool has a clear purpose, the agent rarely picks the wrong one, the tool-use trace stays readable.

**Gave up:** Some producer actions (per-stem EQ, sidechain, automation curves) require the agent to compose multiple tools.

**Flip condition:** Add a tool the moment the agent tries to do something useful and fails. Don't add tools speculatively.

---

## 14. Skipped real-time collaboration

**Got:** Simpler architecture, no sync layer to debug live.

**Gave up:** No "two browsers, one session, mixing together" flex.

**Flip condition:** Cool but solves a problem nobody has in this scope. Would add WebRTC + Yjs the day a real use case lands.

---

## How to use this in the round

When asked "why X over Y?" → pick the relevant tradeoff, give it as **one sentence**, then offer the flip condition. That signals you've thought about it, not just defaulted.

> Q: "Why localStorage instead of a real database?"
> A: "Zero-friction demo — drop a file, mix, reload, restored. The day a real user asks for cross-device sync, that moves to Supabase."

That's the shape every answer should have.
