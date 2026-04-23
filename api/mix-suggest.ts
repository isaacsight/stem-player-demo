/**
 * /api/mix-suggest — Vercel serverless function (Edge runtime).
 *
 * Receives an analyzed-session description from the browser and returns
 * a structured mix suggestion via the Claude API.
 *
 * Request body:
 *   {
 *     stems: Array<{ name: string; durationSec: number; rmsDb: number }>,
 *     tempo: number | null,
 *     beatCount: number,
 *     totalDuration: number,
 *   }
 *
 * Response:
 *   {
 *     description: string,        // 2-3 sentence producer-style read
 *     suggestion: string,         // one sentence, the proposed move
 *     actions: MixAction[],       // applicable to UI state
 *   }
 *
 *   MixAction = { type: 'mute'|'solo'|'volume'; stem: string; value?: number }
 */

import Anthropic from '@anthropic-ai/sdk'

export const config = { runtime: 'edge' }

type StemMeta = { name: string; durationSec: number; rmsDb: number }
type ReqBody = {
  stems: StemMeta[]
  tempo: number | null
  beatCount: number
  totalDuration: number
}
type MixAction =
  | { type: 'mute'; stem: string; value: boolean }
  | { type: 'solo'; stem: string; value: boolean }
  | { type: 'volume'; stem: string; value: number }

const SYSTEM_PROMPT = `You are an experienced mixing engineer evaluating a multi-stem audio session.
Read the stem metadata, the tempo, and the beat count, and produce:
  1. A 2-3 sentence read on what the session is — style, energy, what's musically going on.
  2. One concrete suggestion the user could try right now (intro, breakdown, build, drop, alternate mix, etc.).
  3. The exact mix actions to realize the suggestion.

Be specific, opinionated, and producer-fluent. Avoid generic phrases ("nice groove"). Reference the actual stem names.

Return JSON only — no preamble, no markdown.`

const TOOL_SCHEMA = {
  name: 'return_mix_suggestion',
  description: 'Return a structured mix suggestion to apply to the UI.',
  input_schema: {
    type: 'object',
    required: ['description', 'suggestion', 'actions'],
    properties: {
      description: { type: 'string', description: '2-3 sentences describing the session.' },
      suggestion: { type: 'string', description: 'One sentence: what to try.' },
      actions: {
        type: 'array',
        description: 'Mix actions to apply.',
        items: {
          type: 'object',
          required: ['type', 'stem'],
          properties: {
            type: { type: 'string', enum: ['mute', 'solo', 'volume'] },
            stem: { type: 'string' },
            value: { description: 'For mute/solo: boolean. For volume: 0..1.' },
          },
        },
      },
    },
  },
} as const

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'POST only' }, 405)
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not configured on server' }, 500)

  let body: ReqBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }
  if (!Array.isArray(body.stems) || body.stems.length === 0) {
    return json({ error: 'stems[] required' }, 400)
  }

  const client = new Anthropic({ apiKey })

  const userMessage = formatSessionForModel(body)

  try {
    const result = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'return_mix_suggestion' },
      messages: [{ role: 'user', content: userMessage }],
    })

    const toolUse = result.content.find(b => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return json({ error: 'model did not return a tool use', raw: result }, 502)
    }

    const out = toolUse.input as {
      description: string
      suggestion: string
      actions: MixAction[]
    }
    return json(out, 200)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'unknown' }, 502)
  }
}

function formatSessionForModel(body: ReqBody): string {
  const stems = body.stems
    .map(s => `  - ${s.name}: ${s.durationSec.toFixed(2)}s, ${s.rmsDb.toFixed(1)} dBFS RMS`)
    .join('\n')
  return `Session metadata:
- Total duration: ${body.totalDuration.toFixed(2)}s
- Detected tempo: ${body.tempo ? `${body.tempo.toFixed(1)} BPM` : 'unknown'}
- Detected beat markers: ${body.beatCount}

Stems:
${stems}

Produce a mix suggestion. Stem names refer to the audio content — interpret what they likely are (drums, bass, vocals, keys, lead, fx, etc.) and plan accordingly. If stems share a common name like "drums" you may target groups; otherwise target each by exact name.`
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
