/**
 * Procedurally generated demo stems.
 *
 * Renders 4 musical stems via OfflineAudioContext so the app can demo itself
 * without requiring real audio content. Each stem is built from scheduled
 * oscillators + envelopes — no samples, no network, no setup.
 *
 * Layout: 8 bars at 96 BPM in C minor.
 *   beats per bar: 4
 *   beat duration: 60 / 96 = 0.625 s
 *   bar duration:  2.5 s
 *   total:         20 s
 *
 *   stem 1 — drums  (kick on 1 & 3, hat on every 8th)
 *   stem 2 — bass   (root notes following Cm · Ab · F · Bb · ...)
 *   stem 3 — keys   (sustained chord pad)
 *   stem 4 — lead   (sparse melodic motif)
 */

import type { Stem } from './audio'

const BPM = 96
const BEAT = 60 / BPM
const BAR = BEAT * 4
const BARS = 8
const DURATION = BAR * BARS
const SR = 44100

// Cm · Ab · F · Bb · Cm · Ab · Fm · G7  (root semitones from A4=440)
const ROOTS_SEMI = [-9, -13, -16, -11, -9, -13, -4, -2] // 8 bars, one chord per bar
// Triads (semitone offsets from root)
const MINOR_TRIAD = [0, 3, 7]
const MAJOR_TRIAD = [0, 4, 7]
const DOM7         = [0, 4, 7, 10]
const QUALITIES = [MINOR_TRIAD, MAJOR_TRIAD, MAJOR_TRIAD, MAJOR_TRIAD, MINOR_TRIAD, MAJOR_TRIAD, MINOR_TRIAD, DOM7]

const semiToHz = (semi: number) => 440 * Math.pow(2, semi / 12)

export async function generateDemoStems(): Promise<Stem[]> {
  const [drums, bass, keys, lead] = await Promise.all([
    renderStem('drums', drumsRender),
    renderStem('bass', bassRender),
    renderStem('keys', keysRender),
    renderStem('lead', leadRender),
  ])
  return [drums, bass, keys, lead]
}

async function renderStem(name: string, fn: (ctx: OfflineAudioContext) => void): Promise<Stem> {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * DURATION), SR)
  fn(ctx)
  const buffer = await ctx.startRendering()
  return { name, buffer }
}

// ─── Drums ───
function drumsRender(ctx: OfflineAudioContext) {
  const out = ctx.createGain()
  out.gain.value = 0.9
  out.connect(ctx.destination)

  for (let bar = 0; bar < BARS; bar++) {
    const t0 = bar * BAR
    // Kick on beats 1 and 3
    kick(ctx, out, t0 + 0 * BEAT)
    kick(ctx, out, t0 + 2 * BEAT)
    // Snare on beats 2 and 4
    snare(ctx, out, t0 + 1 * BEAT)
    snare(ctx, out, t0 + 3 * BEAT)
    // Hi-hat every 8th note
    for (let i = 0; i < 8; i++) hat(ctx, out, t0 + i * (BEAT / 2), i % 2 === 1 ? 0.4 : 0.6)
  }
}

function kick(ctx: BaseAudioContext, dest: AudioNode, t: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.setValueAtTime(120, t)
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.12)
  gain.gain.setValueAtTime(0.0, t)
  gain.gain.linearRampToValueAtTime(1.0, t + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
  osc.connect(gain).connect(dest)
  osc.start(t); osc.stop(t + 0.4)
}

function snare(ctx: BaseAudioContext, dest: AudioNode, t: number) {
  // Tonal layer
  const osc = ctx.createOscillator()
  const oscGain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(220, t)
  oscGain.gain.setValueAtTime(0.4, t)
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  osc.connect(oscGain).connect(dest)
  osc.start(t); osc.stop(t + 0.15)
  // Noise layer
  const noise = noiseSource(ctx, 0.18)
  const filt = ctx.createBiquadFilter()
  filt.type = 'highpass'; filt.frequency.value = 1500
  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.6, t)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
  noise.connect(filt).connect(noiseGain).connect(dest)
  noise.start(t); noise.stop(t + 0.2)
}

