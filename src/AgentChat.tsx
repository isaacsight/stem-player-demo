/**
 * AgentChat — chat UI for the mixing-agent.
 *
 * Renders the conversation, streams text tokens as they arrive, surfaces
 * tool-use events live (so the user can watch the agent work), and gives
 * the user a text input to converse multi-turn.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { runAgent, type AgentMessage, type ToolCallTrace } from './agent-engine'
import type { AgentContext } from './agent-tools'

/**
 * Curated demo prompts shown in the empty state. Each one exercises a
 * different combination of agent capabilities — designed to show what
 * the system can do without the user having to know what to ask.
 */
const DEMO_PROMPTS = [
  {
    label: '🎚️ Downtempo lo-fi arrangement',
    prompt: 'Build me a downtempo lo-fi arrangement: solo keys for the first 4 seconds as intro, bring drums in at 4s with a lowpass filter at 1500Hz for vinyl warmth, full mix at 8s with subtle bitcrushing, breakdown at 14s with everything pulled back to 0.4. Add section labels.',
  },
  {
    label: '🔥 Festival drop',
    prompt: 'Make this a festival drop: build for 4 seconds with just drums + bass, then EVERYTHING IN at 4s with the lead pushed up to 1.0 and centered, drums loud and crispy. Add a "Drop" section label.',
  },
  {
    label: '🌫️ Underwater dream',
    prompt: 'Make everything sound underwater: lowpass filter at 600Hz on every stem, push reverb to 0.7 on lead and keys, pull volumes back, pan keys left and lead right. Subtle, dreamy.',
  },
  {
    label: '🎙️ Vocals-only breakdown',
    prompt: 'Schedule a 4-bar arrangement: full mix for the first 8s, then solo keys + lead for 4s as a breakdown, then full mix back. Add "Verse" "Breakdown" "Drop" labels.',
  },
  {
    label: '📞 Telephone effect',
    prompt: 'Make the lead sound like an old telephone: bandpass filter at 1500Hz Q=4, panned slightly right, with reverb send at 0.3.',
  },
  {
    label: '🔁 Loop the chorus',
    prompt: 'What is this and what should I do with it? Then pick the most energetic 2-second region and loop it.',
  },
]

type DisplayMessage = {
  role: 'user' | 'assistant'
  text: string                  // accumulated text content for display
  toolCalls: ToolCallTrace[]    // tool calls associated with this turn
  pending?: boolean
}

export default function AgentChat({
  ctxFactory,
  onArrangementCompleted,
}: {
  ctxFactory: () => AgentContext | null
  onArrangementCompleted?: () => void
}) {
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

  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
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

    let scheduledArrangement = false

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
            if (call.name === 'schedule_arrangement' && call.result?.success) {
              scheduledArrangement = true
            }
            setDisplay(prev => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last?.role === 'assistant') {
                const updatedCalls = last.toolCalls.map(t =>
                  t.id === call.id
                    ? { ...t, input: call.input, result: call.result, endedAt: call.endedAt }
                    : t,
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
      if (scheduledArrangement && onArrangementCompleted) {
        // brief delay so users see the agent's final message before audio kicks in
        setTimeout(() => onArrangementCompleted(), 600)
      }
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
            <div className="agent-hint-text">Ask the AI to mix and arrange this session. Try one of these:</div>
            <div className="agent-prompt-chips">
              {DEMO_PROMPTS.map(p => (
                <button
                  key={p.label}
                  className="agent-prompt-chip"
                  onClick={() => send(p.prompt)}
                  disabled={busy}
                  title={p.prompt}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="agent-hint-text muted">…or type your own prompt below.</div>
          </div>
        )}
        {display.map((msg, i) => (
          <div key={i} className={`agent-msg ${msg.role}`}>
            <div className="agent-msg-role">{msg.role === 'user' ? 'you' : 'agent'}</div>
            {msg.text && (
              <div className="agent-msg-text">
                {msg.role === 'assistant' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                ) : (
                  msg.text
                )}
              </div>
            )}
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
          <button onClick={() => send()} className="agent-send" disabled={!input.trim()}>Send</button>
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
