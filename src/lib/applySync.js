import { storage } from './storage.js'
import { recomputeGroupMatchForAllUsers } from './recalc.js'
import { canonicalTeam } from '../data/aliases.js'
import { MAX_MATCH_MS } from './matchState.js'

// Busca el partido del fixture que corresponde a un update de la fuente, comparando
// los equipos en forma canónica (independiente del idioma) y en cualquier orden.
// Devuelve { match, swapped } o null. swapped=true si el local/visitante vienen invertidos.
export function findFixture(matches, home, away) {
  const h = canonicalTeam(home)
  const a = canonicalTeam(away)
  if (!h || !a) return null
  for (const m of matches) {
    if (m.equipoA === h && m.equipoB === a) return { match: m, swapped: false }
    if (m.equipoA === a && m.equipoB === h) return { match: m, swapped: true }
  }
  return null
}

// updates: forma común [{ home, away, status, rA, rB, minuto, eventos }].
// Aplica estados, bloquea en vivo, registra finalizados (resultado + eventos) y
// recalcula los puntos de todos los usuarios. Devuelve { live, finished }.
export async function applySync(updates, now = Date.now()) {
  if (!updates) return { live: 0, finished: 0 }
  const matches = (await storage.get('matches')) || []
  let finished = 0

  for (const u of updates) {
    const found = findFixture(matches, u.home, u.away)
    if (!found) continue
    const { match: m, swapped } = found
    const rA = swapped ? u.rB : u.rA
    const rB = swapped ? u.rA : u.rB

    // Refina la hora del kickoff con el dato real de la fuente (las del fixture son
    // aproximadas). Así las apuestas se cierran respecto al horario verdadero.
    if (u.fecha) m.fecha = u.fecha

    if (u.status === 'live') {
      m.estado = 'en_vivo'
      m.resultadoA = rA
      m.resultadoB = rB
      m.minuto = u.minuto
      if (u.eventos?.length) await storage.set(`eventos_partido:${m.id}`, u.eventos)
    } else if (u.status === 'finished') {
      const wasProcessed = m.estado === 'finalizado'
      const scoreChanged = m.resultadoA !== rA || m.resultadoB !== rB
      m.estado = 'finalizado'
      m.resultadoA = rA
      m.resultadoB = rB
      m.minuto = u.minuto
      if (u.eventos?.length) await storage.set(`eventos_partido:${m.id}`, u.eventos)
      finished++
      // Recalcula al cerrar y también si llega un marcador corregido (p. ej. tras un
      // cierre por timeout con score viejo). recompute SET es idempotente.
      if ((!wasProcessed || scoreChanged) && rA != null && rB != null) {
        await recomputeGroupMatchForAllUsers(m.id, rA, rB)
      }
    }
  }

  // Red de seguridad: finaliza partidos que quedaron "en vivo" pasado el margen máximo
  // (fuente colgada en estado live o que dejó de reportarlos), con el último marcador.
  for (const m of matches) {
    if (
      m.estado === 'en_vivo' &&
      m.fecha &&
      m.resultadoA != null &&
      m.resultadoB != null &&
      Date.parse(m.fecha) + MAX_MATCH_MS < now
    ) {
      m.estado = 'finalizado'
      finished++
      await recomputeGroupMatchForAllUsers(m.id, m.resultadoA, m.resultadoB)
    }
  }

  // `live` = estado real tras la red de seguridad (decide el re-poll adaptativo).
  const live = matches.filter((m) => m.estado === 'en_vivo').length
  await storage.set('matches', matches)
  await storage.set('last_sync', new Date().toISOString())
  return { live, finished }
}
