import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AudioEngine, type Stem } from './audio'
import { detectBeats, estimateTempo } from './beats'
import { buildMidiFile, downloadBlob } from './midi'
import { fileKey, stemSetKey, load, save, type SessionState } from './persist'
import { generateDemoStems } from './demo-stems'
import { rmsDb, richFeatures } from './analysis'
import { requestAutoName } from './api-client'
import AgentChat from './AgentChat'
import type { AgentContext } from './agent-tools'

type StemUI = {
  name: string
  buffer: AudioBuffer
  muted: boolean
  volume: number
  solo: boolean
  inferredType?: string
  inferredConfidence?: number
}

const WAVE_HEIGHT = 160

export default function App() {
  const [stems, setStems] = useState<StemUI[]>([])
  const [duration, setDuration] = useState(0)
  const [position, setPosition] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [over, setOver] = useState(false)
  const [beats, setBeats] = useState<number[]>([])
  const [tempo, setTempo] = useState<number | null>(null)
  const [crushOn, setCrushOn] = useState(false)
  const [bits, setBits] = useState(8)
  const [reduction, setReduction] = useState(4)
  const [savedKey, setSavedKey] = useState<string>('')
  const [restoredFromMemory, setRestoredFromMemory] = useState(false)
  const [aiBusy, setAiBusy] = useState<'name' | null>(null)
  const [aiError, setAiError] = useState<string>('')

  const engineRef = useRef<AudioEngine | null>(null)
  const rafRef = useRef<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getEngine = useCallback(() => {
    if (!engineRef.current) engineRef.current = new AudioEngine()
    return engineRef.current
  }, [])

  // ── File loading ──

  const loadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    const engine = getEngine()
    const audioFiles = files.filter(f => f.type.startsWith('audio/') || /\.(wav|mp3|ogg|flac|m4a)$/i.test(f.name))
    if (audioFiles.length === 0) return

    const buffers = await Promise.all(audioFiles.map(f => engine.decode(f)))
    const stemList: Stem[] = audioFiles.map((f, i) => ({ name: stripExt(f.name), buffer: buffers[i] }))

    // Restore persisted state if available
    const key = audioFiles.length === 1
      ? await fileKey(audioFiles[0])
      : await stemSetKey(audioFiles)
    const persisted = load(key)
    setSavedKey(key)
    setRestoredFromMemory(!!persisted)

    const initialState: Record<string, { volume: number; muted: boolean; solo: boolean }> = {}
    const uiStems: StemUI[] = stemList.map(s => {
      const p = persisted?.stems[s.name]
      const stem: StemUI = {
        name: s.name,
        buffer: s.buffer,
        muted: p?.muted ?? false,
        volume: p?.volume ?? 1,
        solo: p?.solo ?? false,
      }
      initialState[s.name] = { muted: stem.muted, volume: stem.volume, solo: stem.solo }
      return stem
    })

    engine.loadStems(stemList, initialState)
    engine.applySoloLogic(initialState)
    setStems(uiStems)
    setDuration(engine.totalDuration)

    // Beats: only auto-detect from longest stem, or restore
    const longest = stemList.reduce((a, b) => a.buffer.duration > b.buffer.duration ? a : b)
    const detectedBeats = persisted?.beats ?? detectBeats(longest.buffer)
    const detectedTempo = persisted?.tempo ?? estimateTempo(detectedBeats)
    setBeats(detectedBeats)
    setTempo(detectedTempo)

    // FX state
    if (persisted?.crusher) {
      setCrushOn(persisted.crusher.on)
      setBits(persisted.crusher.bits)
      setReduction(persisted.crusher.reduction)
      await engine.setCrusher(persisted.crusher.on, persisted.crusher.bits, persisted.crusher.reduction)
    } else {
      await engine.setCrusher(false, 8, 4)
      setCrushOn(false)
    }

    setPosition(0)
    setIsPlaying(false)
  }, [getEngine])

  const loadGeneratedStems = useCallback(async (stemList: Stem[], demoKey: string) => {
    const engine = getEngine()
    const persisted = load(demoKey)
    setSavedKey(demoKey)
    setRestoredFromMemory(!!persisted)

    const initialState: Record<string, { volume: number; muted: boolean; solo: boolean }> = {}
    const uiStems: StemUI[] = stemList.map(s => {
      const p = persisted?.stems[s.name]
      const stem: StemUI = {
        name: s.name,
        buffer: s.buffer,
        muted: p?.muted ?? false,
        volume: p?.volume ?? 1,
        solo: p?.solo ?? false,
      }
      initialState[s.name] = { muted: stem.muted, volume: stem.volume, solo: stem.solo }
      return stem
    })

    engine.loadStems(stemList, initialState)
    engine.applySoloLogic(initialState)
    setStems(uiStems)
    setDuration(engine.totalDuration)

    const longest = stemList.reduce((a, b) => a.buffer.duration > b.buffer.duration ? a : b)
    const detectedBeats = persisted?.beats ?? detectBeats(longest.buffer)
    const detectedTempo = persisted?.tempo ?? estimateTempo(detectedBeats)
    setBeats(detectedBeats)
    setTempo(detectedTempo)

    if (persisted?.crusher) {
      setCrushOn(persisted.crusher.on)
      setBits(persisted.crusher.bits)
      setReduction(persisted.crusher.reduction)
      await engine.setCrusher(persisted.crusher.on, persisted.crusher.bits, persisted.crusher.reduction)
    } else {
      await engine.setCrusher(false, 8, 4)
      setCrushOn(false)
    }

    setPosition(0)
    setIsPlaying(false)
  }, [getEngine])

  const loadDemoSet = useCallback(async () => {
    const stemList = await generateDemoStems()
    await loadGeneratedStems(stemList, 'demo-procedural-v1')
  }, [loadGeneratedStems])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setOver(false)
    loadFiles(Array.from(e.dataTransfer.files))
  }, [loadFiles])

  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    loadFiles(files)
  }, [loadFiles])

  // ── Transport ──

  const play = useCallback(async () => {
    const engine = getEngine()
    setIsPlaying(true)
    await engine.play(() => {
      setIsPlaying(false)
      setPosition(0)
    })
    const tick = () => {
      setPosition(engine.position())
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [getEngine])

  const pause = useCallback(() => {
    const engine = getEngine()
    engine.pause()
    cancelAnimationFrame(rafRef.current)
    setIsPlaying(false)
  }, [getEngine])

  const reset = useCallback(() => {
    const engine = getEngine()
    engine.reset()
    cancelAnimationFrame(rafRef.current)
    setPosition(0)
    setIsPlaying(false)
  }, [getEngine])

  // ── Stem mixer ──

  const setStemMuted = useCallback((name: string, muted: boolean) => {
    setStems(prev => {
      const next = prev.map(s => s.name === name ? { ...s, muted } : s)
      const engine = getEngine()
      const stateMap: Record<string, { volume: number; muted: boolean; solo: boolean }> = {}
      next.forEach(s => { stateMap[s.name] = { volume: s.volume, muted: s.muted, solo: s.solo } })
      engine.applySoloLogic(stateMap)
      return next
    })
  }, [getEngine])

  const setStemVolume = useCallback((name: string, volume: number) => {
    setStems(prev => {
      const next = prev.map(s => s.name === name ? { ...s, volume } : s)
      const engine = getEngine()
      const stateMap: Record<string, { volume: number; muted: boolean; solo: boolean }> = {}
      next.forEach(s => { stateMap[s.name] = { volume: s.volume, muted: s.muted, solo: s.solo } })
      engine.applySoloLogic(stateMap)
      return next
    })
  }, [getEngine])

  const toggleSolo = useCallback((name: string) => {
    setStems(prev => {
      const next = prev.map(s => s.name === name ? { ...s, solo: !s.solo } : s)
      const engine = getEngine()
      const stateMap: Record<string, { volume: number; muted: boolean; solo: boolean }> = {}
      next.forEach(s => { stateMap[s.name] = { volume: s.volume, muted: s.muted, solo: s.solo } })
      engine.applySoloLogic(stateMap)
      return next
    })
  }, [getEngine])

  // ── FX ──

  const toggleCrusher = useCallback(async (on: boolean) => {
    setCrushOn(on)
    await getEngine().setCrusher(on, bits, reduction)
  }, [bits, reduction, getEngine])

  useEffect(() => {
    if (crushOn) getEngine().updateCrusherParams(bits, reduction)
  }, [bits, reduction, crushOn, getEngine])

  // ── AI agent context (live snapshot of the session) ──
  // Note: precomputed RMS per stem is cached via basicMeta() once at load time.
  // Recomputing per render would be wasteful for the agent snapshot.

  const stemRms = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of stems) map.set(s.name, rmsDb(s.buffer))
    return map
  }, [stems])

  const agentCtxFactory = useCallback((): AgentContext | null => {
    const engine = engineRef.current
    if (!engine || stems.length === 0) return null
    return {
      engine,
      stems: stems.map(s => ({
        name: s.name,
        volume: s.volume,
        muted: s.muted,
        solo: s.solo,
        rmsDb: stemRms.get(s.name) ?? 0,
      })),
      setStems: (mutator) => setStems(prev => {
        const agentView = prev.map(s => ({
          name: s.name,
          volume: s.volume,
          muted: s.muted,
          solo: s.solo,
          rmsDb: stemRms.get(s.name) ?? 0,
        }))
        const mutated = mutator(agentView)
        return prev.map(stemUI => {
          const m = mutated.find(x => x.name === stemUI.name)
          if (!m) return stemUI
          return { ...stemUI, volume: m.volume, muted: m.muted, solo: m.solo }
        })
      }),
      tempo,
      beats,
      duration,
      crusher: { on: crushOn, bits, reduction },
      setCrusher: (next) => {
        setCrushOn(next.on)
        setBits(next.bits)
        setReduction(next.reduction)
      },
    }
  }, [stems, stemRms, tempo, beats, duration, crushOn, bits, reduction])

  // ── AI: auto-name stems ──

  const askForAutoName = useCallback(async () => {
    if (stems.length === 0) return
    setAiBusy('name')
    setAiError('')
    try {
      const features = stems.map(s => richFeatures(s.name, s.buffer))
      const inferences = await requestAutoName(features)
      // Tag each stem with its inferred type — engine keys stay original
      setStems(prev => prev.map(s => {
        const inf = inferences.find(i => i.original === s.name)
        if (!inf) return s
        return { ...s, inferredType: inf.inferredType, inferredConfidence: inf.confidence }
      }))
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'auto-name request failed')
    } finally {
      setAiBusy(null)
    }
  }, [stems])

  // ── Persistence: save on every meaningful change ──

  useEffect(() => {
    if (!savedKey || stems.length === 0) return
    const state: SessionState = {
      fileKey: savedKey,
      stems: Object.fromEntries(stems.map(s => [s.name, { muted: s.muted, volume: s.volume, solo: s.solo }])),
      crusher: { on: crushOn, bits, reduction },
      beats,
      tempo: tempo ?? undefined,
    }
    save(state)
  }, [savedKey, stems, crushOn, bits, reduction, beats, tempo])

  // ── MIDI export ──

  const exportMidi = useCallback(() => {
    if (beats.length === 0) return
    const blob = buildMidiFile(beats, { bpm: tempo ?? 120 })
    downloadBlob(blob, `beats-${tempo?.toFixed(0) ?? '120'}bpm.mid`)
  }, [beats, tempo])

  // ── Cleanup ──

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  if (stems.length === 0) {
    return (
      <div className="app">
        <h1>Stem Player · Browser Audio Demo</h1>
        <label
          className={'dropzone' + (over ? ' over' : '')}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          Drop audio files (one or many stems), or click to pick
          <br />
          <span className="hint">Tip: select all 12 stems from a Suno export</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={onPick}
            style={{ display: 'none' }}
          />
        </label>
        <div className="demo-cta">
          <button onClick={loadDemoSet}>Load procedural demo set (4 stems, 20s)</button>
          <span className="hint">Generates drums, bass, keys, lead via OfflineAudioContext — no download.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <h1>Stem Player · Browser Audio Demo</h1>

      {restoredFromMemory && (
        <div className="memory-badge">
          ✓ Restored mix and analysis from memory · key {savedKey.slice(0, 6)}…
        </div>
      )}

      <div className="meta">
        {stems.length} stem{stems.length !== 1 ? 's' : ''} · {duration.toFixed(2)}s
        {tempo !== null && <> · ~{tempo.toFixed(1)} BPM</>}
        · {beats.length} beats
        <button className="link" onClick={() => fileInputRef.current?.click()}>load other</button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          onChange={onPick}
          style={{ display: 'none' }}
        />
      </div>

      <div className="mixer">
        {stems.map(stem => (
          <StemRow
            key={stem.name}
            stem={stem}
            duration={duration}
            position={position}
            beats={beats}
            onMute={(m) => setStemMuted(stem.name, m)}
            onVolume={(v) => setStemVolume(stem.name, v)}
            onSolo={() => toggleSolo(stem.name)}
          />
        ))}
      </div>

      <div className="controls">
        {isPlaying
          ? <button onClick={pause}>Pause</button>
          : <button onClick={play}>Play</button>}
        <button onClick={reset}>Reset</button>
        <button onClick={exportMidi} disabled={beats.length === 0}>Export beats → MIDI</button>
        <span className="time">{position.toFixed(2)} / {duration.toFixed(2)} s</span>
      </div>

      <AgentChat ctxFactory={agentCtxFactory} />

      <div className="autoname-row">
        <button
          className="ai-btn secondary"
          onClick={askForAutoName}
          disabled={aiBusy !== null}
        >
          {aiBusy === 'name' ? 'Listening…' : 'Auto-identify stems'}
        </button>
        {aiError && <span className="ai-err">⚠ {aiError}</span>}
      </div>

      <div className="fx">
        <label>
          <input type="checkbox" checked={crushOn} onChange={e => toggleCrusher(e.target.checked)} />
          Bitcrusher (AudioWorklet, master bus)
        </label>
        <label>
          bits <input type="range" min={1} max={16} step={0.5} value={bits} onChange={e => setBits(+e.target.value)} disabled={!crushOn} />
          <span className="val">{bits.toFixed(1)}</span>
        </label>
        <label>
          reduction <input type="range" min={1} max={50} step={1} value={reduction} onChange={e => setReduction(+e.target.value)} disabled={!crushOn} />
          <span className="val">{reduction}</span>
        </label>
      </div>
    </div>
  )
}

