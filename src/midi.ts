/**
 * Minimal Standard MIDI File (SMF) writer.
 * Builds a Format-0, single-track .mid file from a list of beat times.
 *
 * Format reference:
 *   - Spec: https://midi.org/standard-midi-files
 *   - Header chunk: "MThd" + len=6 + format(2) + ntrks(2) + division(2)
 *   - Track chunk: "MTrk" + len(4) + <delta, event>... + EOT
 *   - Delta times are variable-length quantities (VLQ).
 */

const TICKS_PER_BEAT = 480

export type MidiOptions = {
  bpm: number
  /** MIDI note number to emit on each beat. Default: 60 (C4) */
  note?: number
  /** Velocity 0..127. Default: 100 */
  velocity?: number
  /** Note duration in ticks. Default: TICKS_PER_BEAT / 4 (16th note) */
  durationTicks?: number
}

/**
 * Build a Standard MIDI File from beat times (in seconds).
 * Returns a Blob suitable for download.
 */
export function buildMidiFile(beatTimes: number[], opts: MidiOptions): Blob {
  const { bpm, note = 60, velocity = 100, durationTicks = TICKS_PER_BEAT / 4 } = opts
  const secondsPerTick = 60 / bpm / TICKS_PER_BEAT

  // Build event list: (delta-ticks, status, data1, data2)
  const events: Array<{ delta: number; bytes: number[] }> = []

  // Tempo meta event at t=0: FF 51 03 <microseconds-per-quarter (3 bytes)>
  const microsPerQuarter = Math.round(60_000_000 / bpm)
  events.push({
    delta: 0,
    bytes: [0xff, 0x51, 0x03,
      (microsPerQuarter >> 16) & 0xff,
      (microsPerQuarter >> 8) & 0xff,
      microsPerQuarter & 0xff],
  })

  let lastTick = 0
  for (const beatSec of beatTimes) {
    const beatTick = Math.round(beatSec / secondsPerTick)
    const onDelta = beatTick - lastTick
    events.push({ delta: onDelta, bytes: [0x90, note, velocity] }) // note on, ch 0
    events.push({ delta: durationTicks, bytes: [0x80, note, 0] })  // note off
    lastTick = beatTick + durationTicks
  }

  // End-of-track meta: FF 2F 00
  events.push({ delta: 0, bytes: [0xff, 0x2f, 0x00] })

  // Serialize track body
  const trackBytes: number[] = []
  for (const e of events) {
    trackBytes.push(...vlq(e.delta))
    trackBytes.push(...e.bytes)
  }

  const header = [
    0x4d, 0x54, 0x68, 0x64,           // "MThd"
    0x00, 0x00, 0x00, 0x06,           // header length
    0x00, 0x00,                       // format 0
    0x00, 0x01,                       // 1 track
    (TICKS_PER_BEAT >> 8) & 0xff, TICKS_PER_BEAT & 0xff, // ticks/quarter
  ]
  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b,           // "MTrk"
    (trackBytes.length >> 24) & 0xff,
    (trackBytes.length >> 16) & 0xff,
    (trackBytes.length >> 8) & 0xff,
    trackBytes.length & 0xff,
  ]

  return new Blob([new Uint8Array([...header, ...trackHeader, ...trackBytes])], {
    type: 'audio/midi',
  })
}

/**
 * Variable-Length Quantity encoding for MIDI delta-times.
 * Each byte uses 7 data bits; high bit set on all but the last byte.
 */
function vlq(value: number): number[] {
  if (value < 0) throw new Error('VLQ requires non-negative integer')
  const bytes: number[] = [value & 0x7f]
  value >>= 7
  while (value > 0) {
    bytes.unshift((value & 0x7f) | 0x80)
    value >>= 7
  }
  return bytes
}

/** Trigger a browser download of a Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
