import { describe, it, expect } from 'vitest'
import { DIECISEISAVOS, KO_RONDAS, KO_MATCHES, ELIMINATION_MATCHES, RONDA_LABELS } from '../src/data/bracket.js'
import { GRUPOS } from '../src/data/groups.js'

const ALL_TEAMS = new Set(Object.values(GRUPOS).flat())

describe('DIECISEISAVOS', () => {
  it('tiene 16 cruces', () => expect(DIECISEISAVOS).toHaveLength(16))
  it('usa 32 equipos únicos, todos presentes en GRUPOS', () => {
    const teams = DIECISEISAVOS.flatMap((c) => [c.teamA, c.teamB])
    expect(new Set(teams).size).toBe(32)
    for (const t of teams) expect(ALL_TEAMS.has(t)).toBe(true)
  })
  it('primer cruce es Alemania vs Paraguay', () => {
    expect(DIECISEISAVOS[0]).toMatchObject({ teamA: 'Alemania', teamB: 'Paraguay' })
  })
})

describe('KO_MATCHES', () => {
  it('tiene 31 partidos (16+8+4+2+1)', () => expect(KO_MATCHES).toHaveLength(31))
  it('los 16 de dieciseisavos tienen equipos fijos y sin hijos', () => {
    const r32 = KO_MATCHES.filter((m) => m.ronda === 'dieciseisavos')
    expect(r32).toHaveLength(16)
    for (const m of r32) {
      expect(m.teamA).toBeTruthy()
      expect(m.teamB).toBeTruthy()
      expect(m.children).toBeNull()
    }
  })
  it('octavos_1 se alimenta de dieciseisavos_1 y _2', () => {
    const o1 = KO_MATCHES.find((m) => m.id === 'ko_octavos_1')
    expect(o1.children).toEqual(['ko_dieciseisavos_1', 'ko_dieciseisavos_2'])
    expect(o1.teamA).toBeNull()
  })
  it('la final se alimenta de las dos semis', () => {
    const f = KO_MATCHES.find((m) => m.id === 'ko_final_1')
    expect(f.children).toEqual(['ko_semis_1', 'ko_semis_2'])
  })
})

describe('ELIMINATION_MATCHES', () => {
  it('un registro por partido, con ganador real null', () => {
    expect(ELIMINATION_MATCHES).toHaveLength(31)
    for (const m of ELIMINATION_MATCHES) expect(m.ganador).toBeNull()
  })
})

describe('RONDA_LABELS / KO_RONDAS', () => {
  it('cubre las 5 rondas en orden', () => {
    expect(KO_RONDAS).toEqual(['dieciseisavos', 'octavos', 'cuartos', 'semis', 'final'])
    for (const r of KO_RONDAS) expect(RONDA_LABELS[r]).toBeTruthy()
  })
})
