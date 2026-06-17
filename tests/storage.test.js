import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'

beforeEach(() => storage._resetForTests())

describe('storage adapter (dev shim)', () => {
  it('set then get returns parsed value', async () => {
    await storage.set('k', { a: 1 }, true)
    expect(await storage.get('k')).toEqual({ a: 1 })
  })
  it('missing key returns null', async () => {
    expect(await storage.get('missing')).toBeNull()
  })
})
