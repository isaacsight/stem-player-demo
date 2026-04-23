/**
 * /api/auto-name — bonus AI feature: infer stem types from acoustic features.
 *
 * The browser computes per-stem features (RMS, spectral centroid, peak count)
 * and sends them here. The model returns a mapping from original filenames
 * to inferred stem types ("drums" / "bass" / "vocals" / etc.).
 *
 * This is useful for Suno-style stem exports that arrive with neutral names
 * like "stem_01.wav".
 */

import Anthropic from '@anthropic-ai/sdk'

export const config = { runtime: 'edge' }

type StemFeatures = {
  name: string
  durationSec: number
  rmsDb: number
  spectralCentroidHz: number
  peakCount: number
  zeroCrossingRate: number
}
type ReqBody = { stems: StemFeatures[] }
type Inference = { original: string; inferredType: string; confidence: number }

const SYSTEM_PROMPT = `You are an audio engineer classifying multi-stem session content.
Given per-stem acoustic features, infer what each stem most likely contains.
Common categories: drums, kick, snare, hi-hat, bass, sub, keys, pad, lead, vocals, fx, percussion.

Use these heuristics (combine, don't apply rigidly):
  - Low spectral centroid + high RMS + many transient peaks → drums or bass
  - Very low centroid (<200Hz) → sub bass or kick
  - High zero-crossing rate + high centroid → hats, percussion, or noise FX
  - Sustained energy + mid centroid → keys, pad, lead
  - Speech-band centroid (1-3kHz) + dynamic envelope → vocals
  - Long duration matching session length → likely a sustained element (pad/keys/bass)
  - Sparse peaks + short bursts → percussion or FX hits

Confidence reflects how sure you are; never claim 1.0.

Return JSON only.`

const TOOL_SCHEMA = {
  name: 'return_inferences',
  description: 'Return inferred stem types.',
  input_schema: {
    type: 'object',
    required: ['inferences'],
    properties: {
      inferences: {
        type: 'array',
        items: {
          type: 'object',
          required: ['original', 'inferredType', 'confidence'],
          properties: {
            original: { type: 'string', description: 'Original stem name from input.' },
            inferredType: { type: 'string', description: 'Best guess: drums, bass, keys, etc.' },
            confidence: { type: 'number', description: '0..1, never 1.0.' },
          },
        },
      },
    },
  },
} as const

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500)

  let body: ReqBody
  try { body = await req.json() } catch { return json({ error: 'invalid JSON' }, 400) }
  if (!Array.isArray(body.stems) || body.stems.length === 0) {
    return json({ error: 'stems[] required' }, 400)
  }

  const userMessage = `Stem features:\n${body.stems.map(formatStem).join('\n')}\n\nReturn an inference for each.`

  try {
    const client = new Anthropic({ apiKey })
    const result = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'return_inferences' },
      messages: [{ role: 'user', content: userMessage }],
    })
    const toolUse = result.content.find(b => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return json({ error: 'model did not return tool use' }, 502)
    }
    return json(toolUse.input as { inferences: Inference[] }, 200)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'unknown' }, 502)
  }
}

function formatStem(s: StemFeatures): string {
  return `  - ${s.name}: ${s.durationSec.toFixed(2)}s, ${s.rmsDb.toFixed(1)} dBFS RMS, centroid ${s.spectralCentroidHz.toFixed(0)}Hz, ${s.peakCount} peaks, ZCR ${s.zeroCrossingRate.toFixed(3)}`
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
