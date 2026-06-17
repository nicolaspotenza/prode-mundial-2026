import { storage } from './storage.js'
import { recomputeGroupMatchForAllUsers } from './recalc.js'

// updates: forma común de syncWithSources. Aplica estados, bloquea partidos en vivo,
// registra finalizados (resultado + eventos) y recalcula puntos de todos los usuarios.
// Devuelve { live, finished } (cantidades).
export async function applySync(updates) {
  if (!updates) return { live: 0, finished: 0 }
  const matches = (await storage.get('matches')) || []
  const byPid = Object.fromEntries(matches.map((m) => [m.promiedosId, m]))
  let live = 0
  let finished = 0

  for (const u of updates) {
    const m = byPid[u.promiedosId]
    if (!m) continue
    if (u.status === 'live') {
      m.estado = 'en_vivo'
      m.resultadoA = u.rA
      m.resultadoB = u.rB
      m.minuto = u.minuto
      if (u.eventos) await storage.set(`eventos_partido:${m.id}`, u.eventos)
      live++
    } else if (u.status === 'finished') {
      const wasProcessed = m.estado === 'finalizado'
      m.estado = 'finalizado'
      m.resultadoA = u.rA
      m.resultadoB = u.rB
      m.minuto = u.minuto
      if (u.eventos) await storage.set(`eventos_partido:${m.id}`, u.eventos)
      finished++
      if (!wasProcessed) await recomputeGroupMatchForAllUsers(m.id, u.rA, u.rB)
    }
  }
  await storage.set('matches', matches)
  await storage.set('last_sync', new Date().toISOString())
  return { live, finished }
}
