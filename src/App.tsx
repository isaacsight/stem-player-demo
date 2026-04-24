import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AudioEngine, type Stem } from './audio'
import { detectBeats, estimateTempo } from './beats'
import { buildMidiFile, downloadBlob } from './midi'
import { fileKey, stemSetKey, load, save, type SessionState } from './persist'
import { generateDemoStems } from './demo-stems'
import { rmsDb, richFeatures } from './analysis'
import { requestAutoName } from './api-client'
// AgentChat (and react-markdown + remark-gfm) lazy-loaded — only fetched when
// stems are loaded. Cuts initial-page JS by ~50% gzip.
const AgentChat = lazy(() => import('./AgentChat'))
import type { AgentContext, Section } from './agent-tools'
import { Scheduler, type AutomationEvent } from './automation'
import { DEFAULT_FX, type StemFxState } from './audio'
import { renderMix, audioBufferToWav } from './render'

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
  const [agentTouched, setAgentTouched] = useState<Set<string>>(new Set())
  const [sections, setSections] = useState<Section[]>([])
  const [loop, setLoop] = useState<{ startSec: number; endSec: number } | null>(null)
  const [scheduledEvents, setScheduledEvents] = useState<AutomationEvent[]>([])
  const [stemFx, setStemFx] = useState<Record<string, StemFxState>>({})
  const schedulerRef = useRef<Scheduler>(new Scheduler())

  const flashStems = useCallback((names: string[]) => {
    setAgentTouched(prev => {
      const next = new Set(prev)
      names.forEach(n => next.add(n))
      return next
    })
    setTimeout(() => {
      setAgentTouched(prev => {
        const next = new Set(prev)
        names.forEach(n => next.delete(n))
        return next
      })
    }, 1200)
  }, [])

  const engineRef = useRef<AudioEngine | null>(null)
  const rafRef = useRef<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine()
      // Expose on window for live debugging during the interview / dev.
      // Safe to leave in production — no secrets, just the audio graph.
      ;(window as unknown as { __engine: AudioEngine }).__engine = engineRef.current
    }
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

  /**
   * Try to auto-load real stems from /demo-stems/manifest.json.
   * If the manifest exists and points to fetchable audio files, decode
   * them and load into the engine — bypassing the dropzone entirely.
   * If 404 / parse error / decode error, falls through to the normal
   * empty state. Never throws.
   */
  const tryAutoLoadFromPublic = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/demo-stems/manifest.json', { cache: 'no-cache' })
      if (!res.ok) return false
      const manifest = await res.json() as {
        title?: string
        stems?: Array<{ name: string; file: string }>
      }
      if (!Array.isArray(manifest.stems) || manifest.stems.length === 0) return false

      const engine = getEngine()
      const decoded: Stem[] = []
      for (const entry of manifest.stems) {
        const audioRes = await fetch(`/demo-stems/${entry.file}`)
        if (!audioRes.ok) {
          console.warn(`auto-load: missing ${entry.file}`)
          continue
        }
        const arrayBuffer = await audioRes.arrayBuffer()
        const buffer = await engine.decodeArrayBuffer(arrayBuffer)
        decoded.push({ name: entry.name, buffer })
      }
      if (decoded.length === 0) return false

      const key = `demo-public-${(manifest.stems.map(s => s.file).join('|'))}`
      await loadGeneratedStems(decoded, key)
      return true
    } catch (err) {
      console.warn('auto-load failed:', err)
      return false
    }
  }, [getEngine, loadGeneratedStems])

  // On mount, try auto-loading public demo stems
  useEffect(() => {
    let cancelled = false
    tryAutoLoadFromPublic().then(() => {
      if (cancelled) return
      // If false, the empty-state UI handles the user picking a file
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  /**
   * Apply an automation event to live state. Called by the scheduler tick
   * during playback whenever the playhead crosses an event time.
   */
  const applyAutomationEvent = useCallback((event: AutomationEvent) => {
    if (event.type === 'volume' || event.type === 'mute' || event.type === 'solo') {
      setStems(prev => {
        const next = prev.map(s => {
          if (s.name !== event.stem) return s
          if (event.type === 'volume') return { ...s, volume: event.value }
          if (event.type === 'mute') return { ...s, muted: event.value }
          if (event.type === 'solo') return { ...s, solo: event.value }
          return s
        })
        const engine = getEngine()
        const stateMap: Record<string, { volume: number; muted: boolean; solo: boolean }> = {}
        next.forEach(s => { stateMap[s.name] = { volume: s.volume, muted: s.muted, solo: s.solo } })
        engine.applySoloLogic(stateMap)
        return next
      })
      setAgentTouched(prev => {
        const next = new Set(prev)
        next.add(event.stem)
        return next
      })
      setTimeout(() => setAgentTouched(prev => {
        const next = new Set(prev)
        next.delete(event.stem)
        return next
      }), 1000)
    } else if (event.type === 'clear_solo') {
      setStems(prev => {
        const next = prev.map(s => ({ ...s, solo: false }))
        const engine = getEngine()
        const stateMap: Record<string, { volume: number; muted: boolean; solo: boolean }> = {}
        next.forEach(s => { stateMap[s.name] = { volume: s.volume, muted: s.muted, solo: s.solo } })
        engine.applySoloLogic(stateMap)
        return next
      })
    } else if (event.type === 'set_bitcrusher') {
      const enabled = event.enabled
      const newBits = event.bits ?? bits
      const newReduction = event.reduction ?? reduction
      setCrushOn(enabled)
      setBits(newBits)
      setReduction(newReduction)
      getEngine().setCrusher(enabled, newBits, newReduction)
    }
  }, [getEngine, bits, reduction])

  const play = useCallback(async () => {
    const engine = getEngine()
    setIsPlaying(true)
    schedulerRef.current.rewindTo(engine.position())
    await engine.play(() => {
      setIsPlaying(false)
      setPosition(0)
    })
    const tick = () => {
      const pos = engine.position()
      setPosition(pos)
      schedulerRef.current.tick(pos, applyAutomationEvent)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [getEngine, applyAutomationEvent])

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
    schedulerRef.current.rewindTo(0)
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
        fx: stemFx[s.name] ?? DEFAULT_FX,
      })),
      setStems: (mutator) => setStems(prev => {
        const agentView = prev.map(s => ({
          name: s.name,
          volume: s.volume,
          muted: s.muted,
          solo: s.solo,
          rmsDb: stemRms.get(s.name) ?? 0,
          fx: stemFx[s.name] ?? DEFAULT_FX,
        }))
        const mutated = mutator(agentView)
        const changed: string[] = []
        const next = prev.map(stemUI => {
          const m = mutated.find(x => x.name === stemUI.name)
          if (!m) return stemUI
          if (m.volume !== stemUI.volume || m.muted !== stemUI.muted || m.solo !== stemUI.solo) {
            changed.push(stemUI.name)
          }
          return { ...stemUI, volume: m.volume, muted: m.muted, solo: m.solo }
        })
        if (changed.length) flashStems(changed)
        return next
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
      setStemFx: (name, mutator) => setStemFx(prev => ({
        ...prev,
        [name]: mutator(prev[name] ?? DEFAULT_FX),
      })),
      scheduler: schedulerRef.current,
      onScheduleChanged: (events) => setScheduledEvents(events),
      setLoop: (range) => {
        setLoop(range)
        engine.setLoopRegion(range)
      },
      loop,
      sections,
      setSections: (mutator) => setSections(prev => mutator(prev)),
      rewindTransport: () => {
        engine.rewind()
        cancelAnimationFrame(rafRef.current)
        setPosition(0)
        setIsPlaying(false)
        schedulerRef.current.rewindTo(0)
      },
    }
  }, [stems, stemRms, tempo, beats, duration, crushOn, bits, reduction, loop, sections, stemFx])

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

  // ── Render mix to WAV (offline rendering) ──

  const [rendering, setRendering] = useState(false)

  const exportMixWav = useCallback(async () => {
    if (stems.length === 0) return
    setRendering(true)
    try {
      const stemList = stems.map(s => ({ name: s.name, buffer: s.buffer }))
      const mix: Record<string, { volume: number; muted: boolean; solo: boolean }> = {}
      stems.forEach(s => { mix[s.name] = { volume: s.volume, muted: s.muted, solo: s.solo } })
      const buffer = await renderMix({
        stems: stemList,
        mix,
        fx: stemFx,
        events: scheduledEvents,
        crusher: { on: crushOn, bits, reduction },
      })
      const blob = audioBufferToWav(buffer)
      const fname = `mix-${tempo ? `${tempo.toFixed(0)}bpm-` : ''}${Date.now()}.wav`
      downloadBlob(blob, fname)
    } catch (err) {
      console.error('render failed', err)
    } finally {
      setRendering(false)
    }
  }, [stems, stemFx, scheduledEvents, crushOn, bits, reduction, tempo])

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

      {(sections.length > 0 || scheduledEvents.length > 0 || loop) && (
        <div className="arrangement-strip">
          {sections.length > 0 && (
            <div className="sections-row">
              {sections.map((s, i) => (
                <div
                  key={i}
                  className="section-marker"
                  style={{
                    left: `${(s.startSec / duration) * 100}%`,
                    width: `${((s.endSec - s.startSec) / duration) * 100}%`,
                  }}
                >
                  {s.name}
                </div>
              ))}
            </div>
          )}
          <div className="arrangement-meta">
            {scheduledEvents.length > 0 && <span>📋 {scheduledEvents.length} arrangement events</span>}
            {loop && <span>🔁 loop {loop.startSec.toFixed(1)}s–{loop.endSec.toFixed(1)}s</span>}
          </div>
        </div>
      )}

      <div className="mixer">
        {stems.map(stem => (
          <StemRow
            key={stem.name}
            stem={stem}
            duration={duration}
            position={position}
            beats={beats}
            flashed={agentTouched.has(stem.name)}
            stemEvents={scheduledEvents.filter(e =>
              (e.type === 'volume' || e.type === 'mute' || e.type === 'solo') && e.stem === stem.name
            )}
            loop={loop}
            fx={stemFx[stem.name] ?? DEFAULT_FX}
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
        <button onClick={exportMidi} disabled={beats.length === 0}>Beats → MIDI</button>
        <button onClick={exportMixWav} disabled={rendering}>
          {rendering ? 'Rendering…' : 'Render mix → WAV'}
        </button>
        <span className="time">{position.toFixed(2)} / {duration.toFixed(2)} s</span>
      </div>

      <Suspense fallback={<div className="agent-panel" style={{ minHeight: 80, padding: 14, color: 'var(--muted)', fontSize: 11 }}>Loading mixing engineer…</div>}>
        <AgentChat
          ctxFactory={agentCtxFactory}
          onArrangementCompleted={() => {
            reset()
            // Slight delay to ensure reset state has flushed before play
            setTimeout(() => play(), 100)
          }}
        />
      </Suspense>

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
  stem, duration, position, beats, flashed, stemEvents, loop, fx, onMute, onVolume, onSolo,
}: {
  stem: StemUI
  duration: number
  position: number
  beats: number[]
  flashed: boolean
  stemEvents: AutomationEvent[]
  loop: { startSec: number; endSec: number } | null
  fx: StemFxState
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
    <div className={'stem-row' + (stem.solo ? ' solo' : '') + (stem.muted ? ' muted' : '') + (flashed ? ' flashed' : '')}>
      <div className="stem-name">
        {stem.name}
        {stem.inferredType && (
          <span className="stem-inferred" title={`AI confidence: ${((stem.inferredConfidence ?? 0) * 100).toFixed(0)}%`}>
            {stem.inferredType}
          </span>
        )}
        <span className="stem-fx-badges">
          {fx.filterType !== 'off' && (
            <span className="fx-badge" title={`${fx.filterType} @ ${fx.filterFreq.toFixed(0)}Hz`}>
              {fx.filterType === 'lowpass' ? 'LP' : fx.filterType === 'highpass' ? 'HP' : 'BP'}
            </span>
          )}
          {fx.pan !== 0 && (
            <span className="fx-badge" title={`pan ${fx.pan.toFixed(2)}`}>
              {fx.pan < 0 ? `L${Math.round(-fx.pan * 100)}` : `R${Math.round(fx.pan * 100)}`}
            </span>
          )}
          {fx.reverbSend > 0 && (
            <span className="fx-badge" title={`reverb send ${(fx.reverbSend * 100).toFixed(0)}%`}>
              REV {Math.round(fx.reverbSend * 100)}
            </span>
          )}
        </span>
      </div>
      <div className="stem-canvas-wrap">
        <canvas ref={canvasRef} />
        {loop && (
          <div
            className="loop-region"
            style={{
              left: `${(loop.startSec / duration) * 100}%`,
              width: `${((loop.endSec - loop.startSec) / duration) * 100}%`,
            }}
          />
        )}
        <div className="playhead" style={{ left: `${playheadPct}%` }} />
        {beats.map((t, i) => (
          <div
            key={i}
            className="beat-mark"
            style={{ left: `${(t / duration) * 100}%` }}
          />
        ))}
        {/* Group events by atSec so overlapping dots stack vertically instead of occluding */}
        {(() => {
          const grouped = new Map<number, AutomationEvent[]>()
          stemEvents.forEach(e => {
            const arr = grouped.get(e.atSec) ?? []
            arr.push(e)
            grouped.set(e.atSec, arr)
          })
          const out: React.ReactElement[] = []
          for (const [atSec, evts] of grouped) {
            evts.forEach((e, idx) => {
              out.push(
                <div
                  key={`${atSec}-${idx}-${e.type}`}
                  className={`auto-event auto-${e.type}`}
                  style={{
                    left: `${(atSec / duration) * 100}%`,
                    top: `calc(50% + ${(idx - (evts.length - 1) / 2) * 6}px)`,
                  }}
                  title={`${e.type} @ ${atSec.toFixed(2)}s${'value' in e ? ` → ${e.value}` : ''}`}
                />,
              )
            })
          }
          return out
        })()}
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
