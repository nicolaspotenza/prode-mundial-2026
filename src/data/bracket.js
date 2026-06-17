import { GRUPOS } from './groups.js'

// Clasificados por grupo: el usuario predice el 1° y 2° de cada grupo (los que avanzan).
// La predicción se limita a los 4 equipos del grupo. 12 grupos × 2 = 24 slots.
export const QUALIFIER_SLOTS = Object.keys(GRUPOS).flatMap((grupo) => [
  { id: `pos_${grupo}_1`, fase: 'eliminatorias', grupo, posicion: 1, equipoClasificado: null },
  { id: `pos_${grupo}_2`, fase: 'eliminatorias', grupo, posicion: 2, equipoClasificado: null },
])

export const POSICION_LABELS = { 1: '1° del grupo', 2: '2° del grupo' }

// Rondas eliminatorias (versión prode, desde Octavos). Cada slot = un equipo que el
// usuario predice que llega a esa instancia. Se elige entre los equipos clasificados.
const KO_ROUNDS = [
  ['octavos', 16],
  ['cuartos', 8],
  ['semis', 4],
  ['final', 2],
  ['campeon', 1],
]

export const KO_SLOTS = KO_ROUNDS.flatMap(([ronda, count]) =>
  Array.from({ length: count }, (_, i) => ({
    id: `ko_${ronda}_${i + 1}`,
    fase: 'eliminatorias',
    ronda,
    posicion: i + 1,
    equipoClasificado: null,
  })),
)

export const RONDA_LABELS = {
  octavos: 'Octavos',
  cuartos: 'Cuartos',
  semis: 'Semifinales',
  final: 'Final',
  campeon: 'Campeón',
}

export const KO_RONDAS = KO_ROUNDS.map(([r]) => r)

// Todos los slots de eliminatorias que se siembran en storage.
export const ELIMINATION_SLOTS = [...QUALIFIER_SLOTS, ...KO_SLOTS]
