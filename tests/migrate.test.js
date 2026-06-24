import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import {
  mergeUsers,
  mergeByKey,
  rescoreGroupPreds,
  migrateLocalToRemote,
  autoMigrateIfNeeded,
  hasLocalData,
} from '../src/lib/migrate.js'

beforeEach(() => storage._resetForTests())

describe('hasLocalData', () => {
  it('is false when only current_user is local (device-local alias is not stranded data)', () => {
    localStorage.setItem('prode:current_user', JSON.stringify('Ana'))
    expect(hasLocalData()).toBe(false)
  })
  it('is true when stranded shared data (users) lives in localStorage', () => {
    localStorage.setItem('prode:users', JSON.stringify([{ alias: 'Ana' }]))
    expect(hasLocalData()).toBe(true)
  })
  it('is false once the migrated flag is set', () => {
    localStorage.setItem('prode:users', JSON.stringify([{ alias: 'Ana' }]))
    localStorage.setItem('prode:migrated', JSON.stringify(true))
    expect(hasLocalData()).toBe(false)
  })
})

describe('autoMigrateIfNeeded', () => {
  const matches = [{ id: 'g_A_0', estado: 'finalizado', resultadoA: 2, resultadoB: 0 }]

  it('migrates stranded localStorage data without any user action', async () => {
    // Friend used the app before Upstash: their data is stranded in this device's localStorage.
    localStorage.setItem('prode:users', JSON.stringify([{ alias: 'Beto' }]))
    localStorage.setItem(
      'prode:pronosticos_grupos:Beto',
      JSON.stringify([{ matchId: 'g_A_0', pronosticoA: 2, pronosticoB: 0, puntos: null }]),
    )

    const summary = await autoMigrateIfNeeded({ storage, matches })

    expect(summary).not.toBeNull()
    const users = await storage.get('users')
    expect(users.map((u) => u.alias)).toContain('Beto')
    const preds = await storage.get('pronosticos_grupos:Beto')
    expect(preds.find((p) => p.matchId === 'g_A_0').puntos).toBe(10) // re-scored exact
  })

  it('is a no-op when there is no stranded data', async () => {
    expect(await autoMigrateIfNeeded({ storage, matches })).toBeNull()
  })

  it('does not run twice (migrated flag stops it)', async () => {
    localStorage.setItem('prode:users', JSON.stringify([{ alias: 'Beto' }]))
    expect(await autoMigrateIfNeeded({ storage, matches })).not.toBeNull()
    expect(await autoMigrateIfNeeded({ storage, matches })).toBeNull()
  })
})

describe('mergeUsers', () => {
  it('keeps remote users and appends locals not present', () => {
    const remote = [{ alias: 'Ana', puntosGrupos: 10 }]
    const local = [{ alias: 'Ana', puntosGrupos: 0 }, { alias: 'Beto', puntosGrupos: 5 }]
    const out = mergeUsers(remote, local)
    expect(out).toHaveLength(2)
    expect(out.find((u) => u.alias === 'Ana').puntosGrupos).toBe(10) // remote wins
    expect(out.find((u) => u.alias === 'Beto')).toBeTruthy()
  })
  it('is case-insensitive on alias', () => {
    const out = mergeUsers([{ alias: 'Ana' }], [{ alias: 'ana' }])
    expect(out).toHaveLength(1)
  })
})

describe('mergeByKey', () => {
  it('remote wins, local fills gaps', () => {
    const remote = [{ matchId: 'g_A_0', pronosticoA: 1, pronosticoB: 0 }]
    const local = [
      { matchId: 'g_A_0', pronosticoA: 9, pronosticoB: 9 }, // ignored (remote has it)
      { matchId: 'g_A_1', pronosticoA: 2, pronosticoB: 2 }, // added
    ]
    const out = mergeByKey(remote, local, 'matchId')
    expect(out).toHaveLength(2)
    expect(out.find((p) => p.matchId === 'g_A_0').pronosticoA).toBe(1)
    expect(out.find((p) => p.matchId === 'g_A_1').pronosticoA).toBe(2)
  })
})

describe('rescoreGroupPreds', () => {
  const matches = [
    { id: 'g_A_0', estado: 'finalizado', resultadoA: 2, resultadoB: 0 },
    { id: 'g_A_1', estado: 'programado', resultadoA: null, resultadoB: null },
  ]
  it('scores predictions against finished matches and nulls the rest', () => {
    const list = [
      { matchId: 'g_A_0', pronosticoA: 2, pronosticoB: 0, puntos: null },
      { matchId: 'g_A_1', pronosticoA: 1, pronosticoB: 1, puntos: 99 },
    ]
    const out = rescoreGroupPreds(list, matches)
    expect(out.find((p) => p.matchId === 'g_A_0').puntos).toBe(10) // exact
    expect(out.find((p) => p.matchId === 'g_A_1').puntos).toBeNull() // not finished
  })
})

describe('migrateLocalToRemote', () => {
  const matches = [{ id: 'g_A_0', estado: 'finalizado', resultadoA: 2, resultadoB: 0 }]

  function localReader(map) {
    return (key) => (key in map ? map[key] : null)
  }

  it('merges users + predictions, re-scores, totals, and reports a summary', async () => {
    // remote already has Ana with a different bet on g_A_0
    await storage.set('users', [{ alias: 'Ana', puntosGrupos: 0, puntosEliminatorias: 0 }])
    await storage.set('pronosticos_grupos:Ana', [{ matchId: 'g_A_0', pronosticoA: 0, pronosticoB: 0, puntos: 0 }])
    await storage.set('matches', matches)

    const local = {
      current_user: 'Beto',
      users: [{ alias: 'Beto', puntosGrupos: 0, puntosEliminatorias: 0 }],
      'pronosticos_grupos:Beto': [{ matchId: 'g_A_0', pronosticoA: 2, pronosticoB: 0, puntos: null }],
      'pronosticos_eliminatorias:Beto': [{ matchId: 'ko_dieciseisavos_13', ganador: 'Argentina', puntos: null }],
    }

    const summary = await migrateLocalToRemote({ storage, matches, localReader: localReader(local) })

    const users = await storage.get('users')
    expect(users.map((u) => u.alias).sort()).toEqual(['Ana', 'Beto'])
    // Beto's g_A_0 prediction (2-0) re-scored to exact 10
    expect(users.find((u) => u.alias === 'Beto').puntosGrupos).toBe(10)
    // Ana's remote bet untouched
    expect(users.find((u) => u.alias === 'Ana').puntosGrupos).toBe(0)
    expect(summary.migratedUsers).toBe(1)
    expect(summary.gruposAdded).toBe(1)
    expect(summary.llavesAdded).toBe(1)
  })

  it('does not overwrite an existing remote bet for the same alias', async () => {
    await storage.set('users', [{ alias: 'Ana', puntosGrupos: 0, puntosEliminatorias: 0 }])
    await storage.set('pronosticos_grupos:Ana', [{ matchId: 'g_A_0', pronosticoA: 1, pronosticoB: 1, puntos: 5 }])
    await storage.set('matches', matches)

    const local = {
      current_user: 'Ana',
      users: [{ alias: 'Ana' }],
      'pronosticos_grupos:Ana': [{ matchId: 'g_A_0', pronosticoA: 2, pronosticoB: 0, puntos: null }],
    }
    await migrateLocalToRemote({ storage, matches, localReader: localReader(local) })

    const preds = await storage.get('pronosticos_grupos:Ana')
    expect(preds).toHaveLength(1)
    expect(preds[0].pronosticoA).toBe(1) // remote bet kept, local ignored
  })
})
