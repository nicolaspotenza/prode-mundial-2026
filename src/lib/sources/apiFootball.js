import { DATA_CONFIG } from '../../config.js'

const LIVE_STATUSES = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE']

function mapStatus(short) {
  if (short === 'FT' || short === 'AET' || short === 'PEN') return 'finished'
  if (LIVE_STATUSES.includes(short)) return 'live'
  return 'scheduled'
}

// Fallback 1: API-Football (RapidAPI / api-sports). Requiere API key gratuita.
export async function fetchApiFootball() {
  const key = DATA_CONFIG.apiFootballKey
  if (!key) return null
  try {
    const res = await fetch('https://v3.football.api-sports.io/fixtures?league=1&season=2026', {
      headers: { 'x-apisports-key': key },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.response?.length) return null
    return data.response.map((f) => ({
      home: f.teams?.home?.name,
      away: f.teams?.away?.name,
      status: mapStatus(f.fixture?.status?.short),
      rA: f.goals?.home ?? null,
      rB: f.goals?.away ?? null,
      minuto: f.fixture?.status?.elapsed ?? null,
      eventos: [],
      fecha: f.fixture?.date ?? null,
      // En eliminatorias, API-Football marca con `winner: true` al equipo que avanza
      // (incluye definición por penales). applyKnockout lo prioriza sobre los goles.
      ganador: f.teams?.home?.winner ? f.teams?.home?.name : f.teams?.away?.winner ? f.teams?.away?.name : null,
    }))
  } catch {
    return null
  }
}
