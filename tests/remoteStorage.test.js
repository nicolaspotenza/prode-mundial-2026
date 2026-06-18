import { describe, it, expect, vi } from 'vitest'
import { createRemoteStorage } from '../src/lib/storage.js'

describe('createRemoteStorage', () => {
  it('set POSTs key+value as JSON to the API', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }))
    const remote = createRemoteStorage(fetchImpl, '/api/storage')
    await remote.set('users', [{ alias: 'Ana' }])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/storage')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ key: 'users', value: [{ alias: 'Ana' }] })
  })

  it('get returns the parsed value from the API', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ value: [{ alias: 'Ana', total: 10 }] }) }))
    const remote = createRemoteStorage(fetchImpl, '/api/storage')
    const out = await remote.get('users')
    expect(out).toEqual([{ alias: 'Ana', total: 10 }])
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/storage?key=users')
  })

  it('get returns null when the API responds non-ok', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => ({}) }))
    const remote = createRemoteStorage(fetchImpl, '/api/storage')
    expect(await remote.get('users')).toBeNull()
  })

  it('get returns null when value is missing', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ value: null }) }))
    const remote = createRemoteStorage(fetchImpl, '/api/storage')
    expect(await remote.get('nope')).toBeNull()
  })

  it('get falls back to the local store when the backend is unavailable', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => ({}) }))
    const fallback = makeMemFallback({ users: [{ alias: 'Local' }] })
    const remote = createRemoteStorage(fetchImpl, '/api/storage', fallback)
    expect(await remote.get('users')).toEqual([{ alias: 'Local' }])
  })

  it('set falls back to the local store when the backend is unavailable', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => ({}) }))
    const fallback = makeMemFallback()
    const remote = createRemoteStorage(fetchImpl, '/api/storage', fallback)
    await remote.set('users', [{ alias: 'Local' }])
    expect(await fallback.get('users')).toEqual([{ alias: 'Local' }])
  })

  it('set does not touch the local fallback when the backend succeeds', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }))
    const fallback = makeMemFallback()
    const remote = createRemoteStorage(fetchImpl, '/api/storage', fallback)
    await remote.set('users', [{ alias: 'Remote' }])
    expect(await fallback.get('users')).toBeNull()
  })
})

function makeMemFallback(seed = {}) {
  const m = { ...seed }
  return {
    async get(k) {
      return k in m ? m[k] : null
    },
    async set(k, v) {
      m[k] = v
    },
  }
}
