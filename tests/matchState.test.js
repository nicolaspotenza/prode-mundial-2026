import { describe, it, expect } from 'vitest'
import { deriveEstado, isBloqueado, isBettingOpen, isKnockoutBettingOpen } from '../src/lib/matchState.js'

describe('deriveEstado', () => {
  it('source finished overrides everything', () =>
    expect(deriveEstado({ status: 'finished' }, '2026-06-11T18:00:00Z', '2026-06-11T20:00:00Z')).toBe('finalizado'))
  it('source live -> en_vivo', () =>
    expect(deriveEstado({ status: 'live' }, '2026-06-11T18:00:00Z', '2026-06-11T18:30:00Z')).toBe('en_vivo'))
  it('no source info, kickoff in future -> programado', () =>
    expect(deriveEstado(null, '2026-06-11T22:00:00Z', '2026-06-11T18:00:00Z')).toBe('programado'))
  it('no source info, kickoff passed -> programado (never auto-live without source)', () =>
    expect(deriveEstado(null, '2026-06-11T10:00:00Z', '2026-06-11T18:00:00Z')).toBe('programado'))
})

describe('isBloqueado', () => {
  it('programado is editable', () => expect(isBloqueado('programado')).toBe(false))
  it('en_vivo is locked', () => expect(isBloqueado('en_vivo')).toBe(true))
  it('finalizado is locked', () => expect(isBloqueado('finalizado')).toBe(true))
})

describe('isBettingOpen', () => {
  const now = Date.UTC(2026, 5, 17, 22, 0, 0)
  it('open when programado and kickoff more than 1h away', () =>
    expect(isBettingOpen({ estado: 'programado', fecha: '2026-06-18T16:00:00Z' }, now)).toBe(true))
  it('open when kickoff just over 1h away', () =>
    expect(isBettingOpen({ estado: 'programado', fecha: '2026-06-17T23:30:00Z' }, now)).toBe(true))
  it('closed when kickoff is within 1h (cierra 1h antes)', () =>
    expect(isBettingOpen({ estado: 'programado', fecha: '2026-06-17T22:30:00Z' }, now)).toBe(false))
  it('closed exactly at the 1h boundary', () =>
    expect(isBettingOpen({ estado: 'programado', fecha: '2026-06-17T23:00:00Z' }, now)).toBe(false))
  it('closed when programado but kickoff already passed', () =>
    expect(isBettingOpen({ estado: 'programado', fecha: '2026-06-17T16:00:00Z' }, now)).toBe(false))
  it('closed when en_vivo', () =>
    expect(isBettingOpen({ estado: 'en_vivo', fecha: '2026-06-20T16:00:00Z' }, now)).toBe(false))
  it('closed when finalizado', () =>
    expect(isBettingOpen({ estado: 'finalizado', fecha: '2026-06-20T16:00:00Z' }, now)).toBe(false))
})

describe('isKnockoutBettingOpen (cierra 30 min antes del kickoff)', () => {
  const now = Date.UTC(2026, 5, 28, 18, 0, 0) // 2026-06-28 18:00Z
  it('abierto cuando no hay meta todavía (aún no se conoce la fecha)', () =>
    expect(isKnockoutBettingOpen(null, now)).toBe(true))
  it('abierto cuando hay cruce pero sin fecha conocida', () =>
    expect(isKnockoutBettingOpen({ estado: 'programado' }, now)).toBe(true))
  it('abierto cuando faltan más de 30 min para el kickoff', () =>
    expect(isKnockoutBettingOpen({ estado: 'programado', fecha: '2026-06-28T19:00:00Z' }, now)).toBe(true))
  it('cerrado cuando faltan menos de 30 min', () =>
    expect(isKnockoutBettingOpen({ estado: 'programado', fecha: '2026-06-28T18:20:00Z' }, now)).toBe(false))
  it('cerrado justo en el límite de 30 min', () =>
    expect(isKnockoutBettingOpen({ estado: 'programado', fecha: '2026-06-28T18:30:00Z' }, now)).toBe(false))
  it('cerrado cuando el kickoff ya pasó', () =>
    expect(isKnockoutBettingOpen({ estado: 'programado', fecha: '2026-06-28T17:00:00Z' }, now)).toBe(false))
  it('cerrado cuando está en vivo', () =>
    expect(isKnockoutBettingOpen({ estado: 'en_vivo', fecha: '2026-06-30T16:00:00Z' }, now)).toBe(false))
  it('cerrado cuando está finalizado', () =>
    expect(isKnockoutBettingOpen({ estado: 'finalizado', fecha: '2026-06-25T16:00:00Z' }, now)).toBe(false))
})
