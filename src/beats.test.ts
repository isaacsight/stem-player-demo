import { describe, it, expect } from 'vitest'
import { detectBeats, estimateTempo } from './beats'

/** Build a fake AudioBuffer-like object with a Float32Array channel. */
function fakeBuffer(samples: Float32Array, sampleRate = 44100): AudioBuffer {
  return {
    sampleRate,
    length: samples.length,
    duration: samples.length / sampleRate,
    numberOfChannels: 1,
    getChannelData: () => samples,
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer
}

describe('detectBeats', () => {
  it('returns no beats for silence', () => {
    const samples = new Float32Array(44100 * 4) // 4s of zero
    const beats = detectBeats(fakeBuffer(samples))
    expect(beats).toEqual([])
  })

  it('finds periodic energy spikes', () => {
    const sr = 44100
    const dur = 4
    const samples = new Float32Array(sr * dur)
    // Quiet noise floor + 1 transient every 0.5s starting at t=1s
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() - 0.5) * 0.01
    for (let t = 1; t < dur; t += 0.5) {
      const idx = Math.floor(t * sr)
      // 50ms transient burst
      for (let j = 0; j < 0.05 * sr; j++) {
        samples[idx + j] = Math.sin((2 * Math.PI * 440 * j) / sr) * 0.8
      }
    }
    const beats = detectBeats(fakeBuffer(samples, sr))
    // Should find ~6 beats; allow ±2 from edge effects and threshold sensitivity
    expect(beats.length).toBeGreaterThanOrEqual(4)
    expect(beats.length).toBeLessThanOrEqual(8)
  })

  it('respects refractory period (no beats <150ms apart)', () => {
    const sr = 44100
    const samples = new Float32Array(sr * 4)
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() - 0.5) * 0.01
    // Pack 20 transients in 1 second — refractory should drop most
    for (let k = 0; k < 20; k++) {
      const idx = Math.floor((1 + k * 0.05) * sr)
      for (let j = 0; j < 0.02 * sr; j++) {
        samples[idx + j] = 0.9
      }
    }
    const beats = detectBeats(fakeBuffer(samples, sr))
    // 20 transients in ~1s, refractory 150ms → max ~7 beats
    expect(beats.length).toBeLessThanOrEqual(8)
    // All consecutive intervals must be >= 0.14s (allow tiny float slop)
    for (let i = 1; i < beats.length; i++) {
      expect(beats[i] - beats[i - 1]).toBeGreaterThanOrEqual(0.14)
    }
  })
})

describe('estimateTempo', () => {
  it('returns null for too few beats', () => {
    expect(estimateTempo([])).toBeNull()
    expect(estimateTempo([1, 2, 3])).toBeNull()
  })

  it('estimates 120 BPM from half-second intervals', () => {
    const beats = [0, 0.5, 1.0, 1.5, 2.0, 2.5]
    const bpm = estimateTempo(beats)
    expect(bpm).toBeCloseTo(120, 0)
  })

  it('folds out-of-range tempos into musical range', () => {
    // 240 BPM intervals should fold to 120
    const beats = [0, 0.25, 0.5, 0.75, 1.0, 1.25]
    expect(estimateTempo(beats)).toBeCloseTo(120, 0)
    // 50 BPM intervals (1.2s) should double to 100
    const slow = [0, 1.2, 2.4, 3.6, 4.8]
    const slowBpm = estimateTempo(slow)
    expect(slowBpm).not.toBeNull()
    expect(slowBpm!).toBeGreaterThanOrEqual(70)
    expect(slowBpm!).toBeLessThanOrEqual(180)
  })

  it('is robust to outlier intervals (uses median)', () => {
    // Mostly 120 BPM with one huge gap
    const beats = [0, 0.5, 1.0, 1.5, 5.0, 5.5, 6.0]
    const bpm = estimateTempo(beats)
    expect(bpm).toBeCloseTo(120, 0)
  })
})
