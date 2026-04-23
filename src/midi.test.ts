import { describe, it, expect } from 'vitest'
import { buildMidiFile } from './midi'

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

describe('buildMidiFile', () => {
  it('produces a valid SMF header', async () => {
    const bytes = await blobToBytes(buildMidiFile([1, 2, 3], { bpm: 120 }))
    // "MThd"
    expect(bytes[0]).toBe(0x4d)
    expect(bytes[1]).toBe(0x54)
    expect(bytes[2]).toBe(0x68)
    expect(bytes[3]).toBe(0x64)
    // header length = 6
    expect(bytes[7]).toBe(0x06)
    // format 0
    expect(bytes[8]).toBe(0x00)
    expect(bytes[9]).toBe(0x00)
    // 1 track
    expect(bytes[10]).toBe(0x00)
    expect(bytes[11]).toBe(0x01)
    // ticks per quarter = 480
    expect((bytes[12] << 8) | bytes[13]).toBe(480)
  })

  it('starts the track with "MTrk"', async () => {
    const bytes = await blobToBytes(buildMidiFile([1], { bpm: 120 }))
    // MTrk should be at offset 14
    expect(bytes[14]).toBe(0x4d)
    expect(bytes[15]).toBe(0x54)
    expect(bytes[16]).toBe(0x72)
    expect(bytes[17]).toBe(0x6b)
  })

  it('encodes the tempo meta event', async () => {
    const bytes = await blobToBytes(buildMidiFile([1], { bpm: 120 }))
    // Track body starts at offset 22 (after MTrk + 4 length bytes).
    // First byte: delta-time VLQ (0). Then FF 51 03 <3 bytes microseconds>.
    expect(bytes[22]).toBe(0x00) // delta = 0
    expect(bytes[23]).toBe(0xff) // meta
    expect(bytes[24]).toBe(0x51) // tempo
    expect(bytes[25]).toBe(0x03) // length 3
    const micros = (bytes[26] << 16) | (bytes[27] << 8) | bytes[28]
    expect(micros).toBe(500_000) // 60_000_000 / 120
  })

  it('emits one note-on + note-off pair per beat', async () => {
    const beats = [0.5, 1.0, 1.5, 2.0]
    const bytes = await blobToBytes(buildMidiFile(beats, { bpm: 120, note: 60 }))
    let noteOnCount = 0
    let noteOffCount = 0
    for (let i = 0; i < bytes.length - 2; i++) {
      if (bytes[i] === 0x90 && bytes[i + 1] === 60) noteOnCount++
      if (bytes[i] === 0x80 && bytes[i + 1] === 60) noteOffCount++
    }
    expect(noteOnCount).toBe(beats.length)
    expect(noteOffCount).toBe(beats.length)
  })

  it('ends with the EOT meta event (FF 2F 00)', async () => {
    const bytes = await blobToBytes(buildMidiFile([1, 2], { bpm: 120 }))
    // Last 3 bytes should be FF 2F 00
    expect(bytes[bytes.length - 3]).toBe(0xff)
    expect(bytes[bytes.length - 2]).toBe(0x2f)
    expect(bytes[bytes.length - 1]).toBe(0x00)
  })

  it('produces a non-empty file even for an empty beat list', async () => {
    const bytes = await blobToBytes(buildMidiFile([], { bpm: 120 }))
    // Header (14) + MTrk header (8) + tempo meta (7) + EOT (4 with delta) = 33
    expect(bytes.length).toBeGreaterThanOrEqual(28)
  })
})
