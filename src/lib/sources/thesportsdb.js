// Fuente principal: TheSportsDB (gratuita, CORS habilitado). Liga 4429 = FIFA World Cup.
// Trae resultados reales por ronda (jornadas de grupos 1-3). Status real en strStatus.
const KEY = '3'
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

function mapEvent(e) {
  return {
    home: e.strHomeTeam,
    away: e.strAwayTeam,
    status: mapStatus(e.strStatus),
    rA: toInt(e.intHomeScore),
    rB: toInt(e.intAwayScore),
    minuto: e.strProgress || null,
    eventos: [],
  }
}

export async function fetchSportsDB(fetchImpl = fetch) {
  try {
    const all = []
    const seen = new Set()
    for (const r of [1, 2, 3]) {
      const res = await fetchImpl(
        `https://www.thesportsdb.com/api/v1/json/${KEY}/eventsround.php?id=${LEAGUE}&r=${r}&s=${SEASON}`,
      )
      if (!res || !res.ok) continue
      const data = await res.json()
      for (const e of data.events || []) {
        if (seen.has(e.idEvent)) continue
        seen.add(e.idEvent)
        if (e.strHomeTeam && e.strAwayTeam) all.push(mapEvent(e))
      }
    }
    return all.length ? all : null
  } catch {
    return null
  }
}

// Exportado para tests de parseo.
export { mapEvent, mapStatus }
