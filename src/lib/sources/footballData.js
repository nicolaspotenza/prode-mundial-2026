import { DATA_CONFIG } from '../../config.js'

function mapStatus(status) {
  if (status === 'FINISHED') return 'finished'
  if (status === 'IN_PLAY' || status === 'PAUSED') return 'live'
  return 'scheduled'
}

// Fallback 2: football-data.org. Requiere API key gratuita.
export async function fetchFootballData() {
  const key = DATA_CONFIG.footballDataKey
  if (!key || key === 'TU_API_KEY_AQUI') return null
  try {
    const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
      headers: { 'X-Auth-Token': key },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.matches?.length) return null
    return data.matches.map((m) => ({
      promiedosId: slugFromTeams(m.homeTeam?.name, m.awayTeam?.name),
      status: mapStatus(m.status),
      rA: m.score?.fullTime?.home ?? 0,
      rB: m.score?.fullTime?.away ?? 0,
      minuto: null,
      eventos: [],
    }))
  } catch {
    return null
  }
}

function slugFromTeams(a, b) {
  const s = (x) =>
    (x || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  return `${s(a)}-vs-${s(b)}`
}
