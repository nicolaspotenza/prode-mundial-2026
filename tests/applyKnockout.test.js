import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { applyKnockout, winnerOf } from '../src/lib/applyKnockout.js'
import { ELIMINATION_MATCHES } from '../src/data/bracket.js'

beforeEach(() => storage._resetForTests())

function seedElim() {
  return storage.set('elimination_matches', ELIMINATION_MATCHES.map((m) => ({ ...m })))
}

describe('winnerOf', () => {
  it('usa el ganador provisto por la fuente si existe', () => {
    expect(winnerOf({ ganador: 'Paraguay', rA: 1, rB: 1 }, 'Alemania', 'Paraguay')).toBe('Paraguay')
  })
  it('si no, gana el de más goles', () => {
    expect(winnerOf({ rA: 2, rB: 1 }, 'Alemania', 'Paraguay')).toBe('Alemania')
    expect(winnerOf({ rA: 0, rB: 3 }, 'Alemania', 'Paraguay')).toBe('Paraguay')
  })
  it('empate sin ganador de fuente → null (pendiente)', () => {
    expect(winnerOf({ rA: 1, rB: 1 }, 'Alemania', 'Paraguay')).toBeNull()
  })
})

describe('applyKnockout', () => {
  it('detecta el ganador de un dieciseisavo por par de equipos (canónico, cualquier orden)', async () => {
    await seedElim()
    // La fuente trae los nombres en inglés y con local/visitante invertidos.
    const updates = [{ home: 'Paraguay', away: 'Germany', status: 'finished', rA: 2, rB: 1 }]
    const { resolved } = await applyKnockout(updates)
    expect(resolved).toContain('ko_dieciseisavos_1')
    const elim = await storage.get('elimination_matches')
    expect(elim.find((m) => m.id === 'ko_dieciseisavos_1').ganador).toBe('Paraguay')
  })

  it('itera hasta estabilizar: resuelve un octavo en el mismo lote que sus dieciseisavos', async () => {
    await seedElim()
    const updates = [
      { home: 'Alemania', away: 'Paraguay', status: 'finished', rA: 3, rB: 0 }, // dieciseisavos_1 → Alemania
      { home: 'Francia', away: 'Suecia', status: 'finished', rA: 2, rB: 0 },     // dieciseisavos_2 → Francia
      { home: 'Alemania', away: 'Francia', status: 'finished', rA: 1, rB: 0 },   // octavos_1 → Alemania
    ]
    const { resolved } = await applyKnockout(updates)
    expect(resolved).toEqual(expect.arrayContaining(['ko_dieciseisavos_1', 'ko_dieciseisavos_2', 'ko_octavos_1']))
    const elim = await storage.get('elimination_matches')
    expect(elim.find((m) => m.id === 'ko_octavos_1').ganador).toBe('Alemania')
  })

  it('otorga +20 a quien acertó el ganador del cruce', async () => {
    await seedElim()
    await storage.set('users', [{ alias: 'Ana', puntosEliminatorias: 0 }])
    await storage.set('pronosticos_eliminatorias:Ana', [
      { userId: 'Ana', matchId: 'ko_dieciseisavos_1', ganador: 'Alemania', puntos: null },
    ])
    await applyKnockout([{ home: 'Alemania', away: 'Paraguay', status: 'finished', rA: 2, rB: 1 }])
    const ana = (await storage.get('users')).find((u) => u.alias === 'Ana')
    expect(ana.puntosEliminatorias).toBe(20)
  })

  it('guard anti-pisado: si elimination_matches viene vacío, no escribe', async () => {
    // No sembramos elimination_matches (read vacío).
    const { resolved } = await applyKnockout([{ home: 'Alemania', away: 'Paraguay', status: 'finished', rA: 2, rB: 1 }])
    expect(resolved).toEqual([])
    expect(await storage.get('elimination_matches')).toBeNull()
  })

  it('captura estado en_vivo y minuto sin definir ganador', async () => {
    await seedElim()
    const { resolved } = await applyKnockout([
      { home: 'Alemania', away: 'Paraguay', status: 'live', rA: 0, rB: 0, minuto: "57'" },
    ])
    expect(resolved).toEqual([]) // en vivo no define ganador
    const m = (await storage.get('elimination_matches')).find((x) => x.id === 'ko_dieciseisavos_1')
    expect(m.estado).toBe('en_vivo')
    expect(m.minuto).toBe("57'")
    expect(m.ganador).toBeNull()
  })

  it('captura fecha/estado programado de un cruce R32 aún no jugado', async () => {
    await seedElim()
    await applyKnockout([
      { home: 'Alemania', away: 'Paraguay', status: 'scheduled', rA: null, rB: null, fecha: '2026-07-01T18:00:00Z' },
    ])
    const m = (await storage.get('elimination_matches')).find((x) => x.id === 'ko_dieciseisavos_1')
    expect(m.estado).toBe('programado')
    expect(m.fecha).toBe('2026-07-01T18:00:00Z')
  })

  it('idempotente: segundo sync sin novedades no reprocesa', async () => {
    await seedElim()
    const updates = [{ home: 'Alemania', away: 'Paraguay', status: 'finished', rA: 2, rB: 1 }]
    const first = await applyKnockout(updates)
    expect(first.resolved).toContain('ko_dieciseisavos_1')
    const second = await applyKnockout(updates)
    expect(second.resolved).toEqual([]) // ya estaba resuelto → no vuelve a aparecer
  })

  it('3er puesto: ganador es 3.º, detectado por su propio partido', async () => {
    // El cuadro real se resuelve por cascada: los equipos de las semis se derivan de los
    // ganadores reales de cuartos. Sembramos esa cadena para que el 3er puesto (perdedores
    // de las semis) tenga participantes Brasil y España.
    const elim = ELIMINATION_MATCHES.map((m) => ({ ...m }))
    const setGan = (id, ganador) => { elim.find((x) => x.id === id).ganador = ganador }
    setGan('ko_cuartos_1', 'Argentina')
    setGan('ko_cuartos_2', 'Brasil')
    setGan('ko_cuartos_3', 'Francia')
    setGan('ko_cuartos_4', 'España')
    setGan('ko_semis_1', 'Argentina') // semis_1 = Argentina vs Brasil → pierde Brasil
    setGan('ko_semis_2', 'Francia')   // semis_2 = Francia vs España → pierde España
    await storage.set('elimination_matches', elim)
    const { resolved } = await applyKnockout([
      { home: 'Brasil', away: 'España', status: 'finished', rA: 2, rB: 1 }, // 3er puesto → Brasil
    ])
    expect(resolved).toContain('ko_tercer_1')
    const after = await storage.get('elimination_matches')
    expect(after.find((m) => m.id === 'ko_tercer_1').ganador).toBe('Brasil')
  })
})
