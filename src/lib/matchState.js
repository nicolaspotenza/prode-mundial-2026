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
