/**
 * Tests for the WAV encoder and render glue.
 *
 * The full renderMix() needs OfflineAudioContext / AudioBufferSource which
 * is not in Node's global scope, so it's exercised in browser via Playwright.
 * The pure WAV encoder is tested here.
 */

import { describe, it, expect } from 'vitest'
import { audioBufferToWav } from './render'

/** Build a minimal AudioBuffer-like for the WAV encoder. */
function fakeBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    sampleRate,
    length: channels[0].length,
    duration: channels[0].length / sampleRate,
    getChannelData: (i: number) => channels[i],
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer
}

describe('audioBufferToWav', () => {
  it('emits a valid RIFF/WAVE/fmt/data header', async () => {
    const samples = new Float32Array(100)
    const blob = audioBufferToWav(fakeBuffer([samples], 44100))
    const bytes = new Uint8Array(await blob.arrayBuffer())
    // "RIFF"
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('RIFF')
    // "WAVE"
    expect(String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])).toBe('WAVE')
    // "fmt "
    expect(String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15])).toBe('fmt ')
    // "data"
    expect(String.fromCharCode(bytes[36], bytes[37], bytes[38], bytes[39])).toBe('data')
  })

  it('writes the right sample rate and channel count', async () => {
    const samples = new Float32Array(50)
    const blob = audioBufferToWav(fakeBuffer([samples, samples], 48000))
    const view = new DataView(await blob.arrayBuffer())
    // PCM format = 1
    expect(view.getUint16(20, true)).toBe(1)
    // Number of channels
    expect(view.getUint16(22, true)).toBe(2)
    // Sample rate
    expect(view.getUint32(24, true)).toBe(48000)
    // Bits per sample
    expect(view.getUint16(34, true)).toBe(16)
  })

  it('data chunk size = numSamples × numChannels × 2', async () => {
    const samples = new Float32Array(100)
    const blob = audioBufferToWav(fakeBuffer([samples, samples], 44100))
    const view = new DataView(await blob.arrayBuffer())
    expect(view.getUint32(40, true)).toBe(100 * 2 * 2)
  })

  it('clamps samples outside [-1, 1]', async () => {
    const ch = new Float32Array([0.5, -0.5, 2.0, -2.0])
    const blob = audioBufferToWav(fakeBuffer([ch], 44100))
    const view = new DataView(await blob.arrayBuffer())
    // Samples start at offset 44, 16-bit mono → 2 bytes per sample
    const s0 = view.getInt16(44, true)
    const s1 = view.getInt16(46, true)
    const s2 = view.getInt16(48, true) // clamped to 1.0
    const s3 = view.getInt16(50, true) // clamped to -1.0
    expect(s0).toBeCloseTo(0.5 * 0x7fff, -1)
    expect(s1).toBeCloseTo(-0.5 * 0x8000, -1)
    expect(s2).toBe(0x7fff)
    expect(s3).toBe(-0x8000) // -32768
  })

  it('interleaves stereo samples L, R, L, R, ...', async () => {
    const left = new Float32Array([1.0, 0.5])
    const right = new Float32Array([-1.0, -0.5])
    const blob = audioBufferToWav(fakeBuffer([left, right], 44100))
    const view = new DataView(await blob.arrayBuffer())
    // sample 0: L then R
    expect(view.getInt16(44, true)).toBe(0x7fff)        // L0 = 1.0
    expect(view.getInt16(46, true)).toBe(-0x8000)        // R0 = -1.0
    // sample 1: L then R
    expect(view.getInt16(48, true)).toBeCloseTo(0.5 * 0x7fff, -1)  // L1
    expect(view.getInt16(50, true)).toBeCloseTo(-0.5 * 0x8000, -1) // R1
  })

  it('total file size = 44 (header) + dataSize', async () => {
    const samples = new Float32Array(256)
    const blob = audioBufferToWav(fakeBuffer([samples], 22050))
    expect(blob.size).toBe(44 + 256 * 2)
  })

  it('blob has audio/wav MIME type', () => {
    const samples = new Float32Array(10)
    const blob = audioBufferToWav(fakeBuffer([samples], 44100))
    expect(blob.type).toBe('audio/wav')
  })
})
