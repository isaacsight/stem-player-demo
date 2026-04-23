/**
 * Stem-aware audio engine.
 *
 * Plays N stems in sample-perfect sync by starting every BufferSource in the
 * same audio-clock tick (`ctx.currentTime + LOOKAHEAD`). Each stem has its
 * own gain node so mute/volume/solo are O(1) at runtime. An optional
 * shared bitcrusher AudioWorklet sits on the master bus.
 *
 *   stem[i].source ─► stem[i].gain ─┐
 *                                    ├─► masterGain ─► [crusher?] ─► destination
 *                                    │
 *                                   ...
 */

const START_LOOKAHEAD = 0.05 // 50 ms — masks any per-source scheduling jitter

export type Stem = {
  name: string
  buffer: AudioBuffer
}

export type StemRuntime = {
  name: string
  gainNode: GainNode
  source: AudioBufferSourceNode | null
}

export type EngineState = {
  stems: StemRuntime[]
  duration: number
  isPlaying: boolean
  positionAt: () => number // current playhead in seconds
}

export class AudioEngine {
  private ctx: AudioContext
  private master: GainNode
  private crusher: AudioWorkletNode | null = null
  private workletReady: Promise<void>
  private stems: StemRuntime[] = []
  private duration = 0
  private startedAt = 0
  private startOffset = 0
  private playing = false

  constructor() {
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.master.connect(this.ctx.destination)
    this.workletReady = this.ctx.audioWorklet.addModule('/bitcrusher-processor.js')
  }

  get sampleRate() { return this.ctx.sampleRate }
  get currentTime() { return this.ctx.currentTime }
  get isPlaying() { return this.playing }
  get totalDuration() { return this.duration }
  get stemRuntimes() { return this.stems }

  async decode(file: File): Promise<AudioBuffer> {
    const ab = await file.arrayBuffer()
    return this.ctx.decodeAudioData(ab)
  }

  /** Replace all stems. Stops playback. */
  loadStems(stems: Stem[], initialState?: Record<string, { volume: number; muted: boolean; solo: boolean }>) {
    this.stop()
    this.bufferMap.clear()
    this.stems = stems.map(s => {
      this.bufferMap.set(s.name, s.buffer)
      const gain = this.ctx.createGain()
      const init = initialState?.[s.name]
      const vol = init?.volume ?? 1
      const muted = init?.muted ?? false
      gain.gain.value = muted ? 0 : vol
      gain.connect(this.master)
      return { name: s.name, gainNode: gain, source: null }
    })
    this.duration = stems.reduce((max, s) => Math.max(max, s.buffer.duration), 0)
    this.startOffset = 0
    this.applySoloLogic(initialState)
  }

  /** Mute/unmute via gain — preserves the underlying volume. */
  setMuted(name: string, muted: boolean, volume: number) {
    const stem = this.stems.find(s => s.name === name)
    if (!stem) return
    stem.gainNode.gain.value = muted ? 0 : volume
  }

  setVolume(name: string, volume: number, muted: boolean) {
    const stem = this.stems.find(s => s.name === name)
    if (!stem) return
    if (!muted) stem.gainNode.gain.value = volume
  }

  /** Solo handling: if any stem is soloed, only those play (regardless of mute). */
  applySoloLogic(state?: Record<string, { volume: number; muted: boolean; solo: boolean }>) {
    if (!state) return
    const anySolo = Object.values(state).some(s => s.solo)
    for (const stem of this.stems) {
      const s = state[stem.name]
      if (!s) continue
      if (anySolo) {
        stem.gainNode.gain.value = s.solo ? s.volume : 0
      } else {
        stem.gainNode.gain.value = s.muted ? 0 : s.volume
      }
    }
  }

  setMasterGain(value: number) { this.master.gain.value = value }

  async setCrusher(enabled: boolean, bits: number, reduction: number) {
    await this.workletReady

    // Tear down current crusher routing
    if (this.crusher) {
      this.master.disconnect()
      this.crusher.disconnect()
      this.crusher = null
      this.master.connect(this.ctx.destination)
    }

    if (enabled) {
      const node = new AudioWorkletNode(this.ctx, 'bitcrusher')
      node.parameters.get('bits')!.value = bits
      node.parameters.get('reduction')!.value = reduction
      this.master.disconnect()
      this.master.connect(node)
      node.connect(this.ctx.destination)
      this.crusher = node
    }
  }

  updateCrusherParams(bits: number, reduction: number) {
    if (!this.crusher) return
    this.crusher.parameters.get('bits')!.value = bits
    this.crusher.parameters.get('reduction')!.value = reduction
  }

  async play(onEnded?: () => void) {
    if (this.playing || this.stems.length === 0) return
    await this.workletReady // safe even if crusher unused
    const startAt = this.ctx.currentTime + START_LOOKAHEAD
    this.startedAt = startAt
    this.playing = true

    let endedFired = false
    const fireOnce = () => {
      if (endedFired) return
      endedFired = true
      this.startOffset = 0
      this.playing = false
      onEnded?.()
    }

    // Find the matching original buffer — keep a parallel array
    for (let i = 0; i < this.stems.length; i++) {
      const runtime = this.stems[i]
      const buffer = this.bufferFor(runtime.name)
      if (!buffer) continue
      const src = this.ctx.createBufferSource()
      src.buffer = buffer
      src.connect(runtime.gainNode)
      src.start(startAt, this.startOffset)
      src.onended = fireOnce
      runtime.source = src
    }
  }

  pause() {
    if (!this.playing) return
    const elapsed = this.ctx.currentTime - this.startedAt
    this.startOffset = Math.min(this.startOffset + elapsed, this.duration)
    this.stop()
  }

  stop() {
    for (const stem of this.stems) {
      if (stem.source) {
        try { stem.source.stop() } catch { /* already stopped */ }
        stem.source.disconnect()
        stem.source = null
      }
    }
    this.playing = false
  }

  reset() {
    this.stop()
    this.startOffset = 0
  }

  position(): number {
    if (!this.playing) return this.startOffset
    const elapsed = this.ctx.currentTime - this.startedAt
    return Math.min(this.startOffset + elapsed, this.duration)
  }

  // ─── private ───
  private bufferMap = new Map<string, AudioBuffer>()
  private bufferFor(name: string): AudioBuffer | undefined {
    return this.bufferMap.get(name)
  }
}
