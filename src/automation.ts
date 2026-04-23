/**
 * Arrangement scheduler.
 *
 * The agent can write a list of timed mix events ("at 0s solo keys, at 4s
 * bring drums in, at 16s breakdown"). The scheduler watches the playhead
 * during playback and fires events as their times pass.
 *
 * The scheduler keeps the full event list and tracks fired indices per
 * playback session — so rewinding (start playback from 0 again) re-fires
 * all events. Resuming from mid-playback fires only the events between the
 * last position and now.
 */

export type AutomationEvent =
  | { atSec: number; type: 'volume'; stem: string; value: number }
  | { atSec: number; type: 'mute'; stem: string; value: boolean }
  | { atSec: number; type: 'solo'; stem: string; value: boolean }
  | { atSec: number; type: 'clear_solo' }
  | { atSec: number; type: 'set_bitcrusher'; enabled: boolean; bits?: number; reduction?: number }

export class Scheduler {
  private events: AutomationEvent[] = []
  private firedIndices = new Set<number>()
  private lastPosition = 0

  setSchedule(events: AutomationEvent[]) {
    this.events = [...events].sort((a, b) => a.atSec - b.atSec)
    this.firedIndices.clear()
    this.lastPosition = 0
  }

  getSchedule(): AutomationEvent[] {
    return [...this.events]
  }

  clear() {
    this.events = []
    this.firedIndices.clear()
    this.lastPosition = 0
  }

  /** Call when transport rewinds to 0 (or jumps backward). */
  rewindTo(positionSec: number) {
    this.lastPosition = positionSec
    this.firedIndices.clear()
    // Re-mark events earlier than the new position as already fired
    this.events.forEach((e, i) => {
      if (e.atSec < positionSec) this.firedIndices.add(i)
    })
  }

  /**
   * Drive the scheduler forward to currentTime. Fires every event whose
   * atSec is ≤ currentTime and hasn't fired yet.
   */
  tick(currentTimeSec: number, apply: (e: AutomationEvent) => void) {
    if (currentTimeSec < this.lastPosition - 0.05) {
      // Time went backward by more than a frame — treat as rewind
      this.rewindTo(currentTimeSec)
    }
    this.lastPosition = currentTimeSec
    for (let i = 0; i < this.events.length; i++) {
      if (this.firedIndices.has(i)) continue
      if (this.events[i].atSec > currentTimeSec) break
      this.firedIndices.add(i)
      apply(this.events[i])
    }
  }
}
