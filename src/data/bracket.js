import { GRUPOS } from './groups.js'

// Clasificados por grupo: el usuario predice el 1° y 2° de cada grupo (los que avanzan).
// La predicción se limita a los 4 equipos del grupo. 12 grupos × 2 = 24 slots.
export const QUALIFIER_SLOTS = Object.keys(GRUPOS).flatMap((grupo) => [
  { id: `pos_${grupo}_1`, fase: 'eliminatorias', grupo, posicion: 1, equipoClasificado: null },
  { id: `pos_${grupo}_2`, fase: 'eliminatorias', grupo, posicion: 2, equipoClasificado: null },
])

export const POSICION_LABELS = { 1: '1° del grupo', 2: '2° del grupo' }
