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
]

// ─── Tool execution (client-side) ───

export type ToolResult = { success: true; output: unknown } | { success: false; error: string }

export type AgentContext = {
  engine: AudioEngine
  stems: Array<{ name: string; volume: number; muted: boolean; solo: boolean; rmsDb: number }>
  setStems: (mutator: (current: AgentContext['stems']) => AgentContext['stems']) => void
  tempo: number | null
  beats: number[]
  duration: number
  crusher: { on: boolean; bits: number; reduction: number }
  setCrusher: (next: { on: boolean; bits: number; reduction: number }) => void
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
