import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { applyKnockout } from '../src/lib/applyKnockout.js'
import { ELIMINATION_MATCHES, DIECISEISAVOS } from '../src/data/bracket.js'

beforeEach(() => storage._resetForTests())

describe('regresión: applyKnockout no entra en storm', () => {
  it('un lote de 16 dieciseisavos con 12 usuarios converge con escrituras O(usuarios)', async () => {
    await storage.set('elimination_matches', ELIMINATION_MATCHES.map((m) => ({ ...m })))

    // 12 usuarios, cada uno con un pick en cada dieciseisavo.
    const users = Array.from({ length: 12 }, (_, i) => ({ alias: `U${i}`, puntosEliminatorias: 0 }))
    await storage.set('users', users)
    for (const u of users) {
      await storage.set(
        `pronosticos_eliminatorias:${u.alias}`,
        DIECISEISAVOS.map((c) => ({ userId: u.alias, matchId: c.id, ganador: c.teamA, puntos: null })),
      )
    }

    // La fuente finaliza los 16 dieciseisavos (gana siempre teamA).
    const updates = DIECISEISAVOS.map((c) => ({
      home: c.teamA, away: c.teamB, status: 'finished', rA: 1, rB: 0,
    }))

    // Contar escrituras de pronósticos de usuarios durante el recálculo.
    let userWrites = 0
    const base = storage
    const spy = {
      get: (k) => base.get(k),
      set: (k, v) => {
        if (k.startsWith('pronosticos_eliminatorias:')) userWrites++
        return base.set(k, v)
      },
    }

    const { resolved } = await applyKnockout(updates, spy)

    // Resolvió al menos los 16 dieciseisavos.
    expect(resolved.length).toBeGreaterThanOrEqual(16)
    // Anti-storm: a lo sumo una escritura por usuario (no 16×12).
    expect(userWrites).toBeLessThanOrEqual(users.length)

    // Cada usuario sumó 20×16 = 320 por acertar todos los teamA.
    const u0 = (await storage.get('users')).find((u) => u.alias === 'U0')
    expect(u0.puntosEliminatorias).toBe(320)
  })

  it('segundo sync idéntico no reprocesa (idempotente, 0 escrituras de usuario)', async () => {
    await storage.set('elimination_matches', ELIMINATION_MATCHES.map((m) => ({ ...m })))
    await storage.set('users', [{ alias: 'Ana', puntosEliminatorias: 0 }])
    await storage.set('pronosticos_eliminatorias:Ana', [
      { userId: 'Ana', matchId: 'ko_dieciseisavos_1', ganador: 'Alemania', puntos: null },
    ])
    const updates = [{ home: 'Alemania', away: 'Paraguay', status: 'finished', rA: 1, rB: 0 }]
    await applyKnockout(updates)

    let userWrites = 0
    const base = storage
    const spy = {
      get: (k) => base.get(k),
      set: (k, v) => { if (k.startsWith('pronosticos_eliminatorias:')) userWrites++; return base.set(k, v) },
    }
    const { resolved } = await applyKnockout(updates, spy)
    expect(resolved).toEqual([])
    expect(userWrites).toBe(0)
  })
})
