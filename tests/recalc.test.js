import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { recomputeGroupMatchForAllUsers, recomputeMatchForAllUsers, recomputeUserTotals } from '../src/lib/recalc.js'

beforeEach(() => storage._resetForTests())

describe('recomputeGroupMatchForAllUsers', () => {
  it('awards points to every user with a prediction for the match', async () => {
    await storage.set('users', [
      { alias: 'Ana', puntosGrupos: 0, puntosEliminatorias: 0 },
      { alias: 'Beto', puntosGrupos: 0, puntosEliminatorias: 0 },
    ])
    await storage.set('pronosticos_grupos:Ana', [{ matchId: 'm1', pronosticoA: 3, pronosticoB: 0, puntos: null }])
    await storage.set('pronosticos_grupos:Beto', [{ matchId: 'm1', pronosticoA: 1, pronosticoB: 1, puntos: null }])

    await recomputeGroupMatchForAllUsers('m1', 3, 0)

    const ana = await storage.get('pronosticos_grupos:Ana')
    const beto = await storage.get('pronosticos_grupos:Beto')
    expect(ana[0].puntos).toBe(10)
    expect(beto[0].puntos).toBe(0)
    const users = await storage.get('users')
    expect(users.find((u) => u.alias === 'Ana').puntosGrupos).toBe(10)
  })
})

describe('recomputeMatchForAllUsers', () => {
  it('awards knockout points to users who picked the winning team', async () => {
    await storage.set('users', [{ alias: 'Ana', puntosGrupos: 0, puntosEliminatorias: 0 }])
    await storage.set('pronosticos_eliminatorias:Ana', [
      { userId: 'Ana', matchId: 'ko_dieciseisavos_13', ganador: 'Argentina', puntos: null },
    ])

    await recomputeMatchForAllUsers('ko_dieciseisavos_13', 'Argentina')

    const users = await storage.get('users')
    expect(users[0].puntosEliminatorias).toBe(20)
  })
})

describe('recomputeUserTotals', () => {
  it('incluye el bonus por usuario en totalPuntos', async () => {
    await storage.set('users', [{ alias: 'Ana', bonus: 15 }])
    await storage.set('pronosticos_grupos:Ana', [{ matchId: 'm1', puntos: 10 }])
    await storage.set('pronosticos_eliminatorias:Ana', [{ matchId: 'k1', puntos: 20 }])

    await recomputeUserTotals()

    const u = (await storage.get('users'))[0]
    expect(u.puntosGrupos).toBe(10)
    expect(u.puntosEliminatorias).toBe(20)
    expect(u.totalPuntos).toBe(45) // 10 + 20 + 15
  })
})
