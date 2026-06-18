// Migración de datos locales (localStorage del shim) al backend compartido.
// Merge NO destructivo: el backend siempre gana; lo local solo rellena huecos. Nunca
// pisa apuestas hechas en otro dispositivo ni rompe el array compartido `users`.
import { calcularPuntosGrupos } from './scoring.js'
import { recomputeUserTotals } from './recalc.js'

const PREFIX = 'prode:'
const MIGRATED_FLAG = 'migrated'

// Lee una clave local directo de localStorage, independiente del adaptador activo.
export function readLocalRaw(key) {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(PREFIX + key)
    return raw == null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

// ¿Hay datos compartidos varados en el localStorage de este dispositivo, sin migrar?
// OJO: `current_user` es device-local por diseño (siempre vive en localStorage), así que
// NO cuenta como dato a migrar; lo que importa es `users` (que antes de Upstash quedaba
// varado en el shim local). Sin él, todo dispositivo mostraría el botón para siempre.
export function hasLocalData() {
  if (readLocalRaw(MIGRATED_FLAG)) return false
  const users = readLocalRaw('users')
  return Boolean(Array.isArray(users) && users.length)
}

function markMigrated() {
  try {
    localStorage?.setItem(PREFIX + MIGRATED_FLAG, JSON.stringify(true))
  } catch {
    /* ignore */
  }
}

// Mantiene los usuarios del backend por alias (case-insensitive) y agrega los locales
// que no estén presentes.
export function mergeUsers(remote, local) {
  const out = [...(remote || [])]
  const seen = new Set(out.map((u) => u.alias.toLowerCase()))
  for (const u of local || []) {
    if (!seen.has(u.alias.toLowerCase())) {
      out.push(u)
      seen.add(u.alias.toLowerCase())
    }
  }
  return out
}

// Arranca del backend; agrega solo los ítems locales cuya clave no exista en el backend.
export function mergeByKey(remote, local, keyField) {
  const out = [...(remote || [])]
  const seen = new Set(out.map((p) => p[keyField]))
  for (const p of local || []) {
    if (!seen.has(p[keyField])) {
      out.push(p)
      seen.add(p[keyField])
    }
  }
  return out
}

// Recalcula `puntos` de cada pronóstico de grupos contra los partidos finalizados.
export function rescoreGroupPreds(list, matches) {
  const byId = new Map((matches || []).map((m) => [m.id, m]))
  return (list || []).map((p) => {
    const m = byId.get(p.matchId)
    const puntos =
      m && m.estado === 'finalizado' && m.resultadoA != null && m.resultadoB != null
        ? calcularPuntosGrupos(p.pronosticoA, p.pronosticoB, m.resultadoA, m.resultadoB)
        : null
    return { ...p, puntos }
  })
}

// Orquesta la migración. `localReader(key)` devuelve el valor local (inyectable en tests;
// por defecto lee de localStorage).
export async function migrateLocalToRemote({ storage, matches, localReader = readLocalRaw } = {}) {
  const localUsers = localReader('users') || []
  const remoteUsers = (await storage.get('users')) || []
  const mergedUsers = mergeUsers(remoteUsers, localUsers)

  let gruposAdded = 0
  let llavesAdded = 0

  for (const u of localUsers) {
    const gKey = `pronosticos_grupos:${u.alias}`
    const eKey = `pronosticos_eliminatorias:${u.alias}`

    const localG = localReader(gKey) || []
    const remoteG = (await storage.get(gKey)) || []
    const mergedG = rescoreGroupPreds(mergeByKey(remoteG, localG, 'matchId'), matches)
    gruposAdded += mergedG.length - remoteG.length
    await storage.set(gKey, mergedG)

    const localE = localReader(eKey) || []
    const remoteE = (await storage.get(eKey)) || []
    const mergedE = mergeByKey(remoteE, localE, 'slotId')
    llavesAdded += mergedE.length - remoteE.length
    await storage.set(eKey, mergedE)
  }

  await storage.set('users', mergedUsers)
  await recomputeUserTotals()
  markMigrated()

  return { migratedUsers: localUsers.length, gruposAdded, llavesAdded }
}