// ── Per-stem row with mini-waveform ──

function StemRow({
  stem, duration, position, beats, onMute, onVolume, onSolo,
}: {
  stem: StemUI
  duration: number
  position: number
  beats: number[]
  onMute: (m: boolean) => void
  onVolume: (v: number) => void
  onSolo: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth * dpr
    const h = WAVE_HEIGHT * dpr
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#0e0e0e'
    ctx.fillRect(0, 0, w, h)

    const peaks = computePeaks(stem.buffer, Math.floor(canvas.clientWidth))
    ctx.fillStyle = stem.muted ? '#3a3a3a' : '#6B5B95'
    const mid = h / 2
    for (let x = 0; x < peaks.length; x++) {
      const peak = peaks[x] * (h / 2) * 0.95 * stem.volume
      ctx.fillRect(x * dpr, mid - peak, dpr, peak * 2)
    }
  }, [stem.buffer, stem.muted, stem.volume])

  const playheadPct = duration > 0 ? (position / duration) * 100 : 0

  return (
    <div className={'stem-row' + (stem.solo ? ' solo' : '') + (stem.muted ? ' muted' : '')}>
      <div className="stem-name">
        {stem.name}
        {stem.inferredType && (
          <span className="stem-inferred" title={`AI confidence: ${((stem.inferredConfidence ?? 0) * 100).toFixed(0)}%`}>
            {stem.inferredType}
          </span>
        )}
      </div>
      <div className="stem-canvas-wrap">
        <canvas ref={canvasRef} />
        <div className="playhead" style={{ left: `${playheadPct}%` }} />
        {beats.map((t, i) => (
          <div
            key={i}
            className="beat-mark"
            style={{ left: `${(t / duration) * 100}%` }}
          />
        ))}
      </div>
      <div className="stem-controls">
        <button className={'mini' + (stem.muted ? ' active' : '')} onClick={() => onMute(!stem.muted)}>M</button>
        <button className={'mini' + (stem.solo ? ' active' : '')} onClick={onSolo}>S</button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={stem.volume}
          onChange={e => onVolume(+e.target.value)}
        />
      </div>
    </div>
  )
}

// ── helpers ──

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

function computePeaks(buffer: AudioBuffer, width: number): number[] {
  const channel = buffer.getChannelData(0)
  const samplesPerPixel = Math.floor(channel.length / width)
  const peaks = new Array<number>(width).fill(0)
  for (let x = 0; x < width; x++) {
    let max = 0
    const start = x * samplesPerPixel
    const end = Math.min(start + samplesPerPixel, channel.length)
    for (let i = start; i < end; i++) {
      const v = Math.abs(channel[i])
      if (v > max) max = v
    }
    peaks[x] = max
  }
  return peaks
}
