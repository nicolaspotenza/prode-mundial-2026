import { storage } from './storage.js'
import { FIXTURES } from '../data/fixtures.js'
import { ELIMINATION_MATCHES } from '../data/bracket.js'
import { recomputeUserTotals } from './recalc.js'

// Subir esta versión fuerza re-sembrar partidos/cuadro cuando cambia su estructura.
// Los pronósticos de grupos NO se tocan (van por matchId).
const SEED_VERSION = 3

// Siembra el storage compartido con los partidos y el cuadro hardcodeados.
// La sincronización luego actualiza estos registros con datos reales.
export async function ensureSeeded(store = storage) {
  const version = await store.get('seed_version')
  const firstRun = version == null

  // Sembrar matches/elimination_matches SOLO en el primer arranque del backend
  // (seed_version ausente). Si el backend ya fue inicializado, un read vacío de estas
  // claves es casi siempre un fallo transitorio del storage remoto (cae al shim local
  // vacío), NO datos faltantes: re-sembrar pisaría los resultados en vivo con el fixture
  // en blanco, y el próximo applySync vería decenas de finalizados "nuevos" disparando un
  // recálculo masivo por usuario que cuelga la carga. Por eso nunca se re-siembra.
  if (firstRun) {
    if (!(await store.get('matches'))?.length) {
      await store.set('matches', FIXTURES.map((m) => ({ ...m })))
    }
    if (!(await store.get('elimination_matches'))?.length) {
      await store.set('elimination_matches', ELIMINATION_MATCHES.map((m) => ({ ...m })))
    }
  }

  if (version !== SEED_VERSION) {
    // El modelo viejo de eliminatorias (slots `pos_`/`ko_*` con `slotId`) es incompatible
    // con el nuevo (por `matchId`). Descartamos esos pronósticos sin tocar los de grupos.
    let limpiado = false
    const users = (await store.get('users')) || []
    for (const u of users) {
      const key = `pronosticos_eliminatorias:${u.alias}`
      const list = (await store.get(key)) || []
      const cleaned = list.filter((p) => p.matchId)
      if (cleaned.length !== list.length) {
        await store.set(key, cleaned)
        limpiado = true
      }
    }
    if (limpiado) await recomputeUserTotals(store)
    await store.set('seed_version', SEED_VERSION)
  }
}
