import { KO_MATCHES } from '../data/bracket.js'

// Deriva, para cada partido del árbol, sus equipos efectivos (teamA/teamB) y el ganador
// elegido por el usuario VALIDADO contra esos equipos (null si quedó inconsistente).
// KO_MATCHES viene ordenado por ronda ascendente, así que los hijos se resuelven antes.
export function resolveBracket(preds) {
  const pick = new Map((preds || []).map((p) => [p.matchId, p.ganador]))
  const resolved = {}
  for (const m of KO_MATCHES) {
    let teamA, teamB
    if (!m.children) {
      teamA = m.teamA
      teamB = m.teamB
    } else {
      teamA = resolved[m.children[0]]?.ganador ?? null
      teamB = resolved[m.children[1]]?.ganador ?? null
    }
    const chosen = pick.get(m.id) ?? null
    const ganador = chosen && (chosen === teamA || chosen === teamB) ? chosen : null
    resolved[m.id] = { teamA, teamB, ganador }
  }
  return resolved
}

// Setea (o limpia con ganador null) el ganador de un partido y poda los picks aguas
// arriba que dejaron de ser válidos. Preserva los demás campos de cada predicción.
export function setBracketPick(preds, matchId, ganador, userId) {
  let list = (preds || []).map((p) => ({ ...p }))
  const existing = list.find((p) => p.matchId === matchId)
  if (ganador) {
    if (existing) existing.ganador = ganador
    else list.push({ userId, matchId, ganador, puntos: null })
  } else {
    list = list.filter((p) => p.matchId !== matchId)
  }
  const resolved = resolveBracket(list)
  // conserva solo los picks que siguen siendo válidos tras la resolución/cascada
  return list.filter((p) => resolved[p.matchId]?.ganador === p.ganador)
}
