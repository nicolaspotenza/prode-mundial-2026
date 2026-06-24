import { storage } from './storage.js'
import { FIXTURES } from '../data/fixtures.js'
import { ELIMINATION_MATCHES } from '../data/bracket.js'
import { recomputeUserTotals } from './recalc.js'

// Subir esta versión fuerza re-sembrar partidos/cuadro cuando cambia su estructura.
// Los pronósticos de grupos NO se tocan (van por matchId).
const SEED_VERSION = 3

// Siembra el storage compartido con los partidos y el cuadro hardcodeados.
// La sincronización luego actualiza estos registros con datos reales.
export async function ensureSeeded() {
  const version = await storage.get('seed_version')
  const matches = await storage.get('matches')
  const stale = version !== SEED_VERSION

  // NUNCA pisar matches/elimination_matches existentes: contienen resultados en vivo
  // acumulados por el sync. Un bump de SEED_VERSION NO debe destruir esos datos (si lo
  // hace, el próximo applySync ve todos los finalizados como "nuevos" y dispara un
  // recálculo masivo por usuario que cuelga la app). Solo se siembra lo que falta.
  if (!matches || matches.length === 0) {
    await storage.set('matches', FIXTURES.map((m) => ({ ...m })))
  }

  const ko = await storage.get('elimination_matches')
  if (!ko || ko.length === 0) {
    await storage.set('elimination_matches', ELIMINATION_MATCHES.map((m) => ({ ...m })))
  }

  if (stale) {
    // El modelo viejo de eliminatorias (slots `pos_`/`ko_*` con `slotId`) es incompatible
    // con el nuevo (por `matchId`). Descartamos esos pronósticos sin tocar los de grupos.
    let limpiado = false
    const users = (await storage.get('users')) || []
    for (const u of users) {
      const key = `pronosticos_eliminatorias:${u.alias}`
      const list = (await storage.get(key)) || []
      const cleaned = list.filter((p) => p.matchId)
      if (cleaned.length !== list.length) {
        await storage.set(key, cleaned)
        limpiado = true
      }
    }
    if (limpiado) await recomputeUserTotals()
    await storage.set('seed_version', SEED_VERSION)
  }
}
