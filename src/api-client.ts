/**
 * Frontend → backend client for the AI endpoints.
 *
 * All endpoints expect POST + JSON. Errors surface with a consistent shape
 * so the UI can render a useful message instead of a generic crash.
 */

import type { StemMeta, StemFeatures } from './analysis'

export type MixAction =
  | { type: 'mute'; stem: string; value: boolean }
  | { type: 'solo'; stem: string; value: boolean }
  | { type: 'volume'; stem: string; value: number }

export type MixSuggestion = {
  description: string
  suggestion: string
  actions: MixAction[]
}

export type MixSuggestRequest = {
  stems: StemMeta[]
  tempo: number | null
  beatCount: number
  totalDuration: number
}

export type AutoNameInference = {
  original: string
  inferredType: string
  confidence: number
}

export async function requestMixSuggestion(req: MixSuggestRequest): Promise<MixSuggestion> {
  const res = await fetch('/api/mix-suggest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<MixSuggestion>
}

export async function requestAutoName(stems: StemFeatures[]): Promise<AutoNameInference[]> {
  const res = await fetch('/api/auto-name', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stems }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  const out = await res.json() as { inferences: AutoNameInference[] }
  return out.inferences
}
