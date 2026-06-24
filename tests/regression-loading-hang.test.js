import { describe, it, expect } from 'vitest'
import { createRemoteStorage } from '../src/lib/storage.js'
import { ensureSeeded } from '../src/lib/seed.js'

// Regresión del cuelgue de carga (skeleton infinito). La cadena que lo causaba:
//   1. storage.get('matches') devolvía null por un fallo transitorio del backend remoto
//      (el adaptador cae al shim local vacío).
//   2. ensureSeeded interpretaba ese null como "faltan los partidos" y re-sembraba el
//      fixture en blanco, PISANDO los resultados compartidos en el backend.
//   3. El siguiente applySync veía decenas de finalizados "nuevos" → recálculo masivo por
//      usuario que nunca convergía → tick nunca se seteaba → carga colgada.
// Este test reproduce (1) con el adaptador remoto real y verifica que (2) ya no ocurre.

// Backend tipo Upstash en memoria, accedido a través del adaptador remoto real. `failGetKeys`
// simula un fallo transitorio en el GET de esas claves (fetch que rechaza → fallback vacío).
function makeBackendStore({ backend, failGetKeys = new Set() }) {
  const emptyLocalFallback = (() => {
    const m = {}
    return { async get(k) { return k in m ? m[k] : null }, async set(k, v) { m[k] = v } }
  })()
  const fetchImpl = async (url, opts) => {
    if (!opts || opts.method !== 'POST') {
      const key = decodeURIComponent(String(url).split('key=')[1] || '')
      if (failGetKeys.has(key)) throw new Error('backend transitorio caído')
      return { ok: true, json: async () => ({ value: key in backend ? backend[key] : null }) }
    }
    const { key, value } = JSON.parse(opts.body)
    backend[key] = value
    return { ok: true, json: async () => ({ ok: true }) }
  }
  return createRemoteStorage(fetchImpl, '/api/storage', emptyLocalFallback)
}

describe('regresión: el cuelgue de carga (matches wipe) no vuelve a pasar', () => {
  it('NO re-siembra matches cuando el backend ya está inicializado y el read falla (transitorio)', async () => {
    const backend = {
      seed_version: 3, // backend ya inicializado
      matches: [
        { id: 'g_A_0', estado: 'finalizado', resultadoA: 2, resultadoB: 0 },
        { id: 'g_A_1', estado: 'finalizado', resultadoA: 1, resultadoB: 1 },
      ],
      elimination_matches: [{ id: 'ko_final_1', ganador: 'Argentina' }],
      users: [{ alias: 'Ana', puntosGrupos: 30, puntosEliminatorias: 0, totalPuntos: 30 }],
    }
    // los GET de matches/elimination_matches fallan transitoriamente (devuelven null)
    const store = makeBackendStore({ backend, failGetKeys: new Set(['matches', 'elimination_matches']) })

    await ensureSeeded(store)

    // los resultados del backend siguen intactos: NO se pisaron con el fixture en blanco
    expect(backend.matches).toHaveLength(2)
    expect(backend.matches.every((m) => m.estado === 'finalizado')).toBe(true)
    expect(backend.elimination_matches).toEqual([{ id: 'ko_final_1', ganador: 'Argentina' }])
    expect(backend.seed_version).toBe(3)
  })

  it('en el PRIMER arranque (backend sin seed_version) sí siembra matches y elimination_matches', async () => {
    const backend = {} // primer arranque real
    const store = makeBackendStore({ backend })

    await ensureSeeded(store)

    expect(backend.matches).toHaveLength(72)
    expect(backend.elimination_matches).toHaveLength(31)
    expect(backend.seed_version).toBe(3)
  })

  it('es idempotente: múltiples corridas sobre un backend inicializado nunca pisan matches', async () => {
    const original = [{ id: 'g_A_0', estado: 'finalizado', resultadoA: 3, resultadoB: 1 }]
    const backend = { seed_version: 3, matches: original, users: [] }
    const store = makeBackendStore({ backend })

    await ensureSeeded(store)
    await ensureSeeded(store)
    await ensureSeeded(store)

    expect(backend.matches).toBe(original) // misma referencia: nunca se reescribió
  })
})
