import { describe, it, expect } from 'vitest'
import { deriveEstado, isBloqueado, isBettingOpen } from '../src/lib/matchState.js'

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
  it('open when programado and kickoff in the future', () =>
    expect(isBettingOpen({ estado: 'programado', fecha: '2026-06-18T16:00:00Z' }, now)).toBe(true))
  it('closed when programado but kickoff already passed', () =>
    expect(isBettingOpen({ estado: 'programado', fecha: '2026-06-17T16:00:00Z' }, now)).toBe(false))
  it('closed when en_vivo', () =>
    expect(isBettingOpen({ estado: 'en_vivo', fecha: '2026-06-20T16:00:00Z' }, now)).toBe(false))
  it('closed when finalizado', () =>
    expect(isBettingOpen({ estado: 'finalizado', fecha: '2026-06-20T16:00:00Z' }, now)).toBe(false))
})
