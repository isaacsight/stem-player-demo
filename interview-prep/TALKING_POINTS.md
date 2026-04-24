# Talking Points — Stem Player

> The twelve things to have internalized before walking in.
> If you can say each in 20 seconds or less, you're ready.

---

## The big three — memorize verbatim

### 1. What you built and why

> "Stem Player — a browser-based multi-stem audio player with an AI mixing
> engineer that has 18 tools mapped onto a real audio engine. Built it
> specifically to demonstrate the bridge layer between Suno's generation
> output and the producer's workflow that Pro-Create is for. End-to-end,
> deployed, working — drop in stems, agent rearranges, you take the WAV."

### 2. The engineering thesis

> "The interesting frontier in AI music isn't the generation — it's the
> *post-generation* surface. Producers want to grab the output and *do*
> something with it. The agent is the unlock: instead of asking the producer
> to twist 50 knobs, give the agent those 50 knobs as tools and let it
> write the arrangement. The producer reviews, redirects, ships. That's
> the shape of producer-tools that wins in 2026."

### 3. The personalization parallel

> "Capability is converging across providers — every model can mix audio
> reasonably given the right tool descriptions. Differentiation is
> personalization. Same architectural bet Suno is making with Custom
> Models on the audio side: tokenize agent actions the way Suno tokenizes
> audio, train on what each user keeps. The next link is hierarchical
> personalization at the producer-tools layer."

---

## The middle six — know the shape, improvise the words

### 4. Why an agent and not a feature

> "An AI feature is button → API call → result. An agent is a loop:
> inspect, plan, act, observe, refine. My agent calls `describe_session`
> first, schedules a multi-tool plan, executes it across multiple turns,
> auto-plays the result. The user sees streaming text, live tool-use
> trace, and the mix changing in real time. That's a different UX shape
> than one-shot."

### 5. Stack judgment

> "React 19 + Vite + TypeScript on the client, Vercel edge functions for
> the AI endpoints, Anthropic Claude SDK with tool use. Web Audio for
> everything audio — `AudioBufferSourceNode` for sync, `BiquadFilter`,
> `StereoPanner`, `ConvolverNode`, `AudioWorkletNode` for custom DSP.
> No heavy framework on the agent side — just a typed tool registry and
> a streaming loop. Pragmatic 2026 pick."

### 6. Sample-perfect sync

> "Every stem source starts at the same `ctx.currentTime + 50ms` —
> a scheduling lookahead masks per-source jitter so all the buffer
> sources share a transport. No drift across N stems. That's the
> Suno 12-stem export use case directly."

### 7. AudioWorklet for custom DSP

> "The bitcrusher is an `AudioWorkletNode` with k-rate `AudioParam`s.
> Lives in `public/bitcrusher-processor.js` because `registerProcessor`
> runs in `AudioWorkletGlobalScope` — bundlers can't touch it. It's
> the example I'd point to for any per-sample browser DSP work."

### 8. The Scheduler / arrangement engine

> "When the agent calls `schedule_arrangement`, it submits an array of
> `{atSec, type, stem, value}` events. A client-side Scheduler watches
> the playhead during transport and fires events as the time crosses
> them. Rewind-aware — playing again from t=0 re-fires everything.
> That's the unlock that makes the agent a co-producer, not a knob-turner."

### 9. Render-to-WAV closes the loop

> "The user can take the agent's work home. `OfflineAudioContext` mirrors
> the live audio graph, applies the static mix plus all automation events
> via `AudioParam.setValueAtTime`, and emits a PCM 16-bit WAV. One click,
> downloads. AI listens, AI rearranges, you keep the result."

---

## The last three — depth probes

### 10. Persistence without a backend

> "SHA-256 hash of the file (or set of stems) is the localStorage key.
> Per-file mute/solo/volume, FX state, beats, tempo — all persists.
> Reload, drop the same file, banner appears — `Restored mix from
> memory`. If this had real users, persistence moves to Supabase, but
> for the demo localStorage is the right substrate — no auth, no
> friction."

### 11. Tests caught a real bug

> "34 tests across 5 modules. The suite caught the beat-detection
> refractory rounding 150ms minimum *down* to 139ms — `Math.floor`
> should have been `Math.ceil`. That's the kind of thing tests catch
> that visual review doesn't. Refractory periods are a contract."

### 12. Tradeoffs I made deliberately

> "Skipped Ableton `.als` export — the schema is complex and version-
> specific, and a broken `.als` in the demo is worse than no `.als`.
> Render-to-WAV covers the producer-takeaway value. Skipped cloud
> session save for the same reason — auth and RLS plumbing don't
> demonstrate what this round is about. Lazy-loaded the chat panel
> instead — kept initial bundle under 75KB gzip."

---

## Don't say

- "It's just a demo." It's a complete product slice.
- "It's small." 2,500+ LOC across 13 modules with 34 tests.
- "I used Cursor / Claude Code." The tools type. You decide.
- "AI built this." Be honest about the dynamic — you architected, the tools
  implemented, you validated.
- "Setlist" — you built **Stem Player**, not the hypothetical Setlist demo.
- Anything about Procreate-the-illustration-app. The interview is Suno.

---

## The single sentence to internalize

> **AI listens, AI rearranges, you take the result home.**

Everything in the demo serves that arc. Don't drift off it.
