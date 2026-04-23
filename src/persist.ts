/**
 * Per-file localStorage persistence.
 *
 * The architectural bet: agentic systems and creative tools both compound
 * by remembering the user's specific work. K:BOT remembers session patterns;
 * this app remembers per-file mix decisions. Same shape, different domain.
 */

export type StemState = {
  muted: boolean
  volume: number
  solo: boolean
}

export type SessionState = {
  fileKey: string
  stems: Record<string, StemState>
  crusher: { on: boolean; bits: number; reduction: number }
  beats?: number[]
  tempo?: number
}

const PREFIX = 'procreate-dryrun:v1:'

/** SHA-256-based file key — first 16 hex chars from buffer + size. */
export async function fileKey(file: File): Promise<string> {
  const ab = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', ab)
  const bytes = new Uint8Array(digest).slice(0, 8)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/** Stable key for a *set* of stem files: hash of sorted concatenated names + sizes. */
export async function stemSetKey(files: File[]): Promise<string> {
  const meta = files
    .map(f => `${f.name}:${f.size}`)
    .sort()
    .join('|')
  const data = new TextEncoder().encode(meta)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest).slice(0, 8)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export function load(key: string): SessionState | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function save(state: SessionState) {
  try {
    localStorage.setItem(PREFIX + state.fileKey, JSON.stringify(state))
  } catch {
    // Quota exceeded or storage disabled — silently fail (user can still use the app)
  }
}

export function listSavedKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(PREFIX)) keys.push(k.slice(PREFIX.length))
  }
  return keys
}
