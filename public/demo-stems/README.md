# Demo Stems Folder

Drop a real audio stem set in this folder + add a `manifest.json` and the app
will auto-load them on boot, bypassing the procedural fallback.

## Why bother

The procedural drums/bass/keys/lead generated in-app sound like a cheap
GameBoy. A real Suno 12-stem export (or any musically interesting stem set)
makes the demo land *significantly* harder.

## How

1. Generate a track on Suno → download the **12-stem export**
2. Drop the WAV/MP3 files in this folder
3. Create `public/demo-stems/manifest.json`:

```json
{
  "title": "Suno track — 90s Atlanta soul, 96 BPM",
  "stems": [
    { "name": "drums", "file": "drums.mp3" },
    { "name": "bass", "file": "bass.mp3" },
    { "name": "keys", "file": "keys.mp3" },
    { "name": "lead", "file": "lead.mp3" },
    { "name": "vocals", "file": "vocals.mp3" }
  ]
}
```

4. `npm run build && vercel deploy --prod`
5. Reload the live site — stems auto-load on page load.

## Naming convention

The `name` field becomes the stem label in the mixer UI. The `file` field is
the filename in this folder. Use lowercase, single-word names (drums, bass,
vocals, lead, keys, fx, percussion, etc.) so the agent's heuristics can
identify them by name when applying mix-style decisions.

## Format support

Any format the browser's Web Audio API can decode:
- WAV (recommended — uncompressed, fastest decode)
- MP3
- M4A / AAC
- FLAC (most browsers)
- OGG / Opus

Total bundle size matters — large WAVs add to the page load. MP3 192kbps is a
good default for a 12-stem demo set.

## Privacy / licensing

Anything you put here will be **publicly accessible** at
`https://stem-player-demo.vercel.app/demo-stems/<filename>`. Don't commit
copyrighted material you don't have rights to redistribute.
