import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { applySync, findFixture } from '../src/lib/applySync.js'

beforeEach(() => storage._resetForTests())

const baseMatches = () => [
  { id: 'g_A_0', equipoA: 'México', equipoB: 'Sudáfrica', fecha: '2026-06-20T16:00:00Z', resultadoA: null, resultadoB: null, estado: 'programado', minuto: null },
  { id: 'g_K_0', equipoA: 'Portugal', equipoB: 'DR Congo', fecha: '2026-06-20T16:00:00Z', resultadoA: null, resultadoB: null, estado: 'programado', minuto: null },
]

describe('findFixture (canonical, language-agnostic, any order)', () => {
  it('matches English source names to Spanish fixture', () => {
    const f = findFixture(baseMatches(), 'Mexico', 'South Africa')
    expect(f.match.id).toBe('g_A_0')
    expect(f.swapped).toBe(false)
  })
  it('detects swapped home/away', () => {
    const f = findFixture(baseMatches(), 'South Africa', 'Mexico')
    expect(f.match.id).toBe('g_A_0')
    expect(f.swapped).toBe(true)
  })
  it('maps DR Congo variants', () => {
    expect(findFixture(baseMatches(), 'Portugal', 'Congo DR').match.id).toBe('g_K_0')
  })
  it('returns null for unknown team', () => {
    expect(findFixture(baseMatches(), 'Mexico', 'Narnia')).toBeNull()
  })
})

