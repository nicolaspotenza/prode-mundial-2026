import { CODES } from './teams.js'

function norm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Variantes en inglés (y otras) → nombre canónico en español usado en la app.
const ENGLISH_ALIASES = {
  mexico: 'México',
  'south africa': 'Sudáfrica',
  'south korea': 'República de Corea',
  'korea republic': 'República de Corea',
  'republic of korea': 'República de Corea',
  'czech republic': 'Chequia',
  czechia: 'Chequia',
  canada: 'Canadá',
  'bosnia herzegovina': 'Bosnia y Herzegovina',
  'bosnia and herzegovina': 'Bosnia y Herzegovina',
  qatar: 'Catar',
  switzerland: 'Suiza',
  brazil: 'Brasil',
  morocco: 'Marruecos',
  haiti: 'Haití',
  scotland: 'Escocia',
  usa: 'Estados Unidos',
  'united states': 'Estados Unidos',
  australia: 'Australia',
  turkey: 'Turquía',
  turkiye: 'Turquía',
  germany: 'Alemania',
  curacao: 'Curazao',
  'ivory coast': 'Costa de Marfil',
  'cote divoire': 'Costa de Marfil',
  netherlands: 'Países Bajos',
  japan: 'Japón',
  sweden: 'Suecia',
  tunisia: 'Túnez',
  belgium: 'Bélgica',
  egypt: 'Egipto',
  iran: 'Irán',
  'new zealand': 'Nueva Zelanda',
  spain: 'España',
  'cape verde': 'Cabo Verde',
  'saudi arabia': 'Arabia Saudita',
  france: 'Francia',
  iraq: 'Irak',
  norway: 'Noruega',
  algeria: 'Argelia',
  jordan: 'Jordania',
  'dr congo': 'DR Congo',
  'congo dr': 'DR Congo',
  'democratic republic of congo': 'DR Congo',
  uzbekistan: 'Uzbekistán',
  england: 'Inglaterra',
  croatia: 'Croacia',
  panama: 'Panamá',
}

// Mapa normalizado: incluye los nombres canónicos (auto, desde CODES) + las variantes.
const LOOKUP = {}
Object.keys(CODES).forEach((name) => {
  LOOKUP[norm(name)] = name
})
Object.entries(ENGLISH_ALIASES).forEach(([k, v]) => {
  LOOKUP[norm(k)] = v
})

// Devuelve el nombre canónico en español, o null si no se reconoce.
export function canonicalTeam(name) {
  if (!name) return null
  return LOOKUP[norm(name)] || null
}
