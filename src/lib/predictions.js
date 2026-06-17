import { storage } from './storage.js'

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

export async function getKnockoutPredictions(alias) {
  return (await storage.get(`pronosticos_eliminatorias:${alias}`)) || []
}

export async function setKnockoutPrediction(alias, slotId, equipoElegido) {
  const list = await getKnockoutPredictions(alias)
  let p = list.find((x) => x.slotId === slotId)
  if (!p) {
    p = { userId: alias, slotId, equipoElegido: null, puntos: null }
    list.push(p)
  }
  p.equipoElegido = equipoElegido
  await storage.set(`pronosticos_eliminatorias:${alias}`, list)
  return list
}
