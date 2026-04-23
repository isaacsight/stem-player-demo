/**
 * Render the current session — stems + mix state + per-stem FX +
 * automation events + master bitcrusher — to a single mixed WAV file
 * via OfflineAudioContext.
 *
 * The offline graph mirrors the live engine: per-stem
 *   source → filter → panner → gain → master
 *                           └ reverbSend → reverb → master
 *   master → [crusher worklet?] → destination
 *
 * Static mix is set at t=0. Automation events become AudioParam
 * setValueAtTime() calls at their target times — the offline renderer
 * fires them deterministically.
 */

import type { Stem, StemFxState } from './audio'
import { DEFAULT_FX } from './audio'
import type { AutomationEvent } from './automation'

export type RenderInput = {
  stems: Stem[]
  mix: Record<string, { volume: number; muted: boolean; solo: boolean }>
  fx: Record<string, StemFxState>
  events: AutomationEvent[]
  crusher: { on: boolean; bits: number; reduction: number }
}

export async function renderMix(input: RenderInput): Promise<AudioBuffer> {
  const { stems, mix, fx, events, crusher } = input
  const duration = stems.reduce((max, s) => Math.max(max, s.buffer.duration), 0)
  if (duration <= 0) throw new Error('no audio to render')

  const sampleRate = stems[0]?.buffer.sampleRate ?? 44100
  const offCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * duration), sampleRate)

  // Master bus
  const master = offCtx.createGain()
  master.gain.value = 1.0
  // Reverb (synthesized IR)
  const reverb = offCtx.createConvolver()
  reverb.buffer = synthesizeImpulseResponse(offCtx, 2.5, 2.0)
  const reverbReturn = offCtx.createGain()
  reverbReturn.gain.value = 0.6
  reverb.connect(reverbReturn).connect(master)

  // Master crusher (optional)
  let masterOut: AudioNode = master
  if (crusher.on) {
    try {
      await offCtx.audioWorklet.addModule('/bitcrusher-processor.js')
      const cr = new AudioWorkletNode(offCtx, 'bitcrusher')
      cr.parameters.get('bits')!.value = crusher.bits
      cr.parameters.get('reduction')!.value = crusher.reduction
      master.connect(cr).connect(offCtx.destination)
      masterOut = cr
    } catch {
      master.connect(offCtx.destination) // fallback if worklet unavailable
    }
  } else {
    master.connect(offCtx.destination)
  }
  void masterOut // (referenced for clarity; could be used by future routing)

  // Per-stem chain + initial mix + automation
  const anySolo = Object.values(mix).some(m => m.solo)
  const stemNodeMap = new Map<string, GainNode>()

  for (const stem of stems) {
    const m = mix[stem.name] ?? { volume: 1, muted: false, solo: false }
    const f = fx[stem.name] ?? DEFAULT_FX

    const filter = offCtx.createBiquadFilter()
    if (f.filterType === 'off') {
      filter.type = 'allpass'
    } else {
      filter.type = f.filterType
      filter.frequency.value = f.filterFreq
      filter.Q.value = f.filterQ
    }
    const panner = offCtx.createStereoPanner()
    panner.pan.value = f.pan
    const gain = offCtx.createGain()
    // Initial volume respects current mute/solo
    const initialGain = anySolo
      ? (m.solo ? m.volume : 0)
      : (m.muted ? 0 : m.volume)
    gain.gain.value = initialGain
    const send = offCtx.createGain()
    send.gain.value = f.reverbSend

    const src = offCtx.createBufferSource()
    src.buffer = stem.buffer

    src.connect(filter)
    filter.connect(panner)
    panner.connect(gain)
    panner.connect(send)
    send.connect(reverb)
    gain.connect(master)

    src.start(0)
    stemNodeMap.set(stem.name, gain)
  }

  // Schedule automation
  // We approximate solo behavior in the offline render by tracking
  // soloed names over time and adjusting non-soloed stems' gain to 0
  // at each transition.
  const soloed = new Set<string>(Object.entries(mix).filter(([, v]) => v.solo).map(([k]) => k))
  const muted = new Set<string>(Object.entries(mix).filter(([, v]) => v.muted).map(([k]) => k))
  const volumes = new Map<string, number>(Object.entries(mix).map(([k, v]) => [k, v.volume]))

  const sortedEvents = [...events].sort((a, b) => a.atSec - b.atSec)
  for (const e of sortedEvents) {
    const t = Math.max(0, e.atSec)
    if (e.type === 'volume') {
      volumes.set(e.stem, e.value)
      const node = stemNodeMap.get(e.stem)
      if (node && !muted.has(e.stem) && (soloed.size === 0 || soloed.has(e.stem))) {
        node.gain.setValueAtTime(e.value, t)
      }
    } else if (e.type === 'mute') {
      if (e.value) muted.add(e.stem); else muted.delete(e.stem)
      applyAllAtTime(stemNodeMap, volumes, muted, soloed, t)
    } else if (e.type === 'solo') {
      if (e.value) soloed.add(e.stem); else soloed.delete(e.stem)
      applyAllAtTime(stemNodeMap, volumes, muted, soloed, t)
    } else if (e.type === 'clear_solo') {
      soloed.clear()
      applyAllAtTime(stemNodeMap, volumes, muted, soloed, t)
    }
    // set_bitcrusher events not modeled offline — would require teardown/re-route
  }

  return offCtx.startRendering()
}

function applyAllAtTime(
  nodes: Map<string, GainNode>,
  volumes: Map<string, number>,
  muted: Set<string>,
  soloed: Set<string>,
  t: number,
) {
  const anySolo = soloed.size > 0
  for (const [name, node] of nodes) {
    let g = volumes.get(name) ?? 1
    if (anySolo) g = soloed.has(name) ? g : 0
    if (muted.has(name) && !anySolo) g = 0
    node.gain.setValueAtTime(g, t)
  }
}

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
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
  }
  return ir
}

// ── WAV encoder (PCM 16-bit) ──

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length
  const bytesPerSample = 2 // 16-bit
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = length * blockAlign
  const fileSize = 44 + dataSize

  const arrayBuffer = new ArrayBuffer(fileSize)
  const view = new DataView(arrayBuffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, fileSize - 8, true)
  writeString(view, 8, 'WAVE')
  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)        // chunk size
  view.setUint16(20, 1, true)         // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true)
  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Interleaved PCM samples
  const channels: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch))

  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let s = Math.max(-1, Math.min(1, channels[ch][i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}
