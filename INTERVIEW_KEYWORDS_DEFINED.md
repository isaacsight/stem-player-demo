# Interview Keywords — Defined

> Every keyword from the previous list, with what it actually means.
> If you can't define a word, don't use it. Read this until you can
> explain each in your own words.

---

## 🎯 The 12 power keywords

### 1. Tool use

**What it is:** A pattern where an AI model emits structured calls to functions you define, instead of just emitting text. You execute the function on your end, return the result to the model, and it continues generating.

**Example:** *"My agent uses Claude's tool-use API — I define 18 tools like `set_volume` and `schedule_arrangement`. When the user says 'mix this lo-fi,' Claude emits tool_use blocks, my client executes them against the AudioEngine, posts the results back."*

**What it's NOT:** Just calling a function in your code. Tool use specifically means *the model decides which function to call and with what arguments.*

---

### 2. Agent loop

**What it is:** A multi-step pattern where the AI model doesn't just answer once — it acts, observes the result, decides what to do next, and continues until done. The minimum loop: think → act → observe → think.

**Example:** *"The agent loop runs across multiple turns. Claude calls `describe_session` to inspect, then `schedule_arrangement` to act, then sees the result come back as a tool_result, and may refine. That's a real loop, not a one-shot."*

**What it's NOT:** A single API call where the model returns text. That's a model call, not an agent loop.

---

### 3. Streaming

**What it is:** The model emits its response token-by-token as it's generated, rather than waiting for the full response and sending it as one blob. Usually delivered over Server-Sent Events (SSE) or WebSockets.

**Example:** *"My agent endpoint streams via SSE. The user sees text appear word-by-word, tool-use blocks populate as Claude commits to them, and the UI updates in real time. That's the modern AI-product UX shape."*

**What it's NOT:** "Fast." Streaming is about *progressive delivery*, not speed. A streaming response that takes 30 seconds total still feels faster than a non-streaming one because the user sees progress.

---

### 4. Multi-turn

**What it is:** A conversation that maintains context across multiple back-and-forth exchanges. The model sees prior messages and tool_results when deciding what to do next.

**Example:** *"Multi-turn means the agent gets a second chance. It schedules an arrangement, sees the tool_result, and can call `get_arrangement` to verify what landed before describing it back to the user."*

**What it's NOT:** Multiple separate API calls with no shared context. Multi-turn requires the model to see the history.

---

### 5. Personalization

**What it is:** A system that adapts to the specific user it's serving — through learned routing, fine-tuning, retrieved context, or behavioral signals. The output for User A differs from User B, even on the same input.

**Example:** *"Personalization is where the moat compounds. Capability is converging across providers — every model can mix audio reasonably. The differentiation is how well the system learns YOU specifically. Suno's Custom Models is one shape; K:BOT's overnight learning daemon is another."*

**What it's NOT:** Just storing user preferences in a database. Personalization implies the *model behavior* changes, not just the UI state.

---

### 6. Tokenization

**What it is (for audio):** Converting continuous audio (a stream of float samples) into a sequence of discrete tokens — the way a transformer needs its inputs. For audio this is done with a *neural audio codec* (an autoencoder trained to compress + reconstruct), typically using *residual vector quantization (RVQ)*.

**Example:** *"Suno's generation pipeline tokenizes audio with a neural codec — probably something like SoundStream or EnCodec. The transformer then predicts the next audio token autoregressively, the same way GPT predicts the next word."*

**What it's NOT:** The same as text tokenization. Audio tokenization requires hand-designed signal-processing models; text tokenization is just BPE on bytes.

---

### 7. Markdown-first / spec-first

**What it is:** A development methodology where you write the design document in markdown *before* writing the code. The spec describes problem statement, architecture, interfaces, behavior. The implementation is then generated (often by AI) from the spec, and humans validate.

**Example:** *"K:BOT has 53 markdown design docs underneath 255K lines of TypeScript. They're not documentation — they're blueprints. PRODUCER_ENGINEER_SPEC.md describes the agent before the producer.ts file ever existed. Spec is the contract — both with the AI and with future-me."*

**What it's NOT:** Writing docs after the code is done. That's just documentation.

---

### 8. Tradeoff

**What it is:** An engineering decision where choosing X means giving up Y. Every meaningful design choice is a tradeoff — naming it explicitly is what separates senior engineers from junior ones.

**Example:** *"The tradeoff with lazy-loading the chat panel is brief loading state when stems first land — but I traded that for 41% smaller initial bundle. For a demo where the chat is below the fold, that's the right call."*

**What it's NOT:** A drawback. A tradeoff implies you got something *in exchange* for what you gave up. "It's slow" is a drawback. "It's slower because it's more accurate" is a tradeoff.

---

### 9. Flip condition

