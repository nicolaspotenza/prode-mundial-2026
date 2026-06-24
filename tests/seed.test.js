import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { ensureSeeded } from '../src/lib/seed.js'

beforeEach(() => storage._resetForTests())

describe('ensureSeeded', () => {
  it('NO pisa matches existentes cuando la versión está vieja (preserva resultados en vivo)', async () => {
    await storage.set('seed_version', 2)
    await storage.set('matches', [{ id: 'g_A_0', estado: 'finalizado', resultadoA: 2, resultadoB: 1 }])

    await ensureSeeded()

    const matches = await storage.get('matches')
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({ estado: 'finalizado', resultadoA: 2, resultadoB: 1 })
    // pero igual actualiza la versión (la migración/limpieza one-time corre)
    expect(await storage.get('seed_version')).toBe(3)
  })

  it('NO pisa elimination_matches existentes cuando la versión está vieja', async () => {
    await storage.set('seed_version', 2)
    await storage.set('elimination_matches', [{ id: 'ko_final_1', ganador: 'Argentina' }])

    await ensureSeeded()

    const ko = await storage.get('elimination_matches')
    expect(ko).toHaveLength(1)
    expect(ko[0].ganador).toBe('Argentina')
  })

  it('siembra matches y elimination_matches cuando faltan', async () => {
    await ensureSeeded()
    expect((await storage.get('matches')).length).toBe(72)
    expect((await storage.get('elimination_matches')).length).toBe(31)
  })

  it('NO re-siembra matches si el backend ya está inicializado y el read viene vacío (fallo transitorio)', async () => {
    await storage.set('seed_version', 3) // backend ya inicializado: NO es primer arranque
    // matches ausente: simula un read vacío por un fallo transitorio del storage remoto.
    await ensureSeeded()
    const matches = await storage.get('matches')
    expect(matches == null || matches.length === 0).toBe(true) // no se pisó con el fixture en blanco
  })

  it('limpia picks viejos por slotId en el bump de versión pero conserva los de matchId', async () => {
    await storage.set('seed_version', 2)
    await storage.set('matches', [{ id: 'g_A_0', estado: 'programado' }])
    await storage.set('users', [{ alias: 'Ana', puntosGrupos: 0, puntosEliminatorias: 0 }])
    await storage.set('pronosticos_eliminatorias:Ana', [
      { slotId: 'pos_A_1', equipoElegido: 'México', puntos: 10 },
      { matchId: 'ko_dieciseisavos_1', ganador: 'Alemania', puntos: null },
    ])

    await ensureSeeded()

    const picks = await storage.get('pronosticos_eliminatorias:Ana')
    expect(picks).toHaveLength(1)
    expect(picks[0].matchId).toBe('ko_dieciseisavos_1')
  })
})
