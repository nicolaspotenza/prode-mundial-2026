import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import {
  recomputeGroupMatchForAllUsers,
  recomputeMatchForAllUsers,
  recomputeUserTotals,
  recomputeKnockoutForAllUsers,
} from '../src/lib/recalc.js'

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

describe('recomputeKnockoutForAllUsers', () => {
  it('otorga +20 al acertar y 0 al errar, en una sola pasada', async () => {
    await storage.set('users', [
      { alias: 'Ana', puntosGrupos: 0, puntosEliminatorias: 0 },
      { alias: 'Beto', puntosGrupos: 0, puntosEliminatorias: 0 },
    ])
    await storage.set('pronosticos_eliminatorias:Ana', [
      { userId: 'Ana', matchId: 'ko_dieciseisavos_1', ganador: 'Paraguay', puntos: null },
    ])
    await storage.set('pronosticos_eliminatorias:Beto', [
      { userId: 'Beto', matchId: 'ko_dieciseisavos_1', ganador: 'Alemania', puntos: null },
    ])

    await recomputeKnockoutForAllUsers({ ko_dieciseisavos_1: 'Paraguay' })

    const ana = (await storage.get('users')).find((u) => u.alias === 'Ana')
    const beto = (await storage.get('users')).find((u) => u.alias === 'Beto')
    expect(ana.puntosEliminatorias).toBe(20)
    expect(beto.puntosEliminatorias).toBe(0)
  })

  it('es idempotente: re-ejecutar con el mismo resultado no reescribe el pronóstico', async () => {
    await storage.set('users', [{ alias: 'Ana', puntosEliminatorias: 0 }])
    await storage.set('pronosticos_eliminatorias:Ana', [
      { userId: 'Ana', matchId: 'ko_dieciseisavos_1', ganador: 'Paraguay', puntos: 20 },
    ])

    let writes = 0
    const base = storage
    const spy = {
      get: (k) => base.get(k),
      set: (k, v) => {
        if (k.startsWith('pronosticos_eliminatorias:')) writes++
        return base.set(k, v)
      },
    }

    await recomputeKnockoutForAllUsers({ ko_dieciseisavos_1: 'Paraguay' }, spy)
    expect(writes).toBe(0) // ya estaba en 20 → no se reescribe el pronóstico
  })

  it('winnersById vacío no toca a ningún usuario', async () => {
    let writes = 0
    const base = storage
    const spy = { get: (k) => base.get(k), set: (k, v) => { writes++; return base.set(k, v) } }
    await recomputeKnockoutForAllUsers({}, spy)
    expect(writes).toBe(0)
  })
})