**What it is:** The specific scenario in which you'd reverse a decision. Naming it proves you didn't make the choice by default.

**Example:** *"I picked Vercel over Supabase edge functions because single-domain colocation eliminates CORS. Flip condition: the day I need to consolidate on the Supabase project I already have for kernel.chat, or if I needed multi-region edge presence."*

**What it's NOT:** A wishlist. A flip condition is a concrete trigger, not "I'd change it if it got better."

---

### 10. Substrate

**What it is:** The deeper architectural layer that other things depend on. Often used to distinguish foundation from surface — a substrate is what enables, not what users see directly.

**Example:** *"The Scheduler in `automation.ts` is the substrate that makes the agent feel like a co-producer. Without rewind-aware event firing, the agent could write arrangements but they wouldn't survive playback."*

**What it's NOT:** A buzzword. Use it specifically — when something is doing structural work, not surface work.

---

### 11. Surface area

**What it is:** The user-facing or API-facing footprint of a system. The number of distinct things people can interact with. More surface = more flexibility but more maintenance.

**Example:** *"K:BOT's surface area is 670+ tools across 35 agents. That's a lot for one person to maintain — which is why I wrote `CURATION_PLAN.md` to cut it to 52 core + the rest as plugins. Reducing surface area was the right move."*

**What it's NOT:** "Features." Surface area is about the *interface*, not the underlying capability.

---

### 12. Where the moat compounds

**What it is:** The specific layer of a product where competitive advantage builds over time and resists copying. Often distinct from where the headline value comes from.

**Example:** *"Generation is converging across providers — Udio, Stable Audio, MusicLM. Capability isn't the moat anymore. The moat compounds in the personalization layer and the producer-tools layer. That's where Pro-Create matters."*

**What it's NOT:** A general advantage. A moat *compounds* — meaning each interaction makes it stronger, harder to replicate.

---

## 🎚️ Music-tech keywords (defined)

### Stem
A single rendered/mixed track within a multi-track session. The drum track. The bass track. The vocals track. Suno's "12-stem export" gives you 12 separate audio files, each with one element.

### Headroom
Decibels of unused dynamic range below digital clipping (0 dBFS). A mix with -3 dB peaks has 3 dB of headroom. Producers leave headroom for mastering. *"Pulled the master back to give 6dB of headroom."*

### Pocket
The rhythmic feel when drums and bass lock together tightly. *"In the pocket"* = grooving correctly.

### Mix bus
A summing destination — multiple tracks routed to one output where shared processing (compression, EQ) is applied. Drums going to a "drum bus" lets you compress the whole kit together.

### Send
A *parallel* routing of a track to a bus. You "send" 30% of the lead vocal to a reverb bus while the dry signal still goes to master. Different from inserting reverb in-line on the vocal.

### Lo-fi
An aesthetic of intentionally degraded fidelity — bitcrush, vinyl crackle, tape saturation, narrow bandwidth. Originally a genre tag, now a sonic descriptor.

### Wet / Dry
**Wet** = the effected signal. **Dry** = the unprocessed signal. The wet/dry ratio is how much of the effect you blend in. *"70% wet on the verb."*

### Glue
Compression or saturation that makes individual elements feel like one cohesive mix instead of separate tracks. Bus compression "glues" drums together.

### Transient
The initial sharp attack burst of a sound — the kick punch, the snare crack, the pluck of a string. Transient design = shaping that initial moment. Compression often softens transients; transient designers can sharpen or soften them.

### DAW
**Digital Audio Workstation** — Ableton, Logic, Pro Tools, FL Studio, Reaper. The software producers use. Pro-Create's product surface lives next to your DAW.

### VST / AU
Plugin formats. **VST** (Steinberg) is cross-platform. **AU** (Audio Units) is Apple's. Most plugins ship both.

### MIDI
Musical Instrument Digital Interface. The protocol for *symbolic* music — notes, velocities, controllers, timing. NOT audio. A MIDI file is a list of "play C4 at velocity 100 from t=0 to t=0.5." Stem Player's MIDI export turns detected beats into MIDI notes.

### BPM
Beats per minute. Tempo. *"96 BPM"* = 96 beats per minute = 1.6 beats per second.

### Sidechain
Using one signal to modulate processing on another. Classic move: kick drum sidechains a compressor on the bass, so every kick hit briefly ducks the bass. Creates the pumping feel of EDM.

### DSP
**Digital Signal Processing.** The math/algorithms that process audio in code. Filters, compressors, reverbs — all DSP. The AudioWorklet is where you write custom DSP.

---

## 🤖 AI-tech keywords (defined)

### Sonnet 4.6
Anthropic's mid-tier Claude model as of 2026. Faster than Opus, more capable than Haiku. Tool use works reliably. The model behind your agent.

