// Fixture oficial de la fase de grupos del Mundial 2026 (fuente: calendario FIFA/ESPN).
// Cada grupo: 6 partidos en 3 fechas. Las horas son aproximadas (la sync las refina).
const SCHEDULE = {
  A: [
    ['México', 'Sudáfrica', '2026-06-11'],
    ['República de Corea', 'Chequia', '2026-06-11'],
    ['Chequia', 'Sudáfrica', '2026-06-18'],
    ['México', 'República de Corea', '2026-06-18'],
    ['Chequia', 'México', '2026-06-24'],
    ['Sudáfrica', 'República de Corea', '2026-06-24'],
  ],
  B: [
    ['Canadá', 'Bosnia y Herzegovina', '2026-06-12'],
    ['Catar', 'Suiza', '2026-06-12'],
    ['Suiza', 'Bosnia y Herzegovina', '2026-06-18'],
    ['Canadá', 'Catar', '2026-06-18'],
    ['Bosnia y Herzegovina', 'Catar', '2026-06-24'],
    ['Suiza', 'Canadá', '2026-06-24'],
  ],
  C: [
    ['Brasil', 'Marruecos', '2026-06-13'],
    ['Haití', 'Escocia', '2026-06-13'],
    ['Escocia', 'Marruecos', '2026-06-19'],
    ['Brasil', 'Haití', '2026-06-19'],
    ['Escocia', 'Brasil', '2026-06-24'],
    ['Marruecos', 'Haití', '2026-06-24'],
  ],
  D: [
    ['Estados Unidos', 'Paraguay', '2026-06-12'],
    ['Australia', 'Turquía', '2026-06-12'],
    ['Estados Unidos', 'Australia', '2026-06-19'],
    ['Turquía', 'Paraguay', '2026-06-19'],
    ['Turquía', 'Estados Unidos', '2026-06-25'],
    ['Paraguay', 'Australia', '2026-06-25'],
  ],
  E: [
    ['Alemania', 'Curazao', '2026-06-14'],
    ['Costa de Marfil', 'Ecuador', '2026-06-14'],
    ['Alemania', 'Costa de Marfil', '2026-06-20'],
    ['Ecuador', 'Curazao', '2026-06-20'],
    ['Ecuador', 'Alemania', '2026-06-25'],
    ['Curazao', 'Costa de Marfil', '2026-06-25'],
  ],
  F: [
    ['Países Bajos', 'Japón', '2026-06-14'],
    ['Suecia', 'Túnez', '2026-06-14'],
    ['Países Bajos', 'Suecia', '2026-06-20'],
    ['Túnez', 'Japón', '2026-06-20'],
    ['Japón', 'Suecia', '2026-06-25'],
    ['Túnez', 'Países Bajos', '2026-06-25'],
  ],
  G: [
    ['Bélgica', 'Egipto', '2026-06-15'],
    ['Irán', 'Nueva Zelanda', '2026-06-15'],
    ['Bélgica', 'Irán', '2026-06-21'],
    ['Nueva Zelanda', 'Egipto', '2026-06-21'],
    ['Egipto', 'Irán', '2026-06-26'],
    ['Nueva Zelanda', 'Bélgica', '2026-06-26'],
  ],
  H: [
    ['España', 'Cabo Verde', '2026-06-15'],
    ['Arabia Saudita', 'Uruguay', '2026-06-15'],
    ['España', 'Arabia Saudita', '2026-06-21'],
    ['Uruguay', 'Cabo Verde', '2026-06-21'],
    ['Cabo Verde', 'Arabia Saudita', '2026-06-26'],
    ['Uruguay', 'España', '2026-06-26'],
  ],
  I: [
    ['Francia', 'Senegal', '2026-06-16'],
    ['Irak', 'Noruega', '2026-06-16'],
    ['Francia', 'Irak', '2026-06-22'],
    ['Noruega', 'Senegal', '2026-06-22'],
    ['Noruega', 'Francia', '2026-06-26'],
    ['Senegal', 'Irak', '2026-06-26'],
  ],
  J: [
    ['Argentina', 'Argelia', '2026-06-16'],
    ['Austria', 'Jordania', '2026-06-16'],
    ['Argentina', 'Austria', '2026-06-22'],
    ['Jordania', 'Argelia', '2026-06-22'],
    ['Argelia', 'Austria', '2026-06-27'],
    ['Jordania', 'Argentina', '2026-06-27'],
  ],
  K: [
    ['Portugal', 'DR Congo', '2026-06-17'],
    ['Uzbekistán', 'Colombia', '2026-06-17'],
    ['Portugal', 'Uzbekistán', '2026-06-23'],
    ['Colombia', 'DR Congo', '2026-06-23'],
    ['Colombia', 'Portugal', '2026-06-27'],
    ['DR Congo', 'Uzbekistán', '2026-06-27'],
  ],
  L: [
    ['Inglaterra', 'Croacia', '2026-06-17'],
    ['Ghana', 'Panamá', '2026-06-17'],
    ['Inglaterra', 'Ghana', '2026-06-23'],
    ['Panamá', 'Croacia', '2026-06-23'],
    ['Panamá', 'Inglaterra', '2026-06-27'],
    ['Croacia', 'Ghana', '2026-06-27'],
  ],
}

function slug(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Hora aproximada alternada para no apilar todos los partidos del día a la misma hora.
function kickoff(date, idx) {
  const hour = idx % 2 === 0 ? '16:00:00Z' : '19:00:00Z'
  return `${date}T${hour}`
}

export const FIXTURES = Object.entries(SCHEDULE).flatMap(([grupo, partidos]) =>
  partidos.map(([equipoA, equipoB, fecha], mi) => ({
    id: `g_${grupo}_${mi}`,
    fase: 'grupos',
    grupo,
    fecha: kickoff(fecha, mi),
    equipoA,
    equipoB,
    resultadoA: null,
    resultadoB: null,
    estado: 'programado',
    minuto: null,
    promiedosId: `${slug(equipoA)}-vs-${slug(equipoB)}`,
  })),
)
