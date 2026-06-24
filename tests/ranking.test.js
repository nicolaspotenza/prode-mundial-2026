import { describe, it, expect } from 'vitest'
import { buildRanking } from '../src/lib/ranking.js'

const users = [
  { alias: 'Ana', puntosGrupos: 20, puntosEliminatorias: 10 },
  { alias: 'Beto', puntosGrupos: 35, puntosEliminatorias: 0 },
  { alias: 'Caro', puntosGrupos: 30, puntosEliminatorias: 10 },
]

describe('buildRanking', () => {
  const r = buildRanking(users)
  it('sorts by total desc', () => expect(r.map((u) => u.alias)).toEqual(['Caro', 'Beto', 'Ana']))
  it('assigns positions', () => expect(r[0].pos).toBe(1))
  it('computes total', () => expect(r[0].total).toBe(40))
  it('includes per-user bonus in total', () => {
    const b = buildRanking([{ alias: 'Z', puntosGrupos: 10, puntosEliminatorias: 0, bonus: 15 }])
    expect(b[0].total).toBe(25)
  })
})
