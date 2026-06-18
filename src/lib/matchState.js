// source: { status: 'finished' | 'live' | 'scheduled' } | null
// Never auto-promote to live without source confirmation (silent degradation).
export function deriveEstado(source, kickoffISO, nowISO) {
  if (source?.status === 'finished') return 'finalizado'
  if (source?.status === 'live') return 'en_vivo'
  return 'programado'
}

export function isBloqueado(estado) {
  return estado !== 'programado'
}

// Las apuestas se cierran 1 hora antes del inicio del partido. Mientras falte más de
// una hora para el kickoff y el partido siga programado, la apuesta está abierta; al
// entrar en la última hora (o si ya empezó) se cierra.
export const BETTING_CLOSE_MS = 60 * 60 * 1000 // 1 hora

export function isBettingOpen(match, now = Date.now()) {
  if (!match || match.estado !== 'programado') return false
  return new Date(match.fecha).getTime() - BETTING_CLOSE_MS > now
}

// Un partido no puede quedar "en vivo" para siempre si la fuente se cuelga en un estado
// live viejo (la key gratuita de TheSportsDB no siempre marca FT) o deja de reportarlo.
// Pasado este margen desde el kickoff lo damos por finalizado con el último marcador
// conocido. Solo se sincronizan en vivo los partidos de grupos (sin alargue ni penales:
// ~90' + descuento + entretiempo ≈ 2h máx de reloj), así que 2h15 cierra con margen sin
// riesgo de cerrar uno todavía en juego.
export const MAX_MATCH_MS = 135 * 60 * 1000

