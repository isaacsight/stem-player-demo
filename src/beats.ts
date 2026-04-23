/**
 * Energy-based onset detection.
 *
 * Computes RMS energy in 1024-sample frames, emits a beat where the frame
 * energy exceeds (rolling 1s mean × threshold) and the refractory time
 * (150 ms) has elapsed since the last beat.
 *
 * Returns beat times in seconds.
 */
export function detectBeats(buffer: AudioBuffer): number[] {
  const channel = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate
  const frameSize = 1024
  const numFrames = Math.floor(channel.length / frameSize)
  const energies = new Float32Array(numFrames)

  for (let f = 0; f < numFrames; f++) {
    let sumSq = 0
    const start = f * frameSize
    for (let i = 0; i < frameSize; i++) sumSq += channel[start + i] ** 2
    energies[f] = Math.sqrt(sumSq / frameSize)
  }

  const windowFrames = Math.floor(sampleRate / frameSize) // ~1 s
  // Round UP so the refractory is at least 150ms — rounding down can let
  // beats slip closer together than the documented minimum.
  const refractoryFrames = Math.ceil((sampleRate * 0.15) / frameSize)
  const threshold = 1.6
  const beats: number[] = []
  let lastBeatFrame = -refractoryFrames

  for (let f = windowFrames; f < numFrames; f++) {
    let sum = 0
    for (let i = f - windowFrames; i < f; i++) sum += energies[i]
    const mean = sum / windowFrames
    if (energies[f] > mean * threshold && f - lastBeatFrame >= refractoryFrames) {
      beats.push((f * frameSize) / sampleRate)
      lastBeatFrame = f
    }
  }

  return beats
}

/**
 * Estimate tempo from beat times via the median inter-beat interval.
 * Robust to outliers; returns BPM.
 *
 * If too few beats to estimate, returns null.
 */
export function estimateTempo(beats: number[]): number | null {
  if (beats.length < 4) return null
  const intervals: number[] = []
  for (let i = 1; i < beats.length; i++) intervals.push(beats[i] - beats[i - 1])
  intervals.sort((a, b) => a - b)
  const median = intervals[Math.floor(intervals.length / 2)]
  if (median <= 0) return null
  let bpm = 60 / median
  // Fold to musical range — onset detection often fires on subdivisions
  while (bpm > 180) bpm /= 2
  while (bpm < 70) bpm *= 2
  return bpm
}
