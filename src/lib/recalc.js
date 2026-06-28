import { storage } from './storage.js'
import { calcularPuntosGrupos, calcularPuntosEliminatoria } from './scoring.js'

export async function recomputeGroupMatchForAllUsers(matchId, rA, rB) {
  const users = (await storage.get('users')) || []
  for (const u of users) {
    const key = `pronosticos_grupos:${u.alias}`
    const list = (await storage.get(key)) || []
    const p = list.find((x) => x.matchId === matchId)
    if (p) {
      p.puntos = calcularPuntosGrupos(p.pronosticoA, p.pronosticoB, rA, rB)
      await storage.set(key, list)
    }
  }
  await recomputeUserTotals()
}

export async function recomputeMatchForAllUsers(matchId, ganadorReal) {
  const users = (await storage.get('users')) || []
  for (const u of users) {
    const key = `pronosticos_eliminatorias:${u.alias}`
    const list = (await storage.get(key)) || []
    const p = list.find((x) => x.matchId === matchId)
    if (p) {
      p.puntos = calcularPuntosEliminatoria(p.ganador, ganadorReal)
      await storage.set(key, list)
    }
  }
  await recomputeUserTotals()
}

// Recálculo de eliminatorias en UNA sola pasada O(usuarios). Recibe { matchId: ganadorReal }
// de los cruces que cambiaron en este sync. Escribe el pronóstico de un usuario solo si su
// puntaje cambió (idempotente) y recalcula totales UNA vez al final. Si no hay cambios, no
// hace nada. Esta forma de un-solo-paso es la que evita el "storm" (no es O(cruces×usuarios)).
export async function recomputeKnockoutForAllUsers(winnersById, store = storage) {
  if (!winnersById || Object.keys(winnersById).length === 0) return
  const users = (await store.get('users')) || []
  for (const u of users) {
    const key = `pronosticos_eliminatorias:${u.alias}`
    const list = (await store.get(key)) || []
    let changed = false
    for (const p of list) {
      if (Object.prototype.hasOwnProperty.call(winnersById, p.matchId)) {
        const pts = calcularPuntosEliminatoria(p.ganador, winnersById[p.matchId])
        if (pts !== p.puntos) {
          p.puntos = pts
          changed = true
        }
      }
    }
    if (changed) await store.set(key, list)
  }
  await recomputeUserTotals(store)
}

export async function recomputeUserTotals(store = storage) {
  const users = (await store.get('users')) || []
  for (const u of users) {
    const g = (await store.get(`pronosticos_grupos:${u.alias}`)) || []
    const e = (await store.get(`pronosticos_eliminatorias:${u.alias}`)) || []
    u.puntosGrupos = g.reduce((s, p) => s + (p.puntos || 0), 0)
    u.puntosEliminatorias = e.reduce((s, p) => s + (p.puntos || 0), 0)
    u.totalPuntos = u.puntosGrupos + u.puntosEliminatorias + (u.bonus || 0)
  }
  await store.set('users', users)
  return users
}
