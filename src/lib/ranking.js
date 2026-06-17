export function buildRanking(users) {
  return users
    .map((u) => ({ ...u, total: (u.puntosGrupos || 0) + (u.puntosEliminatorias || 0) }))
    .sort((a, b) => b.total - a.total || a.alias.localeCompare(b.alias))
    .map((u, i) => ({ ...u, pos: i + 1 }))
}
