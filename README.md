# Stem Player

Browser-based multi-stem audio player with sample-perfect sync, an AudioWorklet
bitcrusher, energy-based beat detection, MIDI export, per-file localStorage
persistence, and an AI-driven mix assistant.

Built solo as a demo of the full-stack-with-AI surface area: React 19 frontend,
Vercel edge functions for the AI endpoints, Anthropic Claude for the AI layer,
and a Vitest suite covering the pure modules.

[Live demo](#) · React 19 + Vite + TypeScript · ~1100 LOC

## What's interesting about it

### Audio engineering

- **Sample-perfect multi-stem playback** — N `AudioBufferSourceNode`s, all
  started in the same audio-clock tick (`ctx.currentTime + 50ms` lookahead) so
  they share a transport with no drift.
- **AudioWorklet custom DSP** — bitcrusher processor with k-rate `AudioParam`s.
  Lives in `public/bitcrusher-processor.js` (must be served as a separate file
  because `registerProcessor` runs in `AudioWorkletGlobalScope` — bundlers
  can't touch it).
- **Energy-based onset detection** — 1024-sample frames, 1-second rolling mean,
  150ms refractory (rounded *up* to honor the minimum, not down).
- **Median-IBI tempo estimation** — folded into the 70-180 BPM musical range to
  handle subdivisions.
- **MIDI export** — hand-rolled Standard MIDI File Format-0 writer. Proper VLQ
  encoding, tempo meta event, note on/off, EOT.

### AI integration

- **`/api/mix-suggest`** (Vercel edge fn) — analyzes the loaded session and
  returns a producer-style description + suggested mix actions (mute/solo/
  volume) as a structured tool-use response. Apply the suggestion in one click.
- **`/api/auto-name`** (Vercel edge fn) — extracts per-stem features
  (RMS, spectral centroid, peak count, ZCR), sends them to Claude Haiku, gets
  back inferred stem types ("drums" / "bass" / "vocals" / etc.). Useful for
  Suno-style exports that arrive with neutral filenames.
- Both endpoints use **Anthropic's tool-use** for guaranteed JSON output —
  no parsing of free-form prose.

### Personalization

- SHA-256 hash of the file (or set of stems) is the localStorage key. Mute,
  solo, volume, FX state, beats, and tempo all persist per-file. Reload the
  page, drop the same file, get the same mix back.

### Procedural demo content

- 4 stems (drums/bass/keys/lead) generated via `OfflineAudioContext` so the app
  demos itself with no setup. C minor walk at 96 BPM, 8 bars.

## Module layout

| File | What it does |
|---|---|
| `src/audio.ts` | `AudioEngine` class — N-stem sync, gain routing, worklet management |
| `src/beats.ts` | `detectBeats()` + `estimateTempo()` |
| `src/midi.ts` | Standard MIDI File writer + `downloadBlob()` helper |
| `src/persist.ts` | localStorage adapter, file-hash keying, session state shape |
| `src/analysis.ts` | Per-stem feature extraction (RMS, spectral centroid, peaks, ZCR) |
| `src/api-client.ts` | Frontend → backend client for the AI endpoints |
| `src/demo-stems.ts` | Procedural drums/bass/keys/lead via `OfflineAudioContext` |
| `src/App.tsx` | UI |
| `public/bitcrusher-processor.js` | AudioWorklet processor (k-rate AudioParams) |
| `api/mix-suggest.ts` | Vercel edge fn: AI mix assistant |
| `api/auto-name.ts` | Vercel edge fn: AI stem-type inference |

## Run it

```bash
npm install
npm run dev      # vite dev server on :5174 — frontend only
npm test         # vitest run — 18 tests across beats / midi / persist
npm run build    # tsc + vite build
```

For the AI endpoints to work locally, run via Vercel CLI:

```bash
npm i -g vercel
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
vercel dev
```

## Deploy to Vercel

```bash
vercel link
vercel env add ANTHROPIC_API_KEY production
vercel deploy --prod
```

The edge functions live in `api/` and are deployed automatically by Vercel.
The single env var required is `ANTHROPIC_API_KEY`.

## Tests

```bash
npm test
```

Currently: 18 tests across `beats.test.ts`, `midi.test.ts`, `persist.test.ts`.
The test suite caught a real off-by-one in the beat-detection refractory
period (rounded down to 139ms instead of up to ≥150ms) — fixed by switching
`Math.floor` → `Math.ceil` in `beats.ts:25`.

## License

MIT
