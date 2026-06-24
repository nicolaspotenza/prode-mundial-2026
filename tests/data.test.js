import { describe, it, expect } from 'vitest'
import { GRUPOS } from '../src/data/groups.js'
import { TEAMS } from '../src/data/teams.js'
import { FIXTURES } from '../src/data/fixtures.js'

describe('static data', () => {
  it('12 groups of 4', () => {
    expect(Object.keys(GRUPOS).length).toBe(12)
    Object.values(GRUPOS).forEach((g) => expect(g.length).toBe(4))
  })
  it('48 teams with flags', () => {
    expect(Object.keys(TEAMS).length).toBe(48)
    Object.values(TEAMS).forEach((f) => expect(typeof f).toBe('string'))
  })
  it('every group team has a flag entry', () => {
    Object.values(GRUPOS).flat().forEach((team) => expect(TEAMS[team]).toBeTruthy())
  })
  it('72 fixtures (6 per group), all teams known, unique ids', () => {
    expect(FIXTURES.length).toBe(72)
    const ids = new Set()
    FIXTURES.forEach((m) => {
      expect(TEAMS[m.equipoA]).toBeTruthy()
      expect(TEAMS[m.equipoB]).toBeTruthy()
      expect(ids.has(m.id)).toBe(false)
      ids.add(m.id)
    })
  })
  // El cuadro de eliminatorias (modelo por partidos) se valida en bracket-data.test.js.
})
