# Stem Player

Multi-stem audio player in the browser. Drop a folder of stems, get a mini-mixer
with sample-perfect sync, energy-based beat detection, tempo estimation, an
AudioWorklet bitcrusher on the master bus, and one-click MIDI export of the
detected beats.

Built in ~7 minutes as a working demo of the browser-audio surface area.

[Live demo](#) · React 19 + Vite + TypeScript · ~750 LOC

## What's interesting about it

- **Sample-perfect multi-stem playback** via shared start time
  (`ctx.currentTime + 50ms` lookahead). N `AudioBufferSourceNode`s, one shared
  transport, no drift.
- **Personalization layer**: SHA-256 hash of the file (or set of stems) is the
  localStorage key. Mute/solo/volume per stem, FX state, and analysis results
  all persist. Reload the page, drop the same file, get the same mix back.
- **Custom DSP via AudioWorklet**: bitcrusher processor with k-rate AudioParams.
  Lives in `public/bitcrusher-processor.js` (must be served as a separate file —
  bundlers can't touch it because `registerProcessor` runs in
  `AudioWorkletGlobalScope`).
- **Energy-based onset detection** (1024-sample frames, 1-second rolling mean,
  150ms refractory) with median-IBI tempo estimation folded into the 70-180 BPM
  range.
- **MIDI export**: hand-rolled Standard MIDI File Format-0 writer. Proper VLQ
  encoding, tempo meta event, note on/off events, EOT. Drop the resulting `.mid`
  into Ableton/Logic and the notes land on the detected beats.
- **Procedural demo content**: 4 stems (drums/bass/keys/lead) generated via
  `OfflineAudioContext` so the app can demo itself with no setup. C minor walk
  at 96 BPM, 8 bars.

## Module layout

| File | What it does |
|---|---|
| `src/audio.ts` | `AudioEngine` class — N-stem sync, gain routing, worklet management |
| `src/beats.ts` | `detectBeats()` + `estimateTempo()` |
| `src/midi.ts` | Standard MIDI File writer + `downloadBlob()` helper |
| `src/persist.ts` | localStorage adapter, file-hash keying, session state shape |
| `src/demo-stems.ts` | Procedural drums/bass/keys/lead via `OfflineAudioContext` |
| `src/App.tsx` | UI |
| `public/bitcrusher-processor.js` | AudioWorklet processor (k-rate AudioParams) |

## Run it

```bash
npm install
npm run dev
```

Then open `http://localhost:5174`. Click "Load procedural demo set" or drop your
own audio files (one or many — the app handles both single-track and multi-stem).

```bash
npm run build      # tsc + vite build
npm run preview    # serve the production build
```

## Why a stem player

Most browser-audio demos render a single waveform and call it done. The actual
shape of producer-tooling problems is multi-track: synchronized playback across
N sources, per-track FX routing, persistent mix state, and a clean bridge from
audio analysis back into a DAW (which is what the MIDI export is for).

## License

MIT
