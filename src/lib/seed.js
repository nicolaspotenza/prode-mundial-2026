import { storage } from './storage.js'
import { FIXTURES } from '../data/fixtures.js'
import { QUALIFIER_SLOTS } from '../data/bracket.js'

// Siembra el storage compartido con los partidos y el bracket hardcodeados,
// solo si aún no existen. La sincronización luego actualiza estos registros.
export async function ensureSeeded() {
  const matches = await storage.get('matches')
  if (!matches || matches.length === 0) {
    await storage.set('matches', FIXTURES.map((m) => ({ ...m })))
  }
  const slots = await storage.get('elimination_slots')
  if (!slots || slots.length === 0) {
    await storage.set('elimination_slots', QUALIFIER_SLOTS.map((s) => ({ ...s })))
  }
}
