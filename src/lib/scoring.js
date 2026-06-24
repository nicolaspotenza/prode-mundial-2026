// Group-stage scoring is exclusive-upward (not additive):
//   exact score = 10; correct winner/draw = 5; else +2 per team whose goal count matched.
export function calcularPuntosGrupos(pA, pB, rA, rB) {
  if (pA === rA && pB === rB) return 10
  const gP = pA > pB ? 'A' : pA < pB ? 'B' : 'E'
  const gR = rA > rB ? 'A' : rA < rB ? 'B' : 'E'
  if (gP === gR) return 5
  let pts = 0
  if (pA === rA) pts += 2
  if (pB === rB) pts += 2
  return pts
}

// Knockouts: all-or-nothing, sin marcador — solo el ganador del cruce.
export function calcularPuntosEliminatoria(ganadorElegido, ganadorReal) {
  return ganadorElegido != null && ganadorReal != null && ganadorElegido === ganadorReal ? 20 : 0
}