function hat(ctx: BaseAudioContext, dest: AudioNode, t: number, vel = 0.5) {
  const noise = noiseSource(ctx, 0.05)
  const filt = ctx.createBiquadFilter()
  filt.type = 'highpass'; filt.frequency.value = 7000
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.3 * vel, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
  noise.connect(filt).connect(gain).connect(dest)
  noise.start(t); noise.stop(t + 0.06)
}

function noiseSource(ctx: BaseAudioContext, seconds: number): AudioBufferSourceNode {
  const buf = ctx.createBuffer(1, Math.ceil(SR * seconds), SR)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  return src
}

// ─── Bass ───
function bassRender(ctx: OfflineAudioContext) {
  const out = ctx.createGain()
  out.gain.value = 0.55
  out.connect(ctx.destination)

  for (let bar = 0; bar < BARS; bar++) {
    const root = ROOTS_SEMI[bar] - 24 // two octaves down
    const t0 = bar * BAR
    // Walking pattern: root on 1, fifth on 2.5, root on 3, octave on 4
    bassNote(ctx, out, t0 + 0 * BEAT, root, BEAT * 0.9)
    bassNote(ctx, out, t0 + 1.5 * BEAT, root + 7, BEAT * 0.4)
    bassNote(ctx, out, t0 + 2 * BEAT, root, BEAT * 0.9)
    bassNote(ctx, out, t0 + 3 * BEAT, root + 12, BEAT * 0.9)
  }
}

function bassNote(ctx: BaseAudioContext, dest: AudioNode, t: number, semi: number, dur: number) {
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(semiToHz(semi), t)
  const filt = ctx.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.setValueAtTime(800, t)
  filt.frequency.exponentialRampToValueAtTime(200, t + dur)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.7, t + 0.01)
  gain.gain.setValueAtTime(0.7, t + dur * 0.7)
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(filt).connect(gain).connect(dest)
  osc.start(t); osc.stop(t + dur + 0.05)
}

// ─── Keys (chord pad) ───
function keysRender(ctx: OfflineAudioContext) {
  const out = ctx.createGain()
  out.gain.value = 0.18
  // Add some softness with a lowpass on the master
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.value = 3500
  out.connect(lp).connect(ctx.destination)

  for (let bar = 0; bar < BARS; bar++) {
    const root = ROOTS_SEMI[bar] - 12 // one octave down
    const triad = QUALITIES[bar]
    const t0 = bar * BAR
    for (const interval of triad) {
      pad(ctx, out, t0, root + interval, BAR * 0.95)
    }
  }
}

function pad(ctx: BaseAudioContext, dest: AudioNode, t: number, semi: number, dur: number) {
  // Two oscillators slightly detuned for warmth
  const oscs: OscillatorNode[] = []
  const detunes = [-7, +7]
  for (const detune of detunes) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = semiToHz(semi)
    o.detune.value = detune
    oscs.push(o)
  }
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.3, t + 0.4)
  gain.gain.linearRampToValueAtTime(0.25, t + dur - 0.4)
  gain.gain.linearRampToValueAtTime(0.0, t + dur)
  for (const o of oscs) {
    o.connect(gain)
    o.start(t); o.stop(t + dur + 0.05)
  }
  gain.connect(dest)
}

// ─── Lead (sparse motif) ───
function leadRender(ctx: OfflineAudioContext) {
  const out = ctx.createGain()
  out.gain.value = 0.4
  out.connect(ctx.destination)

  // Motif degrees relative to chord root (in semitones)
  const motifs = [
    [12, 15, 12, 19], // bar pattern A
    [10, 12, 10, 15], // bar pattern B
  ]
  for (let bar = 0; bar < BARS; bar++) {
    const root = ROOTS_SEMI[bar]
    const motif = motifs[bar % 2]
    const t0 = bar * BAR
    for (let i = 0; i < motif.length; i++) {
      leadNote(ctx, out, t0 + i * BEAT, root + motif[i], BEAT * 0.8)
    }
  }
}

function leadNote(ctx: BaseAudioContext, dest: AudioNode, t: number, semi: number, dur: number) {
  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.value = semiToHz(semi)
  const filt = ctx.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.setValueAtTime(2000, t)
  filt.frequency.exponentialRampToValueAtTime(800, t + dur)
  filt.Q.value = 4
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.5, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(filt).connect(gain).connect(dest)
  osc.start(t); osc.stop(t + dur + 0.05)
}
