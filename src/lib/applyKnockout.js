import { storage } from './storage.js'
import { KO_MATCHES } from '../data/bracket.js'
import { canonicalTeam } from '../data/aliases.js'
import { resolveBracket } from './bracket.js'
import { recomputeKnockoutForAllUsers } from './recalc.js'
import { deriveEstado } from './matchState.js'

// Ganador de un partido de eliminatorias. Solo importa el ganador, no los goles.
// Prioridad: el equipo que la fuente marca como avanzado (incl. penales) → más goles.
// Empate sin avanzado conocido → null (queda pendiente y se reintenta el próximo sync).
export function winnerOf(u, teamA, teamB) {
  if (u.ganador) {
    const g = canonicalTeam(u.ganador)
    if (g === teamA || g === teamB) return g
  }
  if (u.rA == null || u.rB == null) return null
  if (u.rA > u.rB) return teamA
  if (u.rB > u.rA) return teamB
  return null
}

// Indexa los updates por par de equipos canónico (ambos órdenes), de cualquier estado.
function byPair(updates) {
  const idx = new Map()
  for (const u of updates || []) {
    const h = canonicalTeam(u.home)
    const a = canonicalTeam(u.away)
    if (!h || !a) continue
    idx.set(`${h}|${a}`, u)
    idx.set(`${a}|${h}`, u) // par invertido
  }
  return idx
}

// Detecta ganadores reales de eliminatorias desde la fuente. Resuelve el cuadro REAL de abajo
// hacia arriba (resolveBracket con realById), matchea cada cruce con equipos definidos contra
// un partido finalizado, e itera hasta estabilizar (un cruce resuelto revela el siguiente).
// Además captura estado/fecha/minuto/marcador de cada cruce (para mostrarlos en el cuadro como
// en Home), lo que NO afecta puntos. Persiste elimination_matches ANTES de recalcular y dispara
// UNA pasada de recálculo solo cuando cambió algún ganador.
export async function applyKnockout(updates, store = storage) {
  const elim = (await store.get('elimination_matches')) || []
  // Guard anti-pisado: read vacío (fallo transitorio) no debe borrar el cuadro compartido.
  if (elim.length === 0) return { resolved: [] }
  if (!updates || updates.length === 0) return { resolved: [] }

  const realById = new Map(elim.map((m) => [m.id, m.ganador]))
  const idx = byPair(updates)
  const newWinners = {}

  // Detección de ganadores: SOLO partidos finalizados. Itera hasta estabilizar.
  let changed = true
  while (changed) {
    changed = false
    const resolved = resolveBracket([], realById) // cuadro REAL (sin picks de usuario)
    for (const m of KO_MATCHES) {
      if (realById.get(m.id)) continue // ya resuelto
      const r = resolved[m.id]
      if (!r || !r.teamA || !r.teamB) continue // participantes aún no definidos
      const u = idx.get(`${r.teamA}|${r.teamB}`)
      if (!u || u.status !== 'finished') continue
      // Los goles del update son de home/away; orientarlos al orden del cruce (rA↔teamA)
      // para que winnerOf compare bien (mismo patrón `swapped` que applySync).
      const swapped = canonicalTeam(u.home) !== r.teamA
      const norm = swapped ? { ...u, rA: u.rB, rB: u.rA } : u
      const win = winnerOf(norm, r.teamA, r.teamB)
      if (!win) continue // empate sin avanzado → pendiente
      realById.set(m.id, win)
      newWinners[m.id] = win
      changed = true
    }
  }

  // Pase de metadatos: estado/fecha/minuto/marcador de cada cruce cuyos equipos ya se conocen
  // (programado/en vivo/finalizado), para mostrarlos arriba de cada cruce como en Home. No
  // dispara recálculo (no afecta puntos).
  const elimById = new Map(elim.map((m) => [m.id, m]))
  const resolvedFinal = resolveBracket([], realById)
  let metaChanged = false
  for (const m of KO_MATCHES) {
    const r = resolvedFinal[m.id]
    if (!r || !r.teamA || !r.teamB) continue
    const u = idx.get(`${r.teamA}|${r.teamB}`)
    if (!u) continue
    const rec = elimById.get(m.id)
    if (!rec) continue
    const swapped = canonicalTeam(u.home) !== r.teamA
    const estado = deriveEstado({ status: u.status })
    const fecha = u.fecha ?? rec.fecha ?? null
    const minuto = u.minuto ?? null
    const resultadoA = swapped ? (u.rB ?? null) : (u.rA ?? null)
    const resultadoB = swapped ? (u.rA ?? null) : (u.rB ?? null)
    if (
      rec.estado !== estado ||
      rec.fecha !== fecha ||
      rec.minuto !== minuto ||
      rec.resultadoA !== resultadoA ||
      rec.resultadoB !== resultadoB
    ) {
      rec.estado = estado
      rec.fecha = fecha
      rec.minuto = minuto
      rec.resultadoA = resultadoA
      rec.resultadoB = resultadoB
      metaChanged = true
    }
  }

  // Aplicar los ganadores nuevos a los registros.
  for (const m of elim) {
    if (newWinners[m.id]) m.ganador = newWinners[m.id]
  }

  const ids = Object.keys(newWinners)
  if (ids.length === 0 && !metaChanged) return { resolved: [] }

  // Persistir el cuadro real PRIMERO (antes de tocar a los usuarios).
  await store.set('elimination_matches', elim)

  // Una sola pasada de recálculo, solo si cambió algún ganador.
  if (ids.length) await recomputeKnockoutForAllUsers(newWinners, store)

  return { resolved: ids }
}
