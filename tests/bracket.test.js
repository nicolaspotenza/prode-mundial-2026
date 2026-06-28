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
    expect(r['ko_octavos_1'].teamB).toBeNull() // el otro hijo aún sin elegir
  })

  it('invalida (null) un pick cuyo equipo ya no participa del cruce', () => {
    const preds = [
      { matchId: 'ko_dieciseisavos_1', ganador: 'Alemania' },
      { matchId: 'ko_dieciseisavos_2', ganador: 'Francia' },
      { matchId: 'ko_octavos_1', ganador: 'Francia' }, // válido: octavos_1 = Alemania vs Francia
    ]
    const r = resolveBracket(preds)
    expect(r['ko_octavos_1'].ganador).toBe('Francia')

    // si ahora el hijo 2 da ganador a Suecia, "Francia" en octavos_1 deja de ser válido
    const preds2 = preds.map((p) =>
      p.matchId === 'ko_dieciseisavos_2' ? { ...p, ganador: 'Suecia' } : p,
    )
    const r2 = resolveBracket(preds2)
    expect(r2['ko_octavos_1'].teamB).toBe('Suecia')
    expect(r2['ko_octavos_1'].ganador).toBeNull()
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
    // re-elijo el hijo 1 a Paraguay => "Alemania" en octavos_1 ya no participa
    const out = setBracketPick(start, 'ko_dieciseisavos_1', 'Paraguay', 'Ana')
    expect(out.find((p) => p.matchId === 'ko_dieciseisavos_1').ganador).toBe('Paraguay')
    expect(out.find((p) => p.matchId === 'ko_octavos_1')).toBeUndefined() // podado
  })
})
