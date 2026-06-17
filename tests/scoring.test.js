import { describe, it, expect } from 'vitest'
import { calcularPuntosGrupos, calcularPuntosEliminatoria } from '../src/lib/scoring.js'

describe('calcularPuntosGrupos', () => {
  it('exact score = 10', () => expect(calcularPuntosGrupos(3, 0, 3, 0)).toBe(10))
  it('correct winner only = 5 (3-1 pred, 3-0 real)', () => expect(calcularPuntosGrupos(3, 1, 3, 0)).toBe(5))
  it('correct draw = 5 (1-1 pred, 2-2 real)', () => expect(calcularPuntosGrupos(1, 1, 2, 2)).toBe(5))
  it('one team goals only = 2 (0-0 pred, 3-0 real)', () => expect(calcularPuntosGrupos(0, 0, 3, 0)).toBe(2))
  it('one team goals with wrong winner = 2 (3-5 pred, 3-0 real)', () => expect(calcularPuntosGrupos(3, 5, 3, 0)).toBe(2))
  it('nothing right = 0', () => expect(calcularPuntosGrupos(0, 1, 3, 0)).toBe(0))
})

describe('calcularPuntosEliminatoria', () => {
  it('correct team = 10', () => expect(calcularPuntosEliminatoria('Argentina', 'Argentina')).toBe(10))
  it('wrong team = 0', () => expect(calcularPuntosEliminatoria('Brasil', 'Argentina')).toBe(0))
  it('no pick = 0', () => expect(calcularPuntosEliminatoria(null, 'Argentina')).toBe(0))
})
