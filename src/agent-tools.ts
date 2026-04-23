/**
 * Agent tool registry.
 *
 * The mixing-agent is given a set of tools that map directly onto the
 * AudioEngine's surface. The agent calls them by name; the client
 * executes them locally; results flow back to the agent as tool_results.
 *
 * Keep tool names, descriptions, and JSON schemas stable — the model has
 * been instructed to call them by these exact names.
 */

import type { AudioEngine } from './audio'
import type { AutomationEvent, Scheduler } from './automation'

export type ToolDefinition = {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'describe_session',
    description: 'Read back the current state: what stems are loaded, current mix volumes, mute/solo state, FX settings, tempo, beat count. Use this when you need to know what\'s going on before acting.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'set_volume',
    description: 'Set a stem\'s volume (0.0 silent, 1.0 unity). Honors current mute/solo state.',
    input_schema: {
      type: 'object',
      required: ['stem', 'value'],
      properties: {
        stem: { type: 'string', description: 'Exact stem name as returned by describe_session.' },
        value: { type: 'number', description: '0.0 to 1.0' },
      },
    },
  },
  {
    name: 'mute_stem',
    description: 'Mute a stem (gain → 0). Volume value is preserved for unmute.',
    input_schema: {
      type: 'object',
      required: ['stem'],
      properties: { stem: { type: 'string' } },
    },
  },
  {
    name: 'unmute_stem',
    description: 'Restore a previously muted stem to its set volume.',
    input_schema: {
      type: 'object',
      required: ['stem'],
      properties: { stem: { type: 'string' } },
    },
  },
  {
    name: 'solo_stem',
    description: 'Solo a stem (only this stem audible). Multiple stems can be soloed at once — call again with another stem to add to the solo group.',
    input_schema: {
      type: 'object',
      required: ['stem'],
      properties: { stem: { type: 'string' } },
    },
  },
  {
    name: 'clear_solo',
    description: 'Remove all solos — restore the regular mute/volume state for every stem.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'set_bitcrusher',
    description: 'Master-bus bitcrusher control. Lower bits = more digital distortion. Higher reduction = more sample-rate aliasing.',
    input_schema: {
      type: 'object',
      required: ['enabled'],
      properties: {
        enabled: { type: 'boolean' },
        bits: { type: 'number', description: '1..16, default 8. Lower = more crush.' },
        reduction: { type: 'number', description: '1..50, default 4. Higher = more aliasing.' },
      },
    },
  },
  {
    name: 'play',
    description: 'Start transport. Plays from current position.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'stop',
    description: 'Pause transport at current position.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'rewind',
    description: 'Jump transport back to 0:00.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'schedule_arrangement',
    description: `Schedule a time-based arrangement that plays out automatically during playback. Replaces any existing arrangement.

Example use: "intro = solo keys for first 4s; bring in drums at 4s; full mix at 8s; breakdown at 16s mute drums + bass".

Each event has an atSec (timestamp in the session) and a type. Events fire when the playhead crosses their time. Rewinding to 0 re-fires all events.

This is the most powerful tool — use it whenever the user asks for an arrangement, a flow, an intro/build/drop/breakdown, or anything that changes over time.`,
    input_schema: {
      type: 'object',
      required: ['events'],
      properties: {
        events: {
          type: 'array',
          description: 'List of automation events.',
          items: {
            type: 'object',
            required: ['atSec', 'type'],
            properties: {
              atSec: { type: 'number', description: 'When to fire (seconds from session start).' },
              type: { type: 'string', enum: ['volume', 'mute', 'solo', 'clear_solo', 'set_bitcrusher'] },
              stem: { type: 'string', description: 'Required for volume/mute/solo.' },
              value: { description: 'For volume: 0..1. For mute/solo: boolean.' },
              enabled: { type: 'boolean', description: 'For set_bitcrusher.' },
              bits: { type: 'number', description: 'For set_bitcrusher (1..16).' },
              reduction: { type: 'number', description: 'For set_bitcrusher (1..50).' },
            },
          },
        },
      },
    },
  },
  {
    name: 'clear_arrangement',
    description: 'Remove all scheduled arrangement events. Mix returns to manual control.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_arrangement',
    description: 'Read back the currently scheduled arrangement events.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'set_loop_region',
    description: 'Loop a section of the session indefinitely. The agent should snap startSec/endSec to detected beat times when possible.',
    input_schema: {
      type: 'object',
      required: ['startSec', 'endSec'],
      properties: {
        startSec: { type: 'number' },
        endSec: { type: 'number' },
      },
    },
  },
  {
    name: 'clear_loop_region',
    description: 'Disable looping; transport returns to single-play.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'add_section_label',
    description: 'Mark a named section on the timeline (intro, verse, chorus, drop, breakdown, outro). Visible to the user. Use this to communicate the song structure you\'re building.',
    input_schema: {
      type: 'object',
      required: ['name', 'startSec', 'endSec'],
      properties: {
        name: { type: 'string' },
        startSec: { type: 'number' },
        endSec: { type: 'number' },
      },
    },
  },
  {
    name: 'clear_sections',
    description: 'Remove all section labels.',
    input_schema: { type: 'object', properties: {} },
  },
]

