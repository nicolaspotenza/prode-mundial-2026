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