### Tool definition
The schema you give the model: name, description, JSON schema for inputs. The model uses these to decide which tool to call. Tool definitions live in `agent-tools.ts:AGENT_TOOLS`.

### JSON Schema
The standard format for declaring data shapes. Tool definitions use it to specify what inputs the model should produce. *"Required field, type number, enum of these values…"*

### MCP
**Model Context Protocol.** Anthropic's open spec (announced 2024) for how AI models consume tools from external servers. You write an MCP server once; Claude Desktop, Claude Code, and other MCP-aware clients can all use it. K:BOT has 7+ MCP servers.

### SSE
**Server-Sent Events.** A one-way HTTP streaming protocol. The server keeps the connection open and sends event chunks. Used by your `/api/agent` endpoint to stream Claude's response. Simpler than WebSocket; perfect for AI streaming.

### AudioWorklet
The modern Web Audio API for running custom DSP in the audio thread (separate from main thread). Replaces the deprecated ScriptProcessorNode. Your bitcrusher is an AudioWorklet.

### RVQ (Residual Vector Quantization)
The technique that makes neural audio codecs work. Quantize the input to the nearest entry in a codebook. Take the difference (residual) between input and quantized output. Quantize that residual to another codebook. Repeat. Each layer adds detail. Lets you compress audio to ~75 tokens per second while reconstructing it accurately.

### Custom Models (Suno's term)
Suno's feature where producers can fine-tune a model variant on their own catalog so future generations sound like them. The personalization moat for Suno specifically.

### Eval
Short for "evaluation." A test that measures model behavior on a fixed set of inputs. Evals catch regressions when you change a prompt, swap models, or update your agent. Different from unit tests because the input/output is fuzzy.

### RAG
**Retrieval-Augmented Generation.** Pattern where you fetch relevant context (from a vector store, a database, a search) and inject it into the prompt before the model generates. Gives the model knowledge it doesn't have in its training data.

### Fine-tuning vs prompting vs agentic
Three ways to make models behave differently:
- **Prompting**: change the system prompt or context. Cheap, fast, no model training.
- **Fine-tuning**: continue training on your data. Expensive, slow, model-specific.
- **Agentic**: give the model tools and let it act in a loop. The architecture, not the model, does the work.

---

## 🧠 Doctrine phrases (defined + when to use)

### "The interesting tradeoff is…"
Use when explaining a non-obvious decision. Signals you're not handwaving — you've thought about both sides.

### "I'd flip that decision the day…"
Use after stating a choice. Signals it wasn't picked by default — there's a real condition that would change your mind.

### "Right tool for the layer."
Use when defending why you didn't use one tool for everything. Signals you think about *layers* of a system having different needs.

### "The substrate matters more than the surface."
Use when discussing foundation vs UI. Signals you prioritize the layer that compounds.

### "Personalization is where the moat compounds — capability is converging."
Use as the strategic-fit answer for Suno specifically. This is the Pro-Create thesis in one sentence.

### "Latency is an aesthetic, not a metric."
Use when discussing perf. Signals you treat speed as part of the product, not a separate concern. Linear's design philosophy.

### "Boring infrastructure, interesting product."
Use when defending choosing standard tech (Postgres, Vercel) over novel. Signals you save complexity for where it differentiates.

### "Move slow at the bottom, fast at the top."
Use when discussing how to balance stability with velocity. Foundations should be solid + change rarely; UI should iterate freely.

---

## 🔑 Suno-specific terms (mirror these)

### Pro-Create
Suno's producer-tools team and surface. **NOT** Procreate the iPad illustration app. If you ever say "Procreate" instead of "Pro-Create" you'll lose credibility instantly.

### Suno Studio
The producer-facing editing surface from Suno. Where the 12-stem export lives.

### 12-stem export
Suno's feature where a generated track is delivered as 12 separate audio files (drums, bass, vocals, etc.) so producers can mix them in their DAW. The reason your Stem Player demo is Pro-Create-shaped.

### Generation
What the model produces. Use this word, not "creation" or "synthesis." *"The generation came back at 96 BPM."*

### Inference
The act of running the model. Not "the AI thinking." *"Inference latency is 5 seconds for the first audio chunk."*

### Coherence
How musically consistent a generation is across its full duration. A coherent generation has the same key, tempo, and stylistic elements throughout. Incoherent generations drift.

### Style
The producer-controllable knob — what the generation sounds like. *"Style transfer", "style tokens", "controlling style without changing prompt."*

---

## The single principle

> **You don't need to use every word. You need to be able to define every word you use.**

If you say "tokenization" and they ask "what do you mean by that?" — you should be able to answer in 30 seconds without panicking. That's the test.

Read this doc until each definition is in your own words, not the doc's. That's when you own the vocabulary.
