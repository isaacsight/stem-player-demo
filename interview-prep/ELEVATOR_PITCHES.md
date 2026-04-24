# Elevator Pitches — Stem Player

> Three versions of the same story. Pick by the time slot you're given.
> Land the words; trust the demo to do the rest.

---

## 30 seconds — "Tell me what you built"

> "Stem Player. Browser-based multi-stem audio player with a real AI mixing
> engineer underneath. Drop in stems, ask the agent to mix and arrange,
> watch it stream tools — schedule arrangements, apply per-stem filters,
> reverb sends, bitcrushers — and download the result as a WAV. Sample-perfect
> sync via Web Audio, AudioWorklet for custom DSP, Vercel edge functions
> with Claude Sonnet for the agent loop. The interesting part: it's
> 18 tools the model has, not 1 — closer to a co-producer than a button."

Delivery: one breath per sentence. ~85 words.

---

## 2 minutes — "Walk me through it"

> "I built Stem Player to show how I'd build the bridge between an AI
> generation product like Suno and the producer workflow that Pro-Create
> is for.
>
> The surface: drop a folder of stems — drums, bass, keys, lead, or
> 12 stems from a Suno export. They render as waveforms in a sample-perfect
> multi-track mixer with an AI mixing engineer chat panel underneath. You
> ask the agent to do a mix — 'downtempo lo-fi arrangement', 'festival
> drop', 'underwater dream' — and it streams text while calling tools that
> actually change the audio: per-stem volumes, lowpass filters, pan, reverb
> sends, an AudioWorklet bitcrusher on the master bus, and timed automation
> events that play out as the transport rolls.
>
> The stack: React 19 + Vite + TypeScript on the client. Vercel edge
> functions for the AI endpoints — Claude Sonnet streams tool-use blocks
> over server-sent events; a client-side agent engine executes the tools
> against the AudioEngine and posts results back for multi-turn refinement.
> Web Audio for everything audio — `AudioBufferSourceNode` for sync,
> `BiquadFilter` and `StereoPanner` for per-stem FX, `ConvolverNode` with
> a synthesized impulse response for shared reverb, `AudioWorkletNode`
> for the bitcrusher, `OfflineAudioContext` to render the arranged session
> back to a downloadable WAV.
>
> The interesting engineering: the agent has 18 tools that map directly
> onto the audio graph, including a Scheduler that fires automation events
> as the playhead crosses them — the agent literally writes time-based
> arrangements that play themselves. localStorage persists per-file mix
> state with SHA-256 file-hash keying so reloading and dropping the same
> file restores your work.
>
> 34 tests. Lazy-loaded chat panel keeps initial bundle under 75KB gzip.
> Live at stem-player-demo.vercel.app."

---

## 5 minutes — "Show me how you think about the problem space"

Open with the 2-minute pitch. Then:

> "The thesis behind why I built it this way: AI music products like Suno
> have the generation problem largely solved — neural audio codec, residual
> VQ, transformer over the token stream. The interesting frontier is the
> *post-generation* surface: how a producer takes the output and works with
> it. That's the Pro-Create problem. The 12-stem export is the smartest
> call Suno made because it acknowledges the producer's tools matter.
>
> So I built the next link. The stem player is the primitive. The AI agent
> on top of it is what makes it different from Audacity-in-the-browser —
> instead of asking the producer to twist 50 knobs, the agent has the same
> 50 knobs as tools and can write a full arrangement in 15 seconds. The
> producer reviews, redirects, takes the WAV.
>
> Two architectural decisions I want to defend:
>
> First, the agent is a *real* agent loop, not a one-shot button. It calls
> `describe_session` to inspect, fires multiple tools per turn, gets results
> back, refines. The user sees text streaming, tool-use trace populating
> live, mix changing in real time. That's a different shape than 'submit
> form, get answer.' It's the AI-product UX that ships in 2026, not 2024.
>
> Second, I picked the agent's tool set deliberately. Volume/mute/solo
> are obvious. Per-stem `BiquadFilter` + `StereoPanner` + reverb send is
> what producers actually touch. `schedule_arrangement` for time-based
> automation is the unlock — that's where the agent stops feeling like a
> mixing assistant and starts feeling like a co-producer. `set_loop_region`
> + section labels close the producer-vocabulary loop.
>
> Where I'd take it next: feed the agent's actions back into a personalization
> loop — log every accept/reject, fine-tune the routing on what the user
> actually keeps. That's the same architectural shape Suno is making with
> Custom Models, applied to the producer-tools layer. Personalization at
> each level of the hierarchy is where the moat lives."

---

## Opening lines you can swap in

| Context | Line |
|---|---|
| They open with stack | "Quick context — I'll show you the live demo and we can pull on whatever's interesting." |
| They open with prior work | "Most relevant thing is this — built it as a self-driven project specifically because Pro-Create is the team I want to be on." |
| They open with you talk first | Use the 2-minute pitch. |
| They want philosophy first | Use the 5-minute pitch's "thesis" paragraph. |

---

## What to avoid

- Don't open with the stack. The product opens.
- Don't say "small demo" or "side project." It's a complete slice.
- Don't claim the AI is "smart." Show it doing things.
- Don't compare yourself to Suno. You're showing what comes *next* to it.
