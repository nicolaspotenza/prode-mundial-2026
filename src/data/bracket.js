// Formato Mundial 2026: 32 clasificados (2 por grupo + 8 mejores terceros).
// Rondas: Dieciseisavos (16) -> Octavos (8) -> Cuartos (4) -> Semis (2) -> Final (1).
const RONDAS = [
  ['dieciseisavos', 16],
  ['octavos', 8],
  ['cuartos', 4],
  ['semis', 2],
  ['final', 1],
]

export const BRACKET = RONDAS.flatMap(([ronda, count]) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${ronda}_${i + 1}`,
    fase: 'eliminatorias',
    ronda,
    posicion: i + 1,
    equipoClasificado: null,
  })),
)

export const RONDA_LABELS = {
  dieciseisavos: 'Dieciseisavos',
  octavos: 'Octavos',
  cuartos: 'Cuartos',
  semis: 'Semifinales',
  final: 'Final',
}
