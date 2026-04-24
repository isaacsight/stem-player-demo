# Interview Vocabulary — Suno Pro-Create

> The words that make you sound like you belong in the room.
> Skim this Friday morning. Use the ones that fit; don't force what doesn't.
>
> The principle: **mirror their language.** When they say "stem," you say "stem."
> When they say "tokens," you say "tokens." Match the register.

---

## 🎚️ Producer / music-making vocabulary (use freely)

These are the words working producers actually say. Use them when describing
mix decisions in the demo or when answering audio questions.

| Term | What it means | When to use |
|---|---|---|
| **Stem** | A single mixed/rendered track within a multi-track session (drums, bass, vocals, etc.) | All over Pro-Create. Default term. |
| **Bus** | A summing destination — multiple tracks routed to one output for shared processing | "FX bus", "drum bus", "master bus" |
| **Send** | A parallel routing of a track to a bus (vs. inserting in-line) | "Reverb send", "delay send" |
| **Headroom** | dB of dynamic range left before clipping (typically -3 to -6 dB before mastering) | "Pulled the master back to give 6dB of headroom" |
| **Transient** | The initial attack burst of a sound (kick punch, snare crack) | "Tightened the transient", "transient-heavy stem" |
| **Pocket** | The rhythmic feel — when drums and bass lock in tight | "In the pocket", "drums sitting in the pocket" |
| **Glue** | Compression / saturation that makes elements feel like one cohesive mix | "Bus compression to glue the drums" |
| **Wet / Dry** | Wet = effected signal, Dry = unprocessed. Mix knob blends them | "70% wet on the verb" |
| **Color** | Tonal character imparted by a filter/saturator/etc. (subjective) | "The bitcrusher adds a lo-fi color" |
| **Lo-fi** | Intentionally degraded fidelity — tape, vinyl, bitcrush aesthetic | "Lo-fi vinyl crunch" |
| **Crispy / Crunchy** | Bright, edgy high frequencies (often from distortion) | "Crispy hats" |
| **Body / Weight** | Low-mid presence in a sound (around 100-300 Hz) | "Body in the bass" |
| **Air** | Very high frequencies (10kHz+) that add openness | "Add some air with a high shelf" |
| **Mud** | Excess low-mid buildup (200-500 Hz) that makes mixes unclear | "Cut the mud at 250" |
| **Solo / Mute** | Isolate one track / silence one track | Same as everywhere |
| **Bounce / Render** | Export the mix to a single audio file | "Bounce the master", "render to WAV" |
| **Stem-out** | Export each track as a separate WAV (what Suno's 12-stem export does) | Direct Pro-Create term |
| **Arrangement** | The structure of a song over time (intro/verse/chorus/etc.) | The agent's `schedule_arrangement` tool maps to this |
| **Section** | Named arrangement segment (intro, verse, drop, breakdown, outro) | Same |

### Producer phrases worth knowing

- *"Sitting in the mix"* — a stem at the right level relative to others
- *"Cut, don't boost"* — EQ doctrine: prefer subtractive over additive
- *"Less is more"* — universal mixing rule
- *"Mix in mono"* — checking mono compatibility
- *"Reference track"* — a commercial song you A/B against to check your mix

---

## 🎧 Audio engineering technical vocabulary

For when interviewers go deeper.

| Term | What it means |
|---|---|
| **dBFS** | Decibels relative to full scale (digital 0 dBFS = clipping) |
| **RMS** | Root mean square — the average loudness measure |
| **Peak** | The instantaneous maximum amplitude |
| **Crest factor** | Ratio between peak and RMS (high = dynamic, low = squashed) |
| **Sample rate** | Samples per second (44.1 kHz CD, 48 kHz video, 96 kHz pro) |
| **Bit depth** | Bits per sample (16-bit CD, 24-bit pro, 32-bit float for processing) |
| **Nyquist** | Half the sample rate — max representable frequency |
| **Aliasing** | Frequencies above Nyquist folding back as artifacts |
| **Latency** | Delay between input and output (in ms) |
| **Buffer size** | Audio block size — smaller = lower latency, higher CPU |
| **Spectrogram** | Time-frequency visualization (heatmap of FFT over time) |
| **FFT** | Fast Fourier Transform — converts time domain → frequency domain |
| **Envelope** | A control signal that shapes a parameter over time (ADSR) |
| **ADSR** | Attack / Decay / Sustain / Release — the four envelope stages |
| **LFO** | Low-frequency oscillator — slow modulator (typically <20 Hz) |
| **Filter cutoff** | The frequency at which a filter starts attenuating |
| **Q (resonance)** | How sharply a filter peaks at the cutoff frequency |
| **Convolution** | Multiplying two signals in time domain (used for reverb via IRs) |
| **IR (impulse response)** | A recording of a space's reverberation — fed into convolution reverb |
| **Sidechain** | Using one signal to modulate processing of another (classic: kick → bass) |
| **Mid/side** | Stereo encoding: M = (L+R)/2, S = (L-R)/2 — useful for stereo width work |

---

## 🤖 AI / agent vocabulary (be fluent here)

You'll be using these constantly. Get them right.

| Term | What it means |
|---|---|
| **Agent** | An AI loop with tools that can act, observe results, refine. Distinct from a one-shot model call. |
| **Tool use** | Model emits structured calls to functions you define; you execute them and return results |
| **Tool definition** | The schema (name, description, JSON input schema) given to the model |
| **Multi-turn** | Agent loop that runs across several model invocations, each conditioned on prior tool results |
| **Streaming** | Model emits tokens incrementally rather than as a final blob (SSE, WebSocket) |
| **Context window** | The total tokens the model can attend to in one call (Sonnet 4.6: 200K+) |
| **System prompt** | The pre-conversation instructions setting model behavior |
| **Temperature** | Randomness setting (0 = deterministic, 1 = creative) |
| **Eval** | A test that measures model behavior on a fixed set of inputs |
| **RLHF** | Reinforcement Learning from Human Feedback — how Claude/GPT post-trained |
| **Fine-tuning** | Continuing to train a base model on domain-specific data |
| **Distillation** | Training a smaller model to mimic a larger one's outputs |
| **RAG** | Retrieval-Augmented Generation — fetching context to inject into the prompt |
| **Embedding** | A vector representation of text/audio used for similarity search |
| **Vector store** | A database optimized for nearest-neighbor lookup over embeddings |
| **MCP** | Model Context Protocol — Anthropic's open spec for tool-use server integration |
| **SSE** | Server-Sent Events — one-way HTTP streaming protocol (used for AI streaming) |
| **JSON Schema** | The format for declaring tool input shapes |
| **Hallucination** | Model generates plausible but false output |
| **Chain of thought** | Explicit step-by-step reasoning in the model's output |

---

## 🎼 Suno-specific / generative-audio vocabulary (for the deep dive)

If they pull on the AI-music side, these terms unlock the conversation.

| Term | What it means |
|---|---|
| **Neural audio codec** | A small autoencoder that compresses audio to discrete tokens (SoundStream, EnCodec, DAC) |
| **Tokenization** | Converting continuous audio into a discrete token sequence the transformer can predict |
| **RVQ (residual vector quantization)** | The technique that makes neural codecs work — quantize, take residual, quantize again, layered |
| **Token rate** | How many tokens per second of audio (typically 50-100 tokens/sec for music) |
| **Codebook** | The discrete set of vectors a quantizer maps continuous values to |
| **Autoregressive** | Generating one token at a time, each conditioned on prior tokens (how transformers work) |
| **Diffusion** | Alternative generation paradigm — start from noise, denoise iteratively |
| **MusicGen / MusicLM / AudioLM** | Meta and Google's music-generation models — public references |
| **Conditional generation** | Generating audio conditioned on text/audio prompt |
| **Stem export** | Generating each instrument layer separately (Suno's 12-stem) |
| **Custom Models** | Suno's feature for fine-tuning on a producer's catalog — the personalization moat |
| **Prompt adherence** | How well the model's output matches the text prompt's intent |
| **Coherence** | How musically consistent the output is across its duration |

---

## 🌐 Web audio specific (for the demo)

| Term | What it means / use |
|---|---|
| **Web Audio API** | Browser's native audio graph API |
| **AudioContext** | The root of the audio graph; manages clock + sample rate |
| **AudioNode** | Any audio processing block (gain, filter, source) |
| **AudioBufferSourceNode** | Plays a decoded audio buffer; one-shot |
| **AudioWorklet / AudioWorkletNode** | Custom DSP that runs in the audio thread (replaces ScriptProcessorNode) |
| **AudioWorkletProcessor** | The class registered in the worklet that does per-sample processing |
| **AudioParam** | A node parameter that can be automated over time (`setValueAtTime`, `linearRampToValueAtTime`) |
| **k-rate / a-rate** | k-rate = one value per render quantum (128 samples); a-rate = per-sample |
| **OfflineAudioContext** | Renders audio faster than real-time, for export |
| **decodeAudioData** | Browser API that decodes encoded audio bytes (WAV/MP3/etc.) into an AudioBuffer |
| **AnalyserNode** | Provides FFT data for visualization (spectrograms, level meters) |

---

## 🛠️ Stack / engineering vocabulary

| Term | When to use |
|---|---|
| **Edge function / edge runtime** | Vercel/Cloudflare serverless functions running close to users (V8 isolates) |
| **Cold start** | The latency on the first invocation of a serverless function |
| **Bundle size** | Total JS shipped to the browser (gzip is the meaningful number) |
| **Code split / lazy load** | Defer loading some JS until it's needed |
| **SSR / SPA** | Server-side rendered vs single-page app |
| **Tree shake** | Bundlers removing unused code at build time |
| **HMR** | Hot Module Replacement — Vite's instant-update dev experience |
| **CI/CD** | Continuous Integration / Deployment |
| **RLS** | Row-Level Security (Postgres / Supabase) |
| **Optimistic UI** | Update UI immediately, reconcile with server later |
| **Rate limiting** | Capping how often a client can call an endpoint |
| **Idempotent** | An operation that can be safely retried (PUT, DELETE) |
| **Backoff** | Delaying retries with increasing intervals after failures |

---

## 🧠 Doctrine / framing vocabulary (the words that signal seniority)

These are the phrases that, when used naturally, mark you as someone who's
thought about systems beyond the surface.

| Phrase | When |
|---|---|
| **"Tradeoff"** | Always frame decisions as tradeoffs, not absolutes |
| **"Flip condition"** | "I'd flip that decision if X happened" |
| **"Right tool for the layer"** | When choosing among similar options |
| **"Defensible"** | When justifying a non-obvious choice |
| **"In the substrate"** | When something belongs at a deeper architectural layer |
| **"Surface area"** | The user-facing or API-facing footprint of a system |
| **"Move slow at the bottom, fast at the top"** | Stable foundations, fast iteration on UI |
| **"Where the moat compounds"** | When discussing strategic differentiation |
| **"Optimize for [X], pay [Y]"** | Naming what you're trading off |
| **"Land it cleanly"** | When discussing shipping a feature |
| **"Boring infrastructure, interesting product"** | The right priority order |
| **"Latency is an aesthetic"** | Performance as design |
| **"Personalization compounds"** | The Suno-relevant moat thesis |

---

## ⚠️ Things to AVOID saying

These mark you as outside the world. Don't say them.

| Don't say | Say instead |
|---|---|
| "AI" alone in technical contexts | Be specific: "Claude", "Sonnet 4.6", "the agent" |
| "GPT" when you mean any LLM | "Model", "LLM", or the specific name |
| "Prompt engineering" | "Prompt design" or "system prompt" — "engineering" oversells it |
| "Move fast and break things" | "Ship fast and iterate" — the original phrase is dated |
| "It just works" | Explain WHY it works |
| "AI-powered" | "AI-driven" or just describe what it does |
| "Cutting edge" | "Recent", "modern" — "cutting edge" sounds like marketing |
| "Best practices" | "What we landed on" — implies you've thought about it |
| "Robust" / "scalable" / "performant" | Be specific: "handles N concurrent users", "p95 under 200ms" |
| "Disrupt" | Never. |
| "Ecosystem" (overused) | "Stack" or "tooling" |
| "Pivoting" | "Shifting focus" — pivoting suggests failure |
| "Use case" (overused) | "Workflow", "scenario", "what people actually do" |
| "Solving for X" | "Optimizing for X" — "solving" is a tell |
| "AI-native" (in technical context) | Just describe how the AI is integrated |

---

## 🎯 Suno-specific terms to mirror

If they say these — match the language back.

- **Pro-Create** — their producer-tools team / surface (NOT Procreate the illustration app)
- **Custom Models** — their personalization feature
- **Suno Studio** — the producer-facing editing surface
- **Stem export** / **12-stem export** — the producer feature
- **Generation** — for what the model produces (not "creation" or "synthesis")
- **Inference** — the model run (not "the AI thinking")
- **Style** — what producers want to control
- **Coherence** — musical consistency across a generation

---

## 🎤 Phrases to have ready (memorize the shape)

- *"The interesting tradeoff there is…"*
- *"What I optimized for was…, what I traded was…"*
- *"I'd flip that decision the day…"*
- *"That's a real engineering choice — let me defend it."*
- *"The substrate matters more than the surface here."*
- *"Personalization is where the moat compounds — capability is converging."*
- *"Producer-facing tools are the post-generation surface."*
- *"The tools type. I decide."*
- *"AI listens, AI rearranges, you take the result home."*

---

## The single principle

> **Mirror their language. Match their register. Use the producer terms when
> talking music; use the AI/engineering terms when talking systems.
> Don't try to use all of these — use the ones that fit naturally.**

The goal is to sound like a peer, not like someone studying for a test.

If a word is in this doc but doesn't sound like you, **don't force it.**
The interviewer notices forced vocabulary faster than they notice missing it.
