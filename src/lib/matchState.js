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

// Las apuestas están abiertas solo si el partido está programado Y todavía no llegó
// su hora de inicio. Al pasar el horario, la apuesta se cierra aunque no haya datos
// en vivo todavía (no se puede apostar a un partido que ya empezó).
export function isBettingOpen(match, now = Date.now()) {
  if (!match || match.estado !== 'programado') return false
  return new Date(match.fecha).getTime() > now
}
