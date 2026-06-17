export function computeStandings(teams, matches) {
  const row = (equipo) => ({ equipo, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 })
  const t = Object.fromEntries(teams.map((n) => [n, row(n)]))
  for (const m of matches) {
    if (m.estado !== 'finalizado') continue
    if (!(m.equipoA in t) || !(m.equipoB in t)) continue
    const a = t[m.equipoA]
    const b = t[m.equipoB]
    a.pj++; b.pj++
    a.gf += m.resultadoA; a.gc += m.resultadoB
    b.gf += m.resultadoB; b.gc += m.resultadoA
    if (m.resultadoA > m.resultadoB) { a.g++; b.p++; a.pts += 3 }
    else if (m.resultadoA < m.resultadoB) { b.g++; a.p++; b.pts += 3 }
    else { a.e++; b.e++; a.pts++; b.pts++ }
  }
  return Object.values(t)
    .map((r) => ({ ...r, dg: r.gf - r.gc }))
    .sort((x, y) => y.pts - x.pts || y.dg - x.dg || y.gf - x.gf || x.equipo.localeCompare(y.equipo))
}
