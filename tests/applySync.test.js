import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { applySync, findFixture } from '../src/lib/applySync.js'

beforeEach(() => storage._resetForTests())

const baseMatches = () => [
  { id: 'g_A_0', equipoA: 'México', equipoB: 'Sudáfrica', resultadoA: null, resultadoB: null, estado: 'programado', minuto: null },
  { id: 'g_K_0', equipoA: 'Portugal', equipoB: 'DR Congo', resultadoA: null, resultadoB: null, estado: 'programado', minuto: null },
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
    const { live } = await applySync([
      { home: 'Portugal', away: 'DR Congo', status: 'live', rA: 1, rB: 0, minuto: "55'", eventos: [] },
    ])
    expect(live).toBe(1)
    const m = (await storage.get('matches')).find((x) => x.id === 'g_K_0')
    expect(m.estado).toBe('en_vivo')
    expect(m.resultadoA).toBe(1)
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

  it('returns zeros for null updates', async () => {
    expect(await applySync(null)).toEqual({ live: 0, finished: 0 })
  })
})
