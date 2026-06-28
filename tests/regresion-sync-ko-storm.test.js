import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { applySync } from '../src/lib/applySync.js'
import { applyKnockout } from '../src/lib/applyKnockout.js'
import { ELIMINATION_MATCHES } from '../src/data/bracket.js'

beforeEach(() => storage._resetForTests())

// Con los partidos de eliminatorias entrando ahora al sync, garantizamos que el camino
// completo (applySync de grupos + applyKnockout de llaves) NO dispare un storm de escrituras.
describe('regresión: sync con KO no entra en storm', () => {
  async function seed() {
    // Grupos ya finalizados y puntuados (estado terminal, idempotente).
    await storage.set('matches', [
      { id: 'g_A_1', equipoA: 'Argentina', equipoB: 'Jordania', estado: 'finalizado', resultadoA: 3, resultadoB: 1, fecha: '2026-06-28T02:00:00Z' },
    ])
    await storage.set('elimination_matches', ELIMINATION_MATCHES.map((m) => ({ ...m })))
    await storage.set('users', [{ alias: 'Ana', puntosGrupos: 10, puntosEliminatorias: 0 }])
    await storage.set('pronosticos_grupos:Ana', [{ matchId: 'g_A_1', pronosticoA: 3, pronosticoB: 1, puntos: 10 }])
    await storage.set('pronosticos_eliminatorias:Ana', [
      { userId: 'Ana', matchId: 'ko_dieciseisavos_3', ganador: 'Sudáfrica', puntos: null },
    ])
  }

  function spyWrites() {
    const base = storage
    const w = { grupos: 0, llaves: 0, elim: 0 }
    const spy = {
      get: (k) => base.get(k),
      set: (k, v) => {
        if (k.startsWith('pronosticos_grupos:')) w.grupos++
        if (k.startsWith('pronosticos_eliminatorias:')) w.llaves++
        if (k === 'elimination_matches') w.elim++
        return base.set(k, v)
      },
    }
    return { spy, w }
  }

  it('grupos ya procesados + KO programados: una pasada, sin recálculo por usuario', async () => {
    await seed()
    const now = Date.UTC(2026, 5, 28, 18, 0, 0)
    // La fuente trae el grupo ya finalizado (mismo marcador) y los KO programados (NS).
    const updates = [
      { home: 'Argentina', away: 'Jordan', status: 'finished', rA: 3, rB: 1 },
      { home: 'South Africa', away: 'Canada', status: 'scheduled', rA: null, rB: null, fecha: '2026-06-28T19:00:00Z' },
      { home: 'Germany', away: 'Paraguay', status: 'scheduled', rA: null, rB: null, fecha: '2026-06-29T20:30:00Z' },
    ]

    const { spy, w } = spyWrites()
    await applySync(updates, now)
    await applyKnockout(updates, spy)

    // applySync no reprocesa el grupo (mismo marcador) ni toca a los usuarios por KO.
    // applyKnockout solo escribe los metadatos del cuadro UNA vez; sin ganador → 0 recálculo.
    expect(w.grupos).toBe(0)
    expect(w.llaves).toBe(0)
    expect(w.elim).toBe(1)

    // La fecha del cruce quedó capturada (sin definir ganador).
    const ko3 = (await storage.get('elimination_matches')).find((m) => m.id === 'ko_dieciseisavos_3')
    expect(ko3.fecha).toBe('2026-06-28T19:00:00Z')
    expect(ko3.estado).toBe('programado')
    expect(ko3.ganador).toBeNull()
  })

  it('segundo sync idéntico: cero escrituras (idempotente, converge)', async () => {
    await seed()
    const now = Date.UTC(2026, 5, 28, 18, 0, 0)
    const updates = [
      { home: 'South Africa', away: 'Canada', status: 'scheduled', rA: null, rB: null, fecha: '2026-06-28T19:00:00Z' },
    ]
    await applyKnockout(updates) // primer sync: captura meta

    const { spy, w } = spyWrites()
    await applySync(updates, now)
    await applyKnockout(updates, spy)
    expect(w).toEqual({ grupos: 0, llaves: 0, elim: 0 }) // nada cambió → nada se escribe
  })

  it('cuando un KO finaliza: recálculo de UNA sola pasada (no por-cruce-por-usuario)', async () => {
    await seed()
    // 11 usuarios con pick en el cruce que finaliza.
    const users = Array.from({ length: 11 }, (_, i) => ({ alias: `U${i}`, puntosEliminatorias: 0 }))
    await storage.set('users', users)
    for (const u of users) {
      await storage.set(`pronosticos_eliminatorias:${u.alias}`, [
        { userId: u.alias, matchId: 'ko_dieciseisavos_3', ganador: 'Sudáfrica', puntos: null },
      ])
    }

    const { spy, w } = spyWrites()
    const { resolved } = await applyKnockout(
      [{ home: 'South Africa', away: 'Canada', status: 'finished', rA: 2, rB: 1 }],
      spy,
    )
    expect(resolved).toContain('ko_dieciseisavos_3')
    // Anti-storm: a lo sumo una escritura de pronóstico por usuario (no N×cruces).
    expect(w.llaves).toBeLessThanOrEqual(users.length)
    const u0 = (await storage.get('users')).find((u) => u.alias === 'U0')
    expect(u0.puntosEliminatorias).toBe(20)
  })
})
