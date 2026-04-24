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
  filter: BiquadFilterNode
  panner: StereoPannerNode
  reverbSend: GainNode
  source: AudioBufferSourceNode | null
}

export type StemFxState = {
  filterType: 'off' | 'lowpass' | 'highpass' | 'bandpass'
  filterFreq: number   // Hz
  filterQ: number
  pan: number          // -1 (L) … 1 (R)
  reverbSend: number   // 0 … 1
}

export const DEFAULT_FX: StemFxState = {
  filterType: 'off',
  filterFreq: 1000,
  filterQ: 1,
  pan: 0,
  reverbSend: 0,
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
  private reverb: ConvolverNode
  private reverbReturn: GainNode
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
    // Synthetic IR reverb on its own bus, summed back into master
    this.reverb = this.ctx.createConvolver()
    this.reverb.buffer = synthesizeImpulseResponse(this.ctx, 2.5, 2.0)
    this.reverbReturn = this.ctx.createGain()
    this.reverbReturn.gain.value = 0.6
    this.reverb.connect(this.reverbReturn).connect(this.master)
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

  /** Decode raw audio bytes (e.g., from fetch). */
  async decodeArrayBuffer(ab: ArrayBuffer): Promise<AudioBuffer> {
    return this.ctx.decodeAudioData(ab)
  }

  /** Replace all stems. Stops playback. */
  loadStems(stems: Stem[], initialState?: Record<string, { volume: number; muted: boolean; solo: boolean }>) {
    this.stop()
    this.bufferMap.clear()
    this.stems = stems.map(s => {
      this.bufferMap.set(s.name, s.buffer)
      // Per-stem chain: source → filter → panner → gain → master
      //                                    └ reverbSend → reverb (shared)
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'allpass' // off — pass-through
      filter.frequency.value = 1000
      filter.Q.value = 1
      const panner = this.ctx.createStereoPanner()
      panner.pan.value = 0
      const gain = this.ctx.createGain()
      const init = initialState?.[s.name]
      const vol = init?.volume ?? 1
      const muted = init?.muted ?? false
      gain.gain.value = muted ? 0 : vol
      const reverbSend = this.ctx.createGain()
      reverbSend.gain.value = 0
      filter.connect(panner)
      panner.connect(gain)
      panner.connect(reverbSend)
      reverbSend.connect(this.reverb)
      gain.connect(this.master)
      return { name: s.name, gainNode: gain, filter, panner, reverbSend, source: null }
    })
    this.duration = stems.reduce((max, s) => Math.max(max, s.buffer.duration), 0)
    this.startOffset = 0
    this.applySoloLogic(initialState)
  }

  // ── Per-stem FX ──

  setStemFilter(name: string, type: StemFxState['filterType'], freq: number, q: number): boolean {
    const stem = this.stems.find(s => s.name === name)
    if (!stem) return false
    if (type === 'off') {
      stem.filter.type = 'allpass'
    } else {
      stem.filter.type = type
      stem.filter.frequency.value = freq
      stem.filter.Q.value = q
    }
    return true
  }

  setStemPan(name: string, pan: number): boolean {
    const stem = this.stems.find(s => s.name === name)
    if (!stem) return false
    stem.panner.pan.value = Math.max(-1, Math.min(1, pan))
    return true
  }

  setStemReverbSend(name: string, amount: number): boolean {
    const stem = this.stems.find(s => s.name === name)
    if (!stem) return false
    stem.reverbSend.gain.value = Math.max(0, Math.min(1, amount))
    return true
  }

  clearStemFx(name: string): boolean {
    return (
      this.setStemFilter(name, 'off', 1000, 1) &&
      this.setStemPan(name, 0) &&
      this.setStemReverbSend(name, 0)
    )
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

  /** Loop region (sec). When set, sources play with loopStart/loopEnd. */
  private loopRegion: { startSec: number; endSec: number } | null = null
  setLoopRegion(range: { startSec: number; endSec: number } | null) {
    this.loopRegion = range
    // If currently playing, restart sources to honor the new loop bounds
    if (this.playing) {
      const onEnded = this.lastOnEnded
      this.stop()
      this.play(onEnded)
    }
  }
  getLoopRegion() { return this.loopRegion }

  private lastOnEnded?: () => void

  async play(onEnded?: () => void) {
    if (this.playing || this.stems.length === 0) return
    await this.workletReady // safe even if crusher unused
    this.lastOnEnded = onEnded
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

    const loop = this.loopRegion
    // Find the matching original buffer — keep a parallel array
    for (let i = 0; i < this.stems.length; i++) {
      const runtime = this.stems[i]
      const buffer = this.bufferFor(runtime.name)
      if (!buffer) continue
      const src = this.ctx.createBufferSource()
      src.buffer = buffer
      // Source goes through the per-stem FX chain: filter → panner → gain
      src.connect(runtime.filter)
      if (loop) {
        src.loop = true
        src.loopStart = loop.startSec
        src.loopEnd = loop.endSec
        // Start at loop.startSec if current offset is outside the region
        const offset = (this.startOffset >= loop.startSec && this.startOffset < loop.endSec)
          ? this.startOffset
          : loop.startSec
        if (offset !== this.startOffset) this.startOffset = offset
        src.start(startAt, offset)
      } else {
        src.start(startAt, this.startOffset)
      }
      src.onended = fireOnce
      runtime.source = src
    }
  }

  /** Reset transport to 0. */
  rewind() {
    this.stop()
    this.startOffset = 0
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

/**
 * Synthesize a stereo exponential-decay impulse response for a ConvolverNode.
 * Cheap, sounds plausible — not a real recorded space, but fine for demos
 * and dramatically lighter than shipping a real IR file.
 */
function synthesizeImpulseResponse(
  ctx: BaseAudioContext,
  durationSec: number,
  decay: number,
): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const length = Math.floor(sampleRate * durationSec)
  const ir = ctx.createBuffer(2, length, sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      // Decaying noise burst — Math.pow controls tail shape
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
  }
  return ir
}
