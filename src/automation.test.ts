import { describe, it, expect } from 'vitest'
import { Scheduler, type AutomationEvent } from './automation'

describe('Scheduler', () => {
  it('fires events in atSec order regardless of insertion order', () => {
    const s = new Scheduler()
    s.setSchedule([
      { atSec: 5, type: 'volume', stem: 'a', value: 0.5 },
      { atSec: 1, type: 'volume', stem: 'a', value: 0.2 },
      { atSec: 3, type: 'volume', stem: 'a', value: 0.8 },
    ])
    const fired: number[] = []
    s.tick(10, e => { if (e.type === 'volume') fired.push(e.value) })
    expect(fired).toEqual([0.2, 0.8, 0.5])
  })

  it('does not double-fire events on subsequent ticks', () => {
    const s = new Scheduler()
    s.setSchedule([{ atSec: 1, type: 'volume', stem: 'a', value: 0.5 }])
    let count = 0
    s.tick(2, () => count++)
    s.tick(3, () => count++)
    s.tick(4, () => count++)
    expect(count).toBe(1)
  })

  it('only fires events whose atSec is <= currentTime', () => {
    const s = new Scheduler()
    s.setSchedule([
      { atSec: 1, type: 'volume', stem: 'a', value: 0.1 },
      { atSec: 5, type: 'volume', stem: 'a', value: 0.5 },
      { atSec: 10, type: 'volume', stem: 'a', value: 1.0 },
    ])
    const seen: number[] = []
    s.tick(3, e => { if (e.type === 'volume') seen.push(e.value) })
    expect(seen).toEqual([0.1])
    s.tick(7, e => { if (e.type === 'volume') seen.push(e.value) })
    expect(seen).toEqual([0.1, 0.5])
  })

  it('rewinds on backward time jump (more than one frame)', () => {
    const s = new Scheduler()
    s.setSchedule([
      { atSec: 1, type: 'volume', stem: 'a', value: 0.1 },
      { atSec: 2, type: 'volume', stem: 'a', value: 0.2 },
    ])
    let firedCount = 0
    s.tick(3, () => firedCount++)
    expect(firedCount).toBe(2)
    // Time jumps backward — should re-fire from current position
    s.tick(0.5, () => firedCount++)
    s.tick(3, () => firedCount++)
    expect(firedCount).toBe(4) // 2 initial + 2 after rewind
  })

  it('does NOT trigger rewind for tiny backward jitter (<50ms)', () => {
    const s = new Scheduler()
    s.setSchedule([{ atSec: 1, type: 'volume', stem: 'a', value: 0.1 }])
    let count = 0
    s.tick(2, () => count++)
    s.tick(1.99, () => count++) // 10ms backward — should NOT rewind
    expect(count).toBe(1)
  })

  it('clear() empties the schedule', () => {
    const s = new Scheduler()
    s.setSchedule([{ atSec: 1, type: 'volume', stem: 'a', value: 0.5 }])
    s.clear()
    let count = 0
    s.tick(10, () => count++)
    expect(count).toBe(0)
    expect(s.getSchedule()).toEqual([])
  })

  it('rewindTo(positionSec) marks earlier events as already fired', () => {
    const s = new Scheduler()
    s.setSchedule([
      { atSec: 1, type: 'volume', stem: 'a', value: 0.1 },
      { atSec: 3, type: 'volume', stem: 'a', value: 0.3 },
      { atSec: 5, type: 'volume', stem: 'a', value: 0.5 },
    ])
    s.rewindTo(2.5)
    // Events before 2.5s should be marked fired; only the t=3 and t=5 should fire
    const fired: number[] = []
    s.tick(10, e => { if (e.type === 'volume') fired.push(e.value) })
    expect(fired).toEqual([0.3, 0.5])
  })

  it('handles all event types (volume, mute, solo, clear_solo, set_bitcrusher)', () => {
    const s = new Scheduler()
    const events: AutomationEvent[] = [
      { atSec: 0, type: 'volume', stem: 'a', value: 0.5 },
      { atSec: 1, type: 'mute', stem: 'a', value: true },
      { atSec: 2, type: 'solo', stem: 'b', value: true },
      { atSec: 3, type: 'clear_solo' },
      { atSec: 4, type: 'set_bitcrusher', enabled: true, bits: 6, reduction: 8 },
    ]
    s.setSchedule(events)
    const types: string[] = []
    s.tick(5, e => types.push(e.type))
    expect(types).toEqual(['volume', 'mute', 'solo', 'clear_solo', 'set_bitcrusher'])
  })

  it('getSchedule() returns a defensive copy', () => {
    const s = new Scheduler()
    const events: AutomationEvent[] = [{ atSec: 1, type: 'volume', stem: 'a', value: 0.5 }]
    s.setSchedule(events)
    const got = s.getSchedule()
    got.push({ atSec: 99, type: 'mute', stem: 'a', value: true })
    expect(s.getSchedule()).toHaveLength(1) // internal not mutated
  })
})
