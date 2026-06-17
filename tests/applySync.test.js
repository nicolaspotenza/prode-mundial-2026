import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { applySync } from '../src/lib/applySync.js'

beforeEach(() => storage._resetForTests())

describe('applySync', () => {
  it('marks live match locked and records finished match + awards points', async () => {
    await storage.set('matches', [
      { id: 'm1', promiedosId: 'p1', equipoA: 'A', equipoB: 'B', resultadoA: null, resultadoB: null, estado: 'programado', minuto: null },
      { id: 'm2', promiedosId: 'p2', equipoA: 'C', equipoB: 'D', resultadoA: null, resultadoB: null, estado: 'programado', minuto: null },
    ])
    await storage.set('users', [{ alias: 'Ana', puntosGrupos: 0, puntosEliminatorias: 0 }])
    await storage.set('pronosticos_grupos:Ana', [{ matchId: 'm2', pronosticoA: 2, pronosticoB: 1, puntos: null }])

    const updates = [
      { promiedosId: 'p1', status: 'live', rA: 1, rB: 0, minuto: 35, eventos: [] },
      { promiedosId: 'p2', status: 'finished', rA: 2, rB: 1, minuto: 90, eventos: [{ tipo: 'gol' }] },
    ]
    const { live, finished } = await applySync(updates)

    const matches = await storage.get('matches')
    expect(matches.find((m) => m.id === 'm1').estado).toBe('en_vivo')
    expect(matches.find((m) => m.id === 'm2').estado).toBe('finalizado')
    expect(live).toBe(1)
    expect(finished).toBe(1)
    const users = await storage.get('users')
    expect(users[0].puntosGrupos).toBe(10)
    expect(await storage.get('eventos_partido:m2')).toHaveLength(1)
  })

  it('does not double-award an already finished match', async () => {
    await storage.set('matches', [
      { id: 'm1', promiedosId: 'p1', equipoA: 'A', equipoB: 'B', resultadoA: 2, resultadoB: 1, estado: 'finalizado', minuto: 90 },
    ])
    await storage.set('users', [{ alias: 'Ana', puntosGrupos: 10, puntosEliminatorias: 0 }])
    await storage.set('pronosticos_grupos:Ana', [{ matchId: 'm1', pronosticoA: 2, pronosticoB: 1, puntos: 10 }])

    await applySync([{ promiedosId: 'p1', status: 'finished', rA: 2, rB: 1, minuto: 90, eventos: [] }])

    const users = await storage.get('users')
    expect(users[0].puntosGrupos).toBe(10) // unchanged, not re-added
  })

  it('returns zeros for null updates', async () => {
    expect(await applySync(null)).toEqual({ live: 0, finished: 0 })
  })
})
