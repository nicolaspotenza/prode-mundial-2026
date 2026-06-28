import { KO_MATCHES } from '../data/bracket.js'

// Deriva, para cada partido del árbol, sus equipos efectivos (teamA/teamB) y el ganador
// elegido por el usuario VALIDADO contra esos equipos (null si quedó inconsistente).
//
// Overlay de realidad: `realById` (Map matchId→ganador real) hace que el equipo que AVANZA
// de cada hijo sea el real si ya se conoce, y si no el pick del usuario. Así, apenas un cruce
// se resuelve en la realidad, la casilla superior se actualiza y un pick que apuntaba al
// equipo eliminado queda inválido (ganador null) para re-predecir. El `ganador` propio de
// cada cruce NO se fuerza al real: se puntúa aparte (calcularPuntosEliminatoria).
//
// KO_MATCHES viene ordenado por ronda ascendente, así que los hijos se resuelven antes.
export function resolveBracket(preds, realById = new Map()) {
  const pick = new Map((preds || []).map((p) => [p.matchId, p.ganador]))
  const resolved = {}
  // Equipo que avanza de un cruce a su padre: el real si se conoce, si no el pick validado.
  const avanza = (id) => (realById.get(id) ?? resolved[id]?.ganador) ?? null
  // Perdedor de un cruce (para el 3.º puesto): requiere ambos equipos y un avanzado conocido.
  const perdedor = (id) => {
    const r = resolved[id]
    const win = avanza(id)
    if (!r || !r.teamA || !r.teamB || !win) return null
    return win === r.teamA ? r.teamB : r.teamA
  }
  for (const m of KO_MATCHES) {
    let teamA, teamB
    if (!m.children) {
      teamA = m.teamA
      teamB = m.teamB
    } else if (m.esTercerPuesto) {
      teamA = perdedor(m.children[0])
      teamB = perdedor(m.children[1])
    } else {
      teamA = avanza(m.children[0])
      teamB = avanza(m.children[1])
    }
    const chosen = pick.get(m.id) ?? null
    const ganador = chosen && (chosen === teamA || chosen === teamB) ? chosen : null
    resolved[m.id] = { teamA, teamB, ganador }
  }
  return resolved
}

// Setea (o limpia con ganador null) el ganador de un partido y poda los picks aguas arriba
// que dejaron de ser válidos (considerando el overlay real). Preserva los demás campos.
export function setBracketPick(preds, matchId, ganador, userId, realById = new Map()) {
  let list = (preds || []).map((p) => ({ ...p }))
  const existing = list.find((p) => p.matchId === matchId)
  if (ganador) {
    if (existing) existing.ganador = ganador
    else list.push({ userId, matchId, ganador, puntos: null })
  } else {
    list = list.filter((p) => p.matchId !== matchId)
  }
  const resolved = resolveBracket(list, realById)
  return list.filter((p) => resolved[p.matchId]?.ganador === p.ganador)
}
