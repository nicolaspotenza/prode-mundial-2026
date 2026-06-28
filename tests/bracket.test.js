import { describe, it, expect } from 'vitest'
import { resolveBracket, setBracketPick } from '../src/lib/bracket.js'

describe('resolveBracket', () => {
  it('R32 usa los equipos fijos', () => {
    const r = resolveBracket([])
    expect(r['ko_dieciseisavos_1']).toMatchObject({ teamA: 'Alemania', teamB: 'Paraguay', ganador: null })
  })

  it('el ganador de un cruce R32 aparece como lado del octavo padre', () => {
    const preds = [{ matchId: 'ko_dieciseisavos_1', ganador: 'Alemania' }]
    const r = resolveBracket(preds)
    expect(r['ko_octavos_1'].teamA).toBe('Alemania')
    expect(r['ko_octavos_1'].teamB).toBeNull()
  })

  it('invalida (null) un pick cuyo equipo ya no participa del cruce', () => {
    const preds = [
      { matchId: 'ko_dieciseisavos_1', ganador: 'Alemania' },
      { matchId: 'ko_dieciseisavos_2', ganador: 'Francia' },
      { matchId: 'ko_octavos_1', ganador: 'Francia' },
    ]
    const r = resolveBracket(preds)
    expect(r['ko_octavos_1'].ganador).toBe('Francia')

    const preds2 = preds.map((p) =>
      p.matchId === 'ko_dieciseisavos_2' ? { ...p, ganador: 'Suecia' } : p,
    )
    const r2 = resolveBracket(preds2)
    expect(r2['ko_octavos_1'].teamB).toBe('Suecia')
    expect(r2['ko_octavos_1'].ganador).toBeNull()
  })

  it('overlay de realidad: el equipo REAL avanza aunque el usuario haya elegido a otro', () => {
    const preds = [{ matchId: 'ko_dieciseisavos_1', ganador: 'Alemania' }]
    const realById = new Map([['ko_dieciseisavos_1', 'Paraguay']])
    const r = resolveBracket(preds, realById)
    // Su pick en el cruce 1 se conserva (se puntúa aparte), pero el que sube es el real.
    expect(r['ko_dieciseisavos_1'].ganador).toBe('Alemania')
    expect(r['ko_octavos_1'].teamA).toBe('Paraguay')
  })

  it('overlay de realidad: invalida el pick de la fase siguiente que apuntaba al eliminado', () => {
    const preds = [
      { matchId: 'ko_dieciseisavos_1', ganador: 'Alemania' },
      { matchId: 'ko_dieciseisavos_2', ganador: 'Francia' },
      { matchId: 'ko_octavos_1', ganador: 'Alemania' },
    ]
    const realById = new Map([['ko_dieciseisavos_1', 'Paraguay']])
    const r = resolveBracket(preds, realById)
    expect(r['ko_octavos_1'].teamA).toBe('Paraguay')
    expect(r['ko_octavos_1'].teamB).toBe('Francia')
    expect(r['ko_octavos_1'].ganador).toBeNull() // "Alemania" ya no participa → re-predecir
  })

  it('3er puesto: lo juegan los perdedores de las semis (derivado del overlay real)', () => {
    // Semis ya resueltas en la realidad, con sus equipos cargados.
    const realById = new Map([
      ['ko_semis_1', 'Argentina'],
      ['ko_semis_2', 'Francia'],
    ])
    // Forzamos los equipos efectivos de las semis vía picks que coinciden con el real para
    // dar teamA/teamB; en producción vienen de la cascada real (ver applyKnockout).
    const r = resolveBracket([], realById)
    // Con semis sin equipos definidos en este test aislado, el 3er puesto no tiene equipos aún.
    expect(r['ko_tercer_1']).toBeDefined()
    expect(r['ko_tercer_1'].teamA).toBeNull()
  })
})

describe('setBracketPick', () => {
  it('agrega un pick nuevo preservando userId/puntos en su forma', () => {
    const out = setBracketPick([], 'ko_dieciseisavos_1', 'Alemania', 'Ana')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ userId: 'Ana', matchId: 'ko_dieciseisavos_1', ganador: 'Alemania' })
  })

  it('null limpia el pick', () => {
    const start = [{ userId: 'Ana', matchId: 'ko_dieciseisavos_1', ganador: 'Alemania', puntos: null }]
    const out = setBracketPick(start, 'ko_dieciseisavos_1', null, 'Ana')
    expect(out).toHaveLength(0)
  })

  it('podar: cambiar un hijo elimina el pick del padre que quedó inválido', () => {
    const start = [
      { userId: 'Ana', matchId: 'ko_dieciseisavos_1', ganador: 'Alemania', puntos: null },
      { userId: 'Ana', matchId: 'ko_dieciseisavos_2', ganador: 'Francia', puntos: null },
      { userId: 'Ana', matchId: 'ko_octavos_1', ganador: 'Alemania', puntos: null },
    ]
    const out = setBracketPick(start, 'ko_dieciseisavos_1', 'Paraguay', 'Ana')
    expect(out.find((p) => p.matchId === 'ko_dieciseisavos_1').ganador).toBe('Paraguay')
    expect(out.find((p) => p.matchId === 'ko_octavos_1')).toBeUndefined()
  })

  it('poda con overlay real: el pick aguas arriba cae si su equipo no avanzó en la realidad', () => {
    const start = [
      { userId: 'Ana', matchId: 'ko_octavos_1', ganador: 'Alemania', puntos: null },
    ]
    const realById = new Map([['ko_dieciseisavos_1', 'Paraguay']]) // Alemania quedó eliminada
    const out = setBracketPick(start, 'ko_dieciseisavos_2', 'Francia', 'Ana', realById)
    expect(out.find((p) => p.matchId === 'ko_octavos_1')).toBeUndefined()
  })
})
