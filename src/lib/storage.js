// Uses the real Claude artifact window.storage when present (shared persistence).
// Falls back to a localStorage-backed dev shim for standalone/GitHub running and tests.
const hasArtifact =
  typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function'

let mem = {}

const shim = {
  async set(key, value) {
    const s = JSON.stringify(value)
    mem[key] = s
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('prode:' + key, s)
    } catch {
      /* ignore */
    }
  },
  async get(key) {
    let raw = mem[key]
    if (raw == null) {
      try {
        raw = typeof localStorage !== 'undefined' ? localStorage.getItem('prode:' + key) ?? undefined : undefined
      } catch {
        /* ignore */
      }
    }
    return raw == null ? null : JSON.parse(raw)
  },
}

export const storage = hasArtifact
  ? {
      async set(key, value, shared = true) {
        await window.storage.set(key, JSON.stringify(value), shared)
      },
      async get(key) {
        const d = await window.storage.get(key, true)
        return d ? JSON.parse(d.value) : null
      },
      _resetForTests() {},
    }
  : {
      ...shim,
      _resetForTests() {
        mem = {}
        try {
          localStorage?.clear()
        } catch {
          /* ignore */
        }
      },
    }
