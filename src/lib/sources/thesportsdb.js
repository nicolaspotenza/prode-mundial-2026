import { DATA_CONFIG } from '../../config.js'

// Fuente principal: TheSportsDB (gratuita, CORS habilitado). Liga 4429 = FIFA World Cup.
// La key gratuita está capada por endpoint, así que se combinan varios (season + rondas)
// y se deduplica por idEvent para maximizar la cobertura sin key premium.
const LEAGUE = 4429
const SEASON = '2026'

function mapStatus(strStatus) {
  const s = (strStatus || '').toUpperCase()
  if (['FT', 'AET', 'PEN', 'MATCH FINISHED', 'FINISHED'].includes(s)) return 'finished'
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INPLAY'].some((x) => s.includes(x))) return 'live'
  return 'scheduled'
}

function toInt(v) {
  return v == null || v === '' ? null : parseInt(v, 10)
}

// Hora real del kickoff en UTC ISO. TheSportsDB la trae en strTimestamp (UTC, sin zona)
// o partida en dateEvent + strTime. Devuelve null si no hay dato.
function kickoffISO(e) {
  if (e.strTimestamp) {
    const t = e.strTimestamp.trim().replace(' ', 'T')
    return /[zZ]|[+-]\d{2}:?\d{2}$/.test(t) ? t : `${t}Z`
  }
  if (e.dateEvent && e.strTime) return `${e.dateEvent}T${e.strTime}Z`
  return null
}

function mapEvent(e) {
  return {
    home: e.strHomeTeam,
    away: e.strAwayTeam,
    status: mapStatus(e.strStatus),
    rA: toInt(e.intHomeScore),
    rB: toInt(e.intAwayScore),
    minuto: e.strProgress || null,
    eventos: [],
    fecha: kickoffISO(e),
  }
}

async function fetchJson(fetchImpl, url) {
  try {
    const r = await fetchImpl(url)
    if (!r || !r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export async function fetchSportsDB(fetchImpl = fetch) {
  const key = DATA_CONFIG.thesportsdbKey || '123'
  const base = `https://www.thesportsdb.com/api/v1/json/${key}`
  const urls = [
    `${base}/eventsseason.php?id=${LEAGUE}&s=${SEASON}`,
    `${base}/eventsround.php?id=${LEAGUE}&r=1&s=${SEASON}`,
    `${base}/eventsround.php?id=${LEAGUE}&r=2&s=${SEASON}`,
    `${base}/eventsround.php?id=${LEAGUE}&r=3&s=${SEASON}`,
  ]
  const all = []
  const seen = new Set()
  for (const u of urls) {
    const data = await fetchJson(fetchImpl, u)
    for (const e of data?.events || []) {
      if (seen.has(e.idEvent)) continue
      seen.add(e.idEvent)
      if (e.strHomeTeam && e.strAwayTeam) all.push(mapEvent(e))
    }
  }
  return all.length ? all : null
}

// Exportado para tests de parseo.
export { mapEvent, mapStatus }
