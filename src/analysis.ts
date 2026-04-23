/**
 * Per-stem acoustic feature extraction.
 *
 * Computed in JS on the main thread (cheap on a few-second buffer).
 * Used to give the AI endpoints something useful to reason about
 * without uploading the audio itself.
 */

export type StemMeta = {
  name: string
  durationSec: number
  rmsDb: number
}

export type StemFeatures = StemMeta & {
  spectralCentroidHz: number
  peakCount: number
  zeroCrossingRate: number
}

/** Quick RMS in decibels (full-scale). */
export function rmsDb(buffer: AudioBuffer): number {
  const ch = buffer.getChannelData(0)
  let sumSq = 0
  for (let i = 0; i < ch.length; i++) sumSq += ch[i] ** 2
  const rms = Math.sqrt(sumSq / ch.length)
  return 20 * Math.log10(Math.max(rms, 1e-9))
}

/** Lightweight per-stem metadata for the mix-suggest endpoint. */
export function basicMeta(name: string, buffer: AudioBuffer): StemMeta {
  return {
    name,
    durationSec: buffer.duration,
    rmsDb: rmsDb(buffer),
  }
}

/** Richer features for the auto-name endpoint. */
export function richFeatures(name: string, buffer: AudioBuffer): StemFeatures {
  const ch = buffer.getChannelData(0)
  const sr = buffer.sampleRate

  // Zero crossing rate
  let zc = 0
  for (let i = 1; i < ch.length; i++) {
    if ((ch[i - 1] >= 0) !== (ch[i] >= 0)) zc++
  }
  const zcr = zc / ch.length

  // Spectral centroid via DFT on a downsampled middle window (cheap, good enough)
  const winSize = 4096
  const start = Math.max(0, Math.floor(ch.length / 2) - winSize / 2)
  const window = ch.subarray(start, start + winSize)
  const centroid = spectralCentroid(window, sr)

  // Peak count (transients): RMS frames with energy spike vs rolling mean
  const peakCount = countPeaks(ch, sr)

  return {
    ...basicMeta(name, buffer),
    spectralCentroidHz: centroid,
    peakCount,
    zeroCrossingRate: zcr,
  }
}

/**
 * Naive DFT-based spectral centroid (no FFT — N=4096 is fine for one-shot).
 * Returns frequency in Hz weighted by magnitude.
 */
function spectralCentroid(samples: Float32Array, sampleRate: number): number {
  // Hann window
  const N = samples.length
  const re = new Float32Array(N / 2)
  const im = new Float32Array(N / 2)
  for (let k = 0; k < N / 2; k++) {
    let r = 0, i = 0
    const wk = (2 * Math.PI * k) / N
    for (let n = 0; n < N; n++) {
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)))
      const x = samples[n] * w
      r += x * Math.cos(wk * n)
      i -= x * Math.sin(wk * n)
    }
    re[k] = r
    im[k] = i
  }

  let weightedSum = 0
  let magSum = 0
  for (let k = 1; k < N / 2; k++) {
    const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k])
    const freq = (k * sampleRate) / N
    weightedSum += mag * freq
    magSum += mag
  }
  return magSum > 0 ? weightedSum / magSum : 0
}

/** Count transient peaks (energy spikes vs 1s rolling mean). */
function countPeaks(channel: Float32Array, sampleRate: number): number {
  const frameSize = 1024
  const numFrames = Math.floor(channel.length / frameSize)
  const energies = new Float32Array(numFrames)
  for (let f = 0; f < numFrames; f++) {
    let sumSq = 0
    for (let i = 0; i < frameSize; i++) sumSq += channel[f * frameSize + i] ** 2
    energies[f] = Math.sqrt(sumSq / frameSize)
  }
  const winFrames = Math.floor(sampleRate / frameSize)
  const refractory = Math.floor((sampleRate * 0.1) / frameSize)
  let count = 0
  let lastPeak = -refractory
  for (let f = winFrames; f < numFrames; f++) {
    let sum = 0
    for (let i = f - winFrames; i < f; i++) sum += energies[i]
    const mean = sum / winFrames
    if (energies[f] > mean * 1.6 && f - lastPeak >= refractory) {
      count++
      lastPeak = f
    }
  }
  return count
}
