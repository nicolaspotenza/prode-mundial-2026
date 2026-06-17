// Configuración editable de fuentes de datos y sincronización.
export const DATA_CONFIG = {
  primarySource: 'thesportsdb', // 'thesportsdb' | 'promiedos' | 'api-football' | 'football-data'
  corsProxy: 'https://corsproxy.io/?',
  promiedosUrl: 'https://www.promiedos.com.ar/league/fifa-world-cup/fjda',
  apiFootballKey: 'TU_API_KEY_AQUI',
  footballDataKey: 'TU_API_KEY_AQUI',
  syncIntervalHours: 24,
  livePollSeconds: 60,
}
