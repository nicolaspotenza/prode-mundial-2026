import { DATA_CONFIG } from '../../config.js'

// Fuente principal: scraping del HTML de Promiedos a través de un proxy CORS.
// Debe ser defensivo: ante cualquier fallo o cambio de estructura, devolver null
// para que la cadena de fallback degrade silenciosamente.
export async function fetchPromiedos() {
  try {
    const res = await fetch(DATA_CONFIG.corsProxy + encodeURIComponent(DATA_CONFIG.promiedosUrl))
    if (!res || !res.ok) return null
    const html = await res.text()
    if (!html) return null
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return parsePartidosDesdeHTML(doc)
  } catch {
    return null
  }
}

// Devuelve la forma común: Array<{ promiedosId, status, rA, rB, minuto, eventos }>
// La estructura del HTML de Promiedos puede cambiar; el parser intenta ser tolerante
// y, si no encuentra partidos reconocibles, devuelve null para activar el fallback.
export function parsePartidosDesdeHTML(doc) {
  try {
    const nodes = doc.querySelectorAll('[data-match], .match, [class*="match"]')
    if (!nodes || nodes.length === 0) return null
    const out = []
    nodes.forEach((node) => {
      const pid = node.getAttribute?.('data-match-id') || node.getAttribute?.('data-id')
      const text = (node.textContent || '').toLowerCase()
      const status = text.includes('final') ? 'finished' : text.includes('en vivo') || text.includes("'") ? 'live' : 'scheduled'
      const scores = (node.textContent || '').match(/(\d+)\s*[-:]\s*(\d+)/)
      if (!pid || !scores) return
      out.push({
        promiedosId: pid,
        status,
        rA: parseInt(scores[1], 10),
        rB: parseInt(scores[2], 10),
        minuto: null,
        eventos: [],
      })
    })
    return out.length ? out : null
  } catch {
    return null
  }
}
