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
  // Si hay una key de API/footaball-data configurada, esa fuente pasa a ser primaria
  // (cobertura completa). Si no, se usa la fuente principal por defecto (TheSportsDB).
  const preferred = DATA_CONFIG.apiFootballKey
    ? 'api-football'
    : DATA_CONFIG.footballDataKey
      ? 'football-data'
      : DATA_CONFIG.primarySource
  const order = [preferred, 'thesportsdb', 'api-football', 'football-data', 'promiedos']
  return [...new Set(order)].map((k) => map[k]).filter(Boolean)
}
