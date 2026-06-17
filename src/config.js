// Variables de entorno (Vite expone las que empiezan con VITE_). Las keys NO se
// hardcodean ni se commitean: se cargan desde un archivo .env (ver .env.example).
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}

// Configuración editable de fuentes de datos y sincronización.
export const DATA_CONFIG = {
  // Orden de preferencia. Con una key de API-Football se obtiene cobertura completa.
  primarySource: 'thesportsdb', // 'thesportsdb' | 'api-football' | 'football-data' | 'promiedos'

  // TheSportsDB: gratis, sin key obligatoria. '123' es la key pública (cobertura limitada).
  thesportsdbKey: env.VITE_THESPORTSDB_KEY || '123',

  // API-Football (api-sports.io): free tier 100 req/día, cobertura COMPLETA del Mundial.
  // Registrate en https://www.api-football.com/ y pegá la key en .env como VITE_API_FOOTBALL_KEY.
  apiFootballKey: env.VITE_API_FOOTBALL_KEY || '',

  // football-data.org: free tier, requiere token (https://www.football-data.org/).
  footballDataKey: env.VITE_FOOTBALL_DATA_KEY || '',

  // Promiedos (scraping vía proxy CORS) — último recurso.
  corsProxy: 'https://corsproxy.io/?',
  promiedosUrl: 'https://www.promiedos.com.ar/league/fifa-world-cup/fjda',

  syncIntervalHours: 24,
  livePollSeconds: 60,
}
