/**
 * AgentChat — chat UI for the mixing-agent.
 *
 * Renders the conversation, streams text tokens as they arrive, surfaces
 * tool-use events live (so the user can watch the agent work), and gives
 * the user a text input to converse multi-turn.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { runAgent, type AgentMessage, type ToolCallTrace } from './agent-engine'
import type { AgentContext } from './agent-tools'

type DisplayMessage = {
  role: 'user' | 'assistant'
  text: string                  // accumulated text content for display
  toolCalls: ToolCallTrace[]    // tool calls associated with this turn
  pending?: boolean
}

export default function AgentChat({ ctxFactory }: { ctxFactory: () => AgentContext | null }) {
  const [conversation, setConversation] = useState<AgentMessage[]>([])
  const [display, setDisplay] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on update
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [display])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text) return
    const ctx = ctxFactory()
    if (!ctx) {
      setError('Load a session first.')
      return
    }
    setInput('')
    setError('')
    setBusy(true)

    const userMsg: AgentMessage = { role: 'user', content: text }
    const userDisplay: DisplayMessage = { role: 'user', text, toolCalls: [] }
    const placeholderDisplay: DisplayMessage = { role: 'assistant', text: '', toolCalls: [], pending: true }
    setDisplay(prev => [...prev, userDisplay, placeholderDisplay])

    const ac = new AbortController()
    abortRef.current = ac

    try {
      const updated = await runAgent({
        messages: [...conversation, userMsg],
        sessionSnapshot: () => snapshotFromCtx(ctxFactory() ?? ctx),
        ctx,
        signal: ac.signal,
        callbacks: {
          onText: (delta) => {
            setDisplay(prev => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, text: last.text + delta, pending: true }
              }
              return next
            })
          },
          onToolUse: (call) => {
            setDisplay(prev => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, toolCalls: [...last.toolCalls, call] }
              }
              return next
            })
          },
          onToolResult: (call) => {
            setDisplay(prev => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last?.role === 'assistant') {
                const updatedCalls = last.toolCalls.map(t =>
                  t.id === call.id ? { ...t, result: call.result, endedAt: call.endedAt } : t,
                )
                next[next.length - 1] = { ...last, toolCalls: updatedCalls }
              }
              return next
            })
          },
          onMessageComplete: () => {
            // If more turns coming (tool calls in progress), append a new placeholder
            setDisplay(prev => {
              const last = prev[prev.length - 1]
              if (last?.role !== 'assistant') return prev
              return [...prev.slice(0, -1), { ...last, pending: false }]
            })
          },
          onError: (msg) => setError(msg),
        },
      })
      setConversation(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'agent failed')
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }, [conversation, ctxFactory, input])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setBusy(false)
  }, [])

  const reset = useCallback(() => {
    cancel()
    setConversation([])
    setDisplay([])
    setError('')
  }, [cancel])

  return (
    <div className="agent-panel">
      <div className="agent-header">
        <span className="agent-title">✨ Mixing Engineer</span>
        {conversation.length > 0 && (
          <button className="agent-reset" onClick={reset}>reset</button>
        )}
      </div>

      <div className="agent-scroll" ref={scrollRef}>
        {display.length === 0 && (
          <div className="agent-hint">
            Ask the AI to mix this session. Examples:
            <ul>
              <li>"Make this sound like a downtempo lo-fi mix"</li>
              <li>"Solo just the drums and bass for a breakdown"</li>
              <li>"What is this and what should I do with it?"</li>
              <li>"Push the lead, pull the keys back, add subtle bitcrushing"</li>
            </ul>
          </div>
        )}
        {display.map((msg, i) => (
          <div key={i} className={`agent-msg ${msg.role}`}>
            <div className="agent-msg-role">{msg.role === 'user' ? 'you' : 'agent'}</div>
            {msg.text && <div className="agent-msg-text">{msg.text}</div>}
            {msg.toolCalls.length > 0 && (
              <div className="agent-tools">
                {msg.toolCalls.map(call => (
                  <div key={call.id} className={'agent-tool ' + (call.result?.success === false ? 'err' : call.result ? 'ok' : 'pending')}>
                    <code>{call.name}({formatArgs(call.input)})</code>
                    {call.result?.success === false && <span className="agent-tool-err"> — {call.result.error}</span>}
                  </div>
                ))}
              </div>
            )}
            {msg.pending && msg.text === '' && msg.toolCalls.length === 0 && (
              <div className="agent-msg-text muted">…</div>
            )}
          </div>
        ))}
        {error && <div className="agent-error">⚠ {error}</div>}
      </div>

      <div className="agent-input">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() }
          }}
          placeholder="Ask the mixing engineer… (⌘↩ to send)"
          disabled={busy}
          rows={2}
        />
        {busy ? (
          <button onClick={cancel} className="agent-send cancel">Cancel</button>
        ) : (
          <button onClick={send} className="agent-send" disabled={!input.trim()}>Send</button>
        )}
      </div>
    </div>
  )
}

function formatArgs(input: Record<string, unknown>): string {
  const entries = Object.entries(input)
  if (entries.length === 0) return ''
  return entries.map(([k, v]) => `${k}=${formatArg(v)}`).join(', ')
}
function formatArg(v: unknown): string {
  if (typeof v === 'string') return `"${v}"`
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
  return JSON.stringify(v)
}

function snapshotFromCtx(ctx: AgentContext): Record<string, unknown> {
  return {
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
  }
}
