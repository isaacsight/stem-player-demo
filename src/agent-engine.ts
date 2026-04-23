/**
 * Client-side mixing-agent engine.
 *
 * Drives the agent loop:
 *   1. Send messages + session snapshot to /api/agent
 *   2. Stream text deltas to onText
 *   3. Stream tool_use blocks to onToolUse (so the UI can show them live)
 *   4. When the message completes, execute every tool call locally
 *   5. Post back with the new tool_results, repeat until stop_reason !== 'tool_use'
 *
 * The agent is interruptible — pass an AbortController to cancel mid-stream.
 */

import { executeTool, type AgentContext, type ToolResult } from './agent-tools'

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

export type AgentMessage = { role: 'user' | 'assistant'; content: ContentBlock[] | string }

export type ToolCallTrace = {
  id: string
  name: string
  input: Record<string, unknown>
  result?: ToolResult
  startedAt: number
  endedAt?: number
}

export type AgentCallbacks = {
  onText?: (delta: string) => void
  onToolUse?: (call: ToolCallTrace) => void
  onToolResult?: (call: ToolCallTrace) => void
  onMessageComplete?: (msg: AgentMessage) => void
  onError?: (err: string) => void
}

export type AgentRunInput = {
  messages: AgentMessage[]
  sessionSnapshot: () => Record<string, unknown>
  ctx: AgentContext
  signal?: AbortSignal
  callbacks?: AgentCallbacks
  maxTurns?: number
}

export async function runAgent(input: AgentRunInput): Promise<AgentMessage[]> {
  const { ctx, callbacks, signal } = input
  const maxTurns = input.maxTurns ?? 6
  let messages = [...input.messages]

  for (let turn = 0; turn < maxTurns; turn++) {
    const snapshot = input.sessionSnapshot()
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages, sessionSnapshot: snapshot }),
      signal,
    })
    if (!res.ok) {
      const err = await res.text().catch(() => `HTTP ${res.status}`)
      callbacks?.onError?.(err)
      throw new Error(err)
    }
    if (!res.body) {
      callbacks?.onError?.('no response body')
      throw new Error('no response body')
    }

    const { assistantMessage, stopReason } = await readStream(res.body, callbacks)
    messages = [...messages, assistantMessage]
    callbacks?.onMessageComplete?.(assistantMessage)

    if (stopReason !== 'tool_use') {
      // Agent is done — either ended with text or out of tools to call
      return messages
    }

    // Execute every tool_use block in the assistant message
    const toolUses = (assistantMessage.content as ContentBlock[]).filter(b => b.type === 'tool_use') as Extract<ContentBlock, { type: 'tool_use' }>[]
    const toolResultBlocks: ContentBlock[] = []
    for (const toolUse of toolUses) {
      const trace: ToolCallTrace = {
        id: toolUse.id,
        name: toolUse.name,
        input: toolUse.input,
        startedAt: Date.now(),
      }
      const result = await executeTool(toolUse.name, toolUse.input, ctx)
      trace.result = result
      trace.endedAt = Date.now()
      callbacks?.onToolResult?.(trace)
      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result.success ? JSON.stringify(result.output) : `error: ${result.error}`,
        is_error: !result.success,
      })
    }
    messages = [...messages, { role: 'user', content: toolResultBlocks }]
  }

  callbacks?.onError?.(`max turns (${maxTurns}) exceeded`)
  return messages
}

async function readStream(
  body: ReadableStream<Uint8Array>,
  callbacks?: AgentCallbacks,
): Promise<{ assistantMessage: AgentMessage; stopReason: string }> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let assistantMessage: AgentMessage | null = null
  let stopReason = 'end_turn'

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      let frame: { type: string; [k: string]: unknown }
      try { frame = JSON.parse(line) } catch { continue }

      switch (frame.type) {
        case 'text_delta':
          callbacks?.onText?.(String(frame.text ?? ''))
          break
        case 'tool_use_start':
          callbacks?.onToolUse?.({
            id: String(frame.id),
            name: String(frame.name),
            input: {},
            startedAt: Date.now(),
          })
          break
        case 'message_complete':
          assistantMessage = {
            role: 'assistant',
            content: frame.assistant_message as ContentBlock[],
          }
          stopReason = String(frame.stop_reason ?? 'end_turn')
          break
        case 'error':
          callbacks?.onError?.(String(frame.error ?? 'agent error'))
          throw new Error(String(frame.error ?? 'agent error'))
      }
    }
  }

  if (!assistantMessage) throw new Error('stream ended without message_complete')
  return { assistantMessage, stopReason }
}
