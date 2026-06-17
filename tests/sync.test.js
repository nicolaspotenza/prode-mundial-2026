import { describe, it, expect, vi } from 'vitest'
import { syncWithSources } from '../src/lib/sources/index.js'

describe('syncWithSources fallback chain', () => {
  it('falls back to next source when primary returns null', async () => {
    const primary = vi.fn().mockResolvedValue(null)
    const fallback = vi.fn().mockResolvedValue([{ promiedosId: 'a', status: 'finished', rA: 1, rB: 0 }])
    const out = await syncWithSources([primary, fallback])
    expect(primary).toHaveBeenCalled()
    expect(fallback).toHaveBeenCalled()
    expect(out).toHaveLength(1)
  })
  it('returns null if all sources fail', async () => {
    const out = await syncWithSources([
      vi.fn().mockResolvedValue(null),
      vi.fn().mockRejectedValue(new Error('x')),
    ])
    expect(out).toBeNull()
  })
})
