/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { load, save, listSavedKeys, type SessionState } from './persist'

describe('persist', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const sample: SessionState = {
    fileKey: 'test-key',
    stems: { drums: { muted: false, volume: 1, solo: false } },
    crusher: { on: true, bits: 4, reduction: 8 },
    beats: [0.5, 1.0, 1.5],
    tempo: 120,
  }

  it('round-trips state', () => {
    save(sample)
    const got = load('test-key')
    expect(got).toEqual(sample)
  })

  it('returns null for unknown keys', () => {
    expect(load('nope')).toBeNull()
  })

  it('namespaces keys with a versioned prefix', () => {
    save(sample)
    const rawKeys = Object.keys(localStorage)
    expect(rawKeys.some(k => k.startsWith('procreate-dryrun:v1:'))).toBe(true)
  })

  it('lists only this app\'s saved keys', () => {
    save(sample)
    save({ ...sample, fileKey: 'another' })
    localStorage.setItem('unrelated:foo', 'bar')
    const keys = listSavedKeys()
    expect(keys).toContain('test-key')
    expect(keys).toContain('another')
    expect(keys).not.toContain('unrelated:foo')
  })

  it('returns null on corrupted JSON', () => {
    localStorage.setItem('procreate-dryrun:v1:bad', 'not json')
    expect(load('bad')).toBeNull()
  })
})
