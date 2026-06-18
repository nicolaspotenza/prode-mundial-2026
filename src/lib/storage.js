// Adaptador de persistencia con tres modos, en orden de preferencia:
// 1. window.storage del artifact de Claude (compartido entre usuarios).
// 2. API remota /api/storage (Upstash Redis) en producción → ranking compartido real.
// 3. Shim sobre localStorage para desarrollo local y tests (por dispositivo).
//
// Clave: el parámetro `shared`. Las claves con `shared: false` (p. ej. `current_user`)
// son DEVICE-LOCAL: cada dispositivo guarda su propio alias y NUNCA viajan al backend
// compartido. Si no, todos los celulares verían el mismo alias y los mismos datos.
const hasArtifact =
  typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function'

const isProd =
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD === true

let mem = {}

// Almacén device-local: localStorage con prefijo `prode:` (con respaldo en memoria para
// entornos sin localStorage). Es también el shim de desarrollo/tests.
const local = {
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

const shim = {
  async set(key, value) {
    await local.set(key, value)
  },
  async get(key) {
    return local.get(key)
  },
  _resetForTests() {
    mem = {}
    try {
      localStorage?.clear()
    } catch {
      /* ignore */
    }
  },
}

const artifact = {
  async set(key, value, shared = true) {
    await window.storage.set(key, JSON.stringify(value), shared)
  },
  async get(key, shared = true) {
    const d = await window.storage.get(key, shared)
    return d ? JSON.parse(d.value) : null
  },
  _resetForTests() {},
}

// Cliente de la API remota (Upstash vía función serverless). Inyectable para tests.
// Si el backend no está configurado o no responde, degrada al `fallback` local (shim)
// para que la app siga funcionando por dispositivo hasta conectar Upstash.
// Las claves device-local (`shared: false`) van siempre al almacén local, nunca al backend.
export function createRemoteStorage(fetchImpl = fetch, base = '/api/storage', fallback = null) {
  return {
    async set(key, value, shared = true) {
      if (!shared) return local.set(key, value)
      try {
        const r = await fetchImpl(base, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key, value }),
        })
        if (r && r.ok) return
      } catch {
        /* cae al fallback */
      }
      if (fallback) await fallback.set(key, value)
    },
    async get(key, shared = true) {
      if (!shared) return local.get(key)
      try {
        const r = await fetchImpl(`${base}?key=${encodeURIComponent(key)}`)
        if (r && r.ok) {
          const d = await r.json()
          return d && d.value != null ? d.value : null
        }
      } catch {
        /* cae al fallback */
      }
      return fallback ? fallback.get(key) : null
    },
    _resetForTests() {},
  }
}

export const storage = hasArtifact ? artifact : isProd ? createRemoteStorage(fetch, '/api/storage', shim) : shim
