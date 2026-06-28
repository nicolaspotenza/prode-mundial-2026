import { storage } from './storage.js'
import { setBracketPick } from './bracket.js'

export async function getGroupPredictions(alias) {
  return (await storage.get(`pronosticos_grupos:${alias}`)) || []
}

export async function setGroupPrediction(alias, matchId, pronosticoA, pronosticoB) {
  const list = await getGroupPredictions(alias)
  let p = list.find((x) => x.matchId === matchId)
  if (!p) {
    p = { userId: alias, matchId, pronosticoA: null, pronosticoB: null, puntos: null }
    list.push(p)
  }
  p.pronosticoA = pronosticoA
  p.pronosticoB = pronosticoB
  await storage.set(`pronosticos_grupos:${alias}`, list)
  return list
}

// Apuestas de los demás jugadores para un partido de grupos (alias + marcador + puntos).
// Excluye al usuario actual y omite a quienes no cargaron un marcador para ese partido.
export async function getOthersGroupPredictions(matchId, excludeAlias) {
  const users = (await storage.get('users')) || []
  const exclude = excludeAlias?.toLowerCase()
  const out = []
  for (const u of users) {
    if (exclude && u.alias.toLowerCase() === exclude) continue
    const list = (await storage.get(`pronosticos_grupos:${u.alias}`)) || []
    const p = list.find((x) => x.matchId === matchId)
    if (p && p.pronosticoA != null && p.pronosticoB != null) {
      out.push({ alias: u.alias, pronosticoA: p.pronosticoA, pronosticoB: p.pronosticoB, puntos: p.puntos })
    }
  }
  return out
}

export async function getKnockoutPredictions(alias) {
  return (await storage.get(`pronosticos_eliminatorias:${alias}`)) || []
}

export async function setKnockoutPrediction(alias, matchId, ganador) {
  const list = await getKnockoutPredictions(alias)
  const elim = (await storage.get('elimination_matches')) || []
  const realById = new Map(elim.map((m) => [m.id, m.ganador]))
  const next = setBracketPick(list, matchId, ganador || null, alias, realById)
  await storage.set(`pronosticos_eliminatorias:${alias}`, next)
  return next
}
