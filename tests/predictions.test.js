import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { getOthersGroupPredictions, setKnockoutPrediction, getKnockoutPredictions } from '../src/lib/predictions.js'

beforeEach(() => storage._resetForTests())

describe('setKnockoutPrediction', () => {
  it('poda el pick aguas arriba que quedó inválido por el ganador REAL', async () => {
    // Realidad: en dieciseisavos_1 avanzó Paraguay (no Alemania).
    await storage.set('elimination_matches', [
      { id: 'ko_dieciseisavos_1', ronda: 'dieciseisavos', ganador: 'Paraguay' },
    ])
    // El usuario tenía un pick de octavos_1 apostando a Alemania (que ya no participa).
    await storage.set('pronosticos_eliminatorias:Ana', [
      { userId: 'Ana', matchId: 'ko_octavos_1', ganador: 'Alemania', puntos: null },
    ])

    // Hace un pick nuevo cualquiera; al re-resolver con la realidad, el de octavos cae.
    await setKnockoutPrediction('Ana', 'ko_dieciseisavos_2', 'Francia')

    const list = await getKnockoutPredictions('Ana')
    expect(list.find((p) => p.matchId === 'ko_octavos_1')).toBeUndefined()
    expect(list.find((p) => p.matchId === 'ko_dieciseisavos_2').ganador).toBe('Francia')
  })
})

describe('getOthersGroupPredictions', () => {
  beforeEach(async () => {
    await storage.set('users', [{ alias: 'Ana' }, { alias: 'Beto' }, { alias: 'Nico' }])
    await storage.set('pronosticos_grupos:Ana', [{ matchId: 'g_A_0', pronosticoA: 2, pronosticoB: 0, puntos: 10 }])
    await storage.set('pronosticos_grupos:Beto', [{ matchId: 'g_A_0', pronosticoA: 1, pronosticoB: 1, puntos: 0 }])
    // Nico solo apostó otro partido → no aparece para g_A_0
    await storage.set('pronosticos_grupos:Nico', [{ matchId: 'g_A_1', pronosticoA: 0, pronosticoB: 0, puntos: null }])
  })

  it('returns other players who bet on the match, excluding the current user', async () => {
    const out = await getOthersGroupPredictions('g_A_0', 'Ana')
    expect(out).toEqual([{ alias: 'Beto', pronosticoA: 1, pronosticoB: 1, puntos: 0 }])
  })

  it('includes everyone when no alias is excluded', async () => {
    const out = await getOthersGroupPredictions('g_A_0')
    expect(out.map((o) => o.alias).sort()).toEqual(['Ana', 'Beto'])
  })

  it('excludes the current user case-insensitively', async () => {
    const out = await getOthersGroupPredictions('g_A_0', 'ana')
    expect(out.map((o) => o.alias)).toEqual(['Beto'])
  })

  it('ignores predictions without a loaded score', async () => {
    await storage.set('pronosticos_grupos:Beto', [{ matchId: 'g_A_0', pronosticoA: null, pronosticoB: null, puntos: null }])
    const out = await getOthersGroupPredictions('g_A_0', 'Ana')
    expect(out).toEqual([])
  })

  it('returns empty when there are no users', async () => {
    await storage.set('users', [])
    expect(await getOthersGroupPredictions('g_A_0', 'Ana')).toEqual([])
  })
})