// ─── Tool execution (client-side) ───

export type ToolResult = { success: true; output: unknown } | { success: false; error: string }

export type Section = { name: string; startSec: number; endSec: number }

export type AgentContext = {
  engine: AudioEngine
  stems: Array<{ name: string; volume: number; muted: boolean; solo: boolean; rmsDb: number }>
  setStems: (mutator: (current: AgentContext['stems']) => AgentContext['stems']) => void
  tempo: number | null
  beats: number[]
  duration: number
  crusher: { on: boolean; bits: number; reduction: number }
  setCrusher: (next: { on: boolean; bits: number; reduction: number }) => void
  scheduler: Scheduler
  onScheduleChanged: (events: AutomationEvent[]) => void
  setLoop: (range: { startSec: number; endSec: number } | null) => void
  loop: { startSec: number; endSec: number } | null
  sections: Section[]
  setSections: (sections: Section[]) => void
  rewindTransport: () => void
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'describe_session':
        return {
          success: true,
          output: {
            stems: ctx.stems.map(s => ({
              name: s.name,
              volume: s.volume,
              muted: s.muted,
              solo: s.solo,
              rmsDb: Math.round(s.rmsDb * 10) / 10,
            })),
            tempoBpm: ctx.tempo,
            beatCount: ctx.beats.length,
            durationSec: ctx.duration,
            bitcrusher: ctx.crusher,
            isPlaying: ctx.engine.isPlaying,
          },
        }

      case 'set_volume': {
        const stem = String(input.stem)
        const value = clamp01(Number(input.value))
        if (!ctx.stems.find(s => s.name === stem)) return { success: false, error: `unknown stem: ${stem}` }
        ctx.setStems(prev => {
          const next = prev.map(s => s.name === stem ? { ...s, volume: value } : s)
          applyToEngine(next, ctx.engine)
          return next
        })
        return { success: true, output: `set ${stem} volume to ${value.toFixed(2)}` }
      }

      case 'mute_stem': {
        const stem = String(input.stem)
        if (!ctx.stems.find(s => s.name === stem)) return { success: false, error: `unknown stem: ${stem}` }
        ctx.setStems(prev => {
          const next = prev.map(s => s.name === stem ? { ...s, muted: true } : s)
          applyToEngine(next, ctx.engine)
          return next
        })
        return { success: true, output: `muted ${stem}` }
      }

      case 'unmute_stem': {
        const stem = String(input.stem)
        if (!ctx.stems.find(s => s.name === stem)) return { success: false, error: `unknown stem: ${stem}` }
        ctx.setStems(prev => {
          const next = prev.map(s => s.name === stem ? { ...s, muted: false } : s)
          applyToEngine(next, ctx.engine)
          return next
        })
        return { success: true, output: `unmuted ${stem}` }
      }

      case 'solo_stem': {
        const stem = String(input.stem)
        if (!ctx.stems.find(s => s.name === stem)) return { success: false, error: `unknown stem: ${stem}` }
        ctx.setStems(prev => {
          const next = prev.map(s => s.name === stem ? { ...s, solo: true } : s)
          applyToEngine(next, ctx.engine)
          return next
        })
        return { success: true, output: `soloed ${stem}` }
      }

      case 'clear_solo':
        ctx.setStems(prev => {
          const next = prev.map(s => ({ ...s, solo: false }))
          applyToEngine(next, ctx.engine)
          return next
        })
        return { success: true, output: 'cleared all solos' }

      case 'set_bitcrusher': {
        const enabled = Boolean(input.enabled)
        const bits = clamp(Number(input.bits ?? ctx.crusher.bits), 1, 16)
        const reduction = clamp(Number(input.reduction ?? ctx.crusher.reduction), 1, 50)
        await ctx.engine.setCrusher(enabled, bits, reduction)
        ctx.setCrusher({ on: enabled, bits, reduction })
        return { success: true, output: `bitcrusher ${enabled ? `on (bits=${bits}, reduction=${reduction})` : 'off'}` }
      }

      case 'play':
        await ctx.engine.play()
        return { success: true, output: 'playing' }

      case 'stop':
        ctx.engine.pause()
        return { success: true, output: 'stopped' }

      case 'rewind':
        ctx.rewindTransport()
        return { success: true, output: 'transport rewound to 0:00' }

      case 'schedule_arrangement': {
        const events = (input.events as AutomationEvent[]) ?? []
        // Validate stems referenced
        for (const e of events) {
          if (e.type === 'volume' || e.type === 'mute' || e.type === 'solo') {
            const stemName = (e as { stem?: string }).stem
            if (stemName && !ctx.stems.find(s => s.name === stemName)) {
              return { success: false, error: `event references unknown stem: ${stemName}` }
            }
          }
        }
        ctx.scheduler.setSchedule(events)
        ctx.onScheduleChanged(events)
        return {
          success: true,
          output: `scheduled ${events.length} arrangement event${events.length === 1 ? '' : 's'} from ${events[0]?.atSec ?? 0}s to ${events[events.length - 1]?.atSec ?? 0}s`,
        }
      }

      case 'clear_arrangement':
        ctx.scheduler.clear()
        ctx.onScheduleChanged([])
        return { success: true, output: 'arrangement cleared' }

      case 'get_arrangement':
        return { success: true, output: { events: ctx.scheduler.getSchedule() } }

      case 'set_loop_region': {
        const startSec = Number(input.startSec)
        const endSec = Number(input.endSec)
        if (!isFinite(startSec) || !isFinite(endSec) || endSec <= startSec) {
          return { success: false, error: 'invalid loop range' }
        }
        ctx.setLoop({ startSec, endSec })
        return { success: true, output: `loop set: ${startSec.toFixed(2)}s → ${endSec.toFixed(2)}s` }
      }

      case 'clear_loop_region':
        ctx.setLoop(null)
        return { success: true, output: 'loop cleared' }

      case 'add_section_label': {
        const section: Section = {
          name: String(input.name),
          startSec: Number(input.startSec),
          endSec: Number(input.endSec),
        }
        ctx.setSections([...ctx.sections, section])
        return { success: true, output: `section "${section.name}" added (${section.startSec.toFixed(1)}s → ${section.endSec.toFixed(1)}s)` }
      }

      case 'clear_sections':
        ctx.setSections([])
        return { success: true, output: 'sections cleared' }

      default:
        return { success: false, error: `unknown tool: ${name}` }
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function applyToEngine(
  stems: AgentContext['stems'],
  engine: AudioEngine,
) {
  const stateMap: Record<string, { volume: number; muted: boolean; solo: boolean }> = {}
  stems.forEach(s => {
    stateMap[s.name] = { volume: s.volume, muted: s.muted, solo: s.solo }
  })
  engine.applySoloLogic(stateMap)
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
function clamp01(n: number): number { return clamp(n, 0, 1) }
