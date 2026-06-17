import { storage } from './storage.js'
import { FIXTURES } from '../data/fixtures.js'
import { ELIMINATION_SLOTS } from '../data/bracket.js'

// Subir esta versión fuerza re-sembrar partidos/slots cuando cambia su estructura
// (p. ej. al pasar al fixture oficial). Los pronósticos no se tocan: van por matchId/slotId.
const SEED_VERSION = 2

// Siembra el storage compartido con los partidos y el bracket hardcodeados.
// La sincronización luego actualiza estos registros con datos reales.
export async function ensureSeeded() {
  const version = await storage.get('seed_version')
  const matches = await storage.get('matches')
  const stale = version !== SEED_VERSION

  if (stale || !matches || matches.length === 0) {
    await storage.set('matches', FIXTURES.map((m) => ({ ...m })))
  }

  const slots = await storage.get('elimination_slots')
  if (stale || !slots || slots.length === 0) {
    await storage.set('elimination_slots', ELIMINATION_SLOTS.map((s) => ({ ...s })))
  }

  if (stale) await storage.set('seed_version', SEED_VERSION)
}
