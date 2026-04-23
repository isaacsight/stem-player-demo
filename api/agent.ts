/**
 * /api/agent — the mixing-agent loop endpoint.
 *
 * Stateless. Each request includes the full conversation history + current
 * session snapshot. The model receives those, may emit text deltas and/or
 * tool_use blocks, and returns its assistant message. The client executes
 * the tool calls and posts back with new tool_result blocks for the next
 * turn.
 *
 * Streaming: the response is text/event-stream of newline-delimited JSON
 * frames (`{type, ...}`) so the UI can render text deltas live and surface
 * tool_use blocks as they arrive.
 */

import Anthropic from '@anthropic-ai/sdk'
import { AGENT_TOOLS } from '../src/agent-tools'

export const config = { runtime: 'edge' }

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

type AgentMessage = { role: 'user' | 'assistant'; content: ContentBlock[] | string }

type ReqBody = {
  messages: AgentMessage[]
  sessionSnapshot?: Record<string, unknown>
}

const SYSTEM_PROMPT = `You are a producer-grade mixing engineer working inside a browser-based stem player.

You have tools to inspect and adjust the live mix. Use them. Don't just describe what you would do — do it.

Mix style guide:
  - Reference real producer language (headroom, presence, gluing the low end, etc.)
  - When users ask vague things ("make it better", "downtempo it"), make a real call: pick a direction, explain the choice in one sentence, then execute it via tools.
  - Always call describe_session FIRST when you don't know the current state.
  - Never claim to have changed something without calling the corresponding tool.
  - When applying a multi-step mix, call tools in sequence — don't ask the user for permission between each step.
  - Be concise. Producers are impatient. One sentence of reasoning, then the tool calls.

Volume conventions:
  - 1.0 = unity, 0.7 = -3dB pull-back, 0.5 = -6dB significant reduction, 0.3 = quiet bed.
  - Mute (gain → 0) is reversible — use it freely for breakdowns and arrangement experiments.

Bitcrusher:
  - bits 8 + reduction 4 = noticeable lo-fi color
  - bits 4 + reduction 8 = aggressive crush
  - bits 12 + reduction 2 = subtle digital edge

If the session has standard stem names (drums, bass, keys, lead, vocals), interpret them at face value. If names are neutral (stem_01, etc.), call describe_session and infer from the RMS levels (low RMS often = mids/highs; high RMS often = drums/bass).`

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return new Response(JSON.stringify({ error: 'no api key' }), { status: 500 })

  let body: ReqBody
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages[] required' }), { status: 400 })
  }

  const client = new Anthropic({ apiKey })

  // Compose system prompt with current session snapshot if provided
  const system = body.sessionSnapshot
    ? `${SYSTEM_PROMPT}\n\n<current-session>\n${JSON.stringify(body.sessionSnapshot, null, 2)}\n</current-session>`
    : SYSTEM_PROMPT

  const stream = new ReadableStream({
    async start(controller) {
      const send = (frame: object) => {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(frame) + '\n'))
      }

      try {
        const messageStream = await client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system,
          tools: AGENT_TOOLS,
          messages: body.messages.map(normalizeMessage),
        })

        let currentText = ''
        const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = []

        for await (const event of messageStream) {
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'tool_use') {
              toolUses.push({ id: event.content_block.id, name: event.content_block.name, input: {} })
              send({ type: 'tool_use_start', id: event.content_block.id, name: event.content_block.name })
            }
          }
          if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              currentText += event.delta.text
              send({ type: 'text_delta', text: event.delta.text })
            }
            if (event.delta.type === 'input_json_delta') {
              send({ type: 'tool_input_delta', delta: event.delta.partial_json })
            }
          }
          if (event.type === 'content_block_stop') {
            // Capture finalized tool input
            const final = await messageStream.finalMessage().catch(() => null)
            if (final) {
              for (const block of final.content) {
                if (block.type === 'tool_use') {
                  const existing = toolUses.find(t => t.id === block.id)
                  if (existing) existing.input = block.input as Record<string, unknown>
                }
              }
            }
          }
        }

        const final = await messageStream.finalMessage()
        send({
          type: 'message_complete',
          stop_reason: final.stop_reason,
          assistant_message: final.content,
        })
        controller.close()
      } catch (err) {
        send({ type: 'error', error: err instanceof Error ? err.message : 'unknown' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
    },
  })
}

function normalizeMessage(m: AgentMessage): { role: 'user' | 'assistant'; content: ContentBlock[] | string } {
  return { role: m.role, content: m.content }
}
