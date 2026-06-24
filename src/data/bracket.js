// Cuadro de eliminatorias del Mundial 2026 (versión prode).
// Cruces de Dieciseisavos (R32) FIJOS e iguales para todos (detectados de la imagen
// de referencia; todos los equipos coinciden con GRUPOS). El usuario elige el ganador
// de cada cruce y ese ganador avanza en cascada hasta el campeón. 20 pts por acierto.

// El ORDEN de estos 16 cruces define todo el árbol: el partido i de la ronda superior
// enfrenta a los ganadores de los cruces (2i-1) y (2i) de la ronda anterior.
// Mitad izquierda = 1..8, mitad derecha = 9..16; se cruzan en la final.
export const DIECISEISAVOS = [
  { id: 'ko_dieciseisavos_1', teamA: 'Alemania', teamB: 'Escocia' },
  { id: 'ko_dieciseisavos_2', teamA: 'Francia', teamB: 'Suecia' },
  { id: 'ko_dieciseisavos_3', teamA: 'República de Corea', teamB: 'Suiza' },
  { id: 'ko_dieciseisavos_4', teamA: 'Países Bajos', teamB: 'Marruecos' },
  { id: 'ko_dieciseisavos_5', teamA: 'Colombia', teamB: 'Ghana' },
  { id: 'ko_dieciseisavos_6', teamA: 'España', teamB: 'Austria' },
  { id: 'ko_dieciseisavos_7', teamA: 'Estados Unidos', teamB: 'Argelia' },
  { id: 'ko_dieciseisavos_8', teamA: 'Egipto', teamB: 'Chequia' },
  { id: 'ko_dieciseisavos_9', teamA: 'Brasil', teamB: 'Japón' },
  { id: 'ko_dieciseisavos_10', teamA: 'Costa de Marfil', teamB: 'Noruega' },
  { id: 'ko_dieciseisavos_11', teamA: 'México', teamB: 'Cabo Verde' },
  { id: 'ko_dieciseisavos_12', teamA: 'Inglaterra', teamB: 'DR Congo' },
  { id: 'ko_dieciseisavos_13', teamA: 'Argentina', teamB: 'Uruguay' },
  { id: 'ko_dieciseisavos_14', teamA: 'Australia', teamB: 'Irán' },
  { id: 'ko_dieciseisavos_15', teamA: 'Canadá', teamB: 'Bélgica' },
  { id: 'ko_dieciseisavos_16', teamA: 'Portugal', teamB: 'Paraguay' },
]

const ROUND_COUNTS = [
  ['dieciseisavos', 16],
  ['octavos', 8],
  ['cuartos', 4],
  ['semis', 2],
  ['final', 1],
]

export const KO_RONDAS = ROUND_COUNTS.map(([r]) => r)

export const RONDA_LABELS = {
  dieciseisavos: 'Dieciseisavos',
  octavos: 'Octavos',
  cuartos: 'Cuartos',
  semis: 'Semifinales',
  final: 'Final',
}

// Árbol completo de partidos. R32 trae teamA/teamB fijos de DIECISEISAVOS; cada partido
// superior referencia los dos partidos hijos que lo alimentan (teamA/teamB se derivan
// en runtime de los ganadores del usuario). El campeón = ganador de ko_final_1.
export const KO_MATCHES = ROUND_COUNTS.flatMap(([ronda, count], roundIdx) =>
  Array.from({ length: count }, (_, i) => {
    const indice = i + 1
    const id = `ko_${ronda}_${indice}`
    if (roundIdx === 0) {
      const cross = DIECISEISAVOS[i]
      return { id, ronda, indice, teamA: cross.teamA, teamB: cross.teamB, children: null }
    }
    const prev = ROUND_COUNTS[roundIdx - 1][0]
    return {
      id,
      ronda,
      indice,
      teamA: null,
      teamB: null,
      children: [`ko_${prev}_${indice * 2 - 1}`, `ko_${prev}_${indice * 2}`],
    }
  }),
)

// Lo que se siembra en storage (clave `elimination_matches`). `ganador` es el resultado
// REAL del cruce (null hasta conocerse; se completa por el mismo mecanismo que hoy).
export const ELIMINATION_MATCHES = KO_MATCHES.map((m) => ({
  id: m.id,
  ronda: m.ronda,
  indice: m.indice,
  teamA: m.teamA,
  teamB: m.teamB,
  ganador: null,
}))