describe('applySync', () => {
  it('records a finished match (English names) and awards points', async () => {
    await storage.set('matches', baseMatches())
    await storage.set('users', [{ alias: 'Ana', puntosGrupos: 0, puntosEliminatorias: 0 }])
    await storage.set('pronosticos_grupos:Ana', [{ matchId: 'g_A_0', pronosticoA: 2, pronosticoB: 0, puntos: null }])

    const { finished } = await applySync([
      { home: 'Mexico', away: 'South Africa', status: 'finished', rA: 2, rB: 0, minuto: '90', eventos: [] },
    ])

    expect(finished).toBe(1)
    const matches = await storage.get('matches')
    const m = matches.find((x) => x.id === 'g_A_0')
    expect(m.estado).toBe('finalizado')
    expect(m.resultadoA).toBe(2)
    expect(m.resultadoB).toBe(0)
    const users = await storage.get('users')
    expect(users[0].puntosGrupos).toBe(10) // exact 2-0
  })

  it('applies swapped orientation correctly', async () => {
    await storage.set('matches', baseMatches())
    await storage.set('users', [])
    // source reports South Africa (home) 0 - 2 Mexico (away); fixture is Mexico vs Sudáfrica
    await applySync([{ home: 'South Africa', away: 'Mexico', status: 'finished', rA: 0, rB: 2, minuto: '90', eventos: [] }])
    const m = (await storage.get('matches')).find((x) => x.id === 'g_A_0')
    expect(m.resultadoA).toBe(2) // México (equipoA)
    expect(m.resultadoB).toBe(0) // Sudáfrica (equipoB)
  })

  it('marks live match locked', async () => {
    await storage.set('matches', baseMatches())
    // now justo después del kickoff: el partido NO es stale, sigue en vivo.
    const now = Date.parse('2026-06-20T16:05:00Z')
    const { live } = await applySync(
      [{ home: 'Portugal', away: 'DR Congo', status: 'live', rA: 1, rB: 0, minuto: "55'", eventos: [] }],
      now,
    )
    expect(live).toBe(1)
    const m = (await storage.get('matches')).find((x) => x.id === 'g_K_0')
    expect(m.estado).toBe('en_vivo')
    expect(m.resultadoA).toBe(1)
  })

  it('auto-finalizes a match stuck live past the max duration, with the last score', async () => {
    const matches = baseMatches()
    matches[1].estado = 'en_vivo' // g_K_0 Portugal vs DR Congo, ya en vivo
    matches[1].resultadoA = 1
    matches[1].resultadoB = 1
    matches[1].fecha = '2026-06-18T16:00:00Z'
    await storage.set('matches', matches)
    await storage.set('users', [{ alias: 'Ana', puntosGrupos: 0, puntosEliminatorias: 0 }])
    await storage.set('pronosticos_grupos:Ana', [{ matchId: 'g_K_0', pronosticoA: 1, pronosticoB: 1, puntos: null }])

    // La fuente sigue colgada reportándolo en vivo (2H) 3h después del kickoff.
    const now = Date.parse('2026-06-18T19:00:00Z')
    const { live, finished } = await applySync(
      [{ home: 'Portugal', away: 'DR Congo', status: 'live', rA: 1, rB: 1, minuto: "90'", eventos: [] }],
      now,
    )

    const m = (await storage.get('matches')).find((x) => x.id === 'g_K_0')
    expect(m.estado).toBe('finalizado')
    expect(live).toBe(0) // ya no cuenta como en vivo → corta el re-poll adaptativo
    expect(finished).toBe(1)
    const users = await storage.get('users')
    expect(users[0].puntosGrupos).toBe(10) // 1-1 exacto
  })

  it('re-scores an already-finished match when a corrected score arrives', async () => {
    const matches = baseMatches()
    matches[0].estado = 'finalizado'
    matches[0].resultadoA = 1
    matches[0].resultadoB = 1
    await storage.set('matches', matches)
    await storage.set('users', [{ alias: 'Ana', puntosGrupos: 0, puntosEliminatorias: 0 }])
    await storage.set('pronosticos_grupos:Ana', [{ matchId: 'g_A_0', pronosticoA: 2, pronosticoB: 0, puntos: 0 }])

    // Llega el resultado real corregido 2-0 (antes lo habíamos cerrado en 1-1).
    await applySync([{ home: 'Mexico', away: 'South Africa', status: 'finished', rA: 2, rB: 0, minuto: '90', eventos: [] }])
    const m = (await storage.get('matches')).find((x) => x.id === 'g_A_0')
    expect(m.resultadoA).toBe(2)
    const users = await storage.get('users')
    expect(users[0].puntosGrupos).toBe(10) // re-scored al marcador real
  })

  it('does not double-award an already finished match', async () => {
    const matches = baseMatches()
    matches[0].estado = 'finalizado'
    matches[0].resultadoA = 2
    matches[0].resultadoB = 0
    await storage.set('matches', matches)
    await storage.set('users', [{ alias: 'Ana', puntosGrupos: 10, puntosEliminatorias: 0 }])
    await storage.set('pronosticos_grupos:Ana', [{ matchId: 'g_A_0', pronosticoA: 2, pronosticoB: 0, puntos: 10 }])

    await applySync([{ home: 'Mexico', away: 'South Africa', status: 'finished', rA: 2, rB: 0, minuto: '90', eventos: [] }])
    const users = await storage.get('users')
    expect(users[0].puntosGrupos).toBe(10)
  })

  it('refines kickoff (fecha) for a scheduled match from the source', async () => {
    await storage.set('matches', baseMatches())
    await storage.set('users', [])
    await applySync([
      { home: 'Portugal', away: 'DR Congo', status: 'scheduled', rA: null, rB: null, minuto: null, eventos: [], fecha: '2026-06-17T22:00:00Z' },
    ])
    const m = (await storage.get('matches')).find((x) => x.id === 'g_K_0')
    expect(m.fecha).toBe('2026-06-17T22:00:00Z')
    expect(m.estado).toBe('programado')
  })

  it('keeps existing fecha when the source has no timestamp', async () => {
    await storage.set('matches', baseMatches())
    await storage.set('users', [])
    await applySync([
      { home: 'Portugal', away: 'DR Congo', status: 'scheduled', rA: null, rB: null, minuto: null, eventos: [] },
    ])
    const m = (await storage.get('matches')).find((x) => x.id === 'g_K_0')
    expect(m.fecha).toBe('2026-06-20T16:00:00Z')
  })

  it('returns zeros for null updates', async () => {
    expect(await applySync(null)).toEqual({ live: 0, finished: 0 })
  })
})
