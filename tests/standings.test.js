import { describe, it, expect } from 'vitest'
import { computeStandings } from '../src/lib/standings.js'

const teams = ['Argentina', 'Argelia', 'Austria', 'Jordania']
const finished = [
  { equipoA: 'Argentina', equipoB: 'Argelia', resultadoA: 3, resultadoB: 0, estado: 'finalizado' },
  { equipoA: 'Austria', equipoB: 'Jordania', resultadoA: 1, resultadoB: 1, estado: 'finalizado' },
  { equipoA: 'Argentina', equipoB: 'Austria', resultadoA: 2, resultadoB: 1, estado: 'finalizado' },
  { equipoA: 'Argelia', equipoB: 'Jordania', resultadoA: 0, resultadoB: 0, estado: 'programado' }, // ignored
]

describe('computeStandings', () => {
  const table = computeStandings(teams, finished)
  it('Argentina top with 6 pts', () => {
    expect(table[0].equipo).toBe('Argentina')
    expect(table[0].pts).toBe(6)
    expect(table[0].pj).toBe(2)
    expect(table[0].dg).toBe(4)
  })
  it('ignores non-finished matches (Argelia pj=1)', () => {
    expect(table.find((r) => r.equipo === 'Argelia').pj).toBe(1)
  })
  it('returns all 4 teams sorted by pts then dg', () => {
    expect(table.map((r) => r.equipo)).toEqual(['Argentina', 'Jordania', 'Austria', 'Argelia'])
  })
})
