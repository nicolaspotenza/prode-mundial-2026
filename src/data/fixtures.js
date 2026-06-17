import { GRUPOS } from './groups.js'

// Round-robin de 4 equipos: 6 partidos en 3 fechas (índices de equipo dentro del grupo).
const ROUND_ROBIN = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [3, 0],
  [1, 2],
]

const GROUP_START = Date.UTC(2026, 5, 11) // 11 jun 2026
const DAY = 86400000

function slug(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Fechas/horas aproximadas del sorteo; la sincronización las refina con datos oficiales.
function kickoff(groupIndex, matchIndex) {
  const matchday = Math.floor(matchIndex / 2) // 0,0,1,1,2,2
  const ms = GROUP_START + (matchday * 5 + (groupIndex % 5)) * DAY + ((groupIndex % 4) * 3 + 15) * 3600000
  return new Date(ms).toISOString()
}

export const FIXTURES = Object.entries(GRUPOS).flatMap(([grupo, teams], gi) =>
  ROUND_ROBIN.map(([iA, iB], mi) => {
    const equipoA = teams[iA]
    const equipoB = teams[iB]
    return {
      id: `g_${grupo}_${mi}`,
      fase: 'grupos',
      grupo,
      fecha: kickoff(gi, mi),
      equipoA,
      equipoB,
      resultadoA: null,
      resultadoB: null,
      estado: 'programado',
      minuto: null,
      promiedosId: `${slug(equipoA)}-vs-${slug(equipoB)}`,
    }
  }),
)
