import { DATA_CONFIG } from '../../config.js'
import { fetchSportsDB } from './thesportsdb.js'
import { fetchPromiedos } from './promiedos.js'
import { fetchApiFootball } from './apiFootball.js'
import { fetchFootballData } from './footballData.js'

// Cada fuente devuelve: Array<{ promiedosId, status, rA, rB, minuto, eventos }> | null.
// Recorre las fuentes en orden y devuelve el primer resultado no nulo (degradación silenciosa).
export async function syncWithSources(sources) {
  for (const src of sources) {
    try {
      const r = await src()
      if (r) return r
    } catch {
      /* degrade silently */
    }
  }
  return null
}

export function defaultSources() {
  const map = {
    thesportsdb: fetchSportsDB,
    promiedos: fetchPromiedos,
    'api-football': fetchApiFootball,
    'football-data': fetchFootballData,
  }
  const order = [DATA_CONFIG.primarySource, 'thesportsdb', 'api-football', 'football-data', 'promiedos']
  return [...new Set(order)].map((k) => map[k]).filter(Boolean)
}
