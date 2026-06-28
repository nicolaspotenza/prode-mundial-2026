import { describe, it, expect, vi } from 'vitest'
import { mapEvent, mapStatus, fetchSportsDB } from '../src/lib/sources/thesportsdb.js'
import { canonicalTeam } from '../src/data/aliases.js'

describe('canonicalTeam', () => {
  it('maps English to Spanish', () => {
    expect(canonicalTeam('South Korea')).toBe('República de Corea')
    expect(canonicalTeam('Czech Republic')).toBe('Chequia')
    expect(canonicalTeam('USA')).toBe('Estados Unidos')
    expect(canonicalTeam('Bosnia-Herzegovina')).toBe('Bosnia y Herzegovina')
  })
  it('passes through canonical Spanish names', () => {
    expect(canonicalTeam('México')).toBe('México')
    expect(canonicalTeam('mexico')).toBe('México')
  })
  it('returns null for unknown', () => {
    expect(canonicalTeam('Narnia')).toBeNull()
    expect(canonicalTeam('')).toBeNull()
  })
})

describe('thesportsdb mapStatus', () => {
  it('FT -> finished', () => expect(mapStatus('FT')).toBe('finished'))
  it('2H -> live', () => expect(mapStatus('2H')).toBe('live'))
  it('NS -> scheduled', () => expect(mapStatus('NS')).toBe('scheduled'))
})

describe('thesportsdb mapEvent', () => {
  it('maps a real event shape to common shape', () => {
    const out = mapEvent({
      strHomeTeam: 'Mexico',
      strAwayTeam: 'South Africa',
      intHomeScore: '2',
      intAwayScore: '0',
      strStatus: 'FT',
      strProgress: null,
    })
    expect(out).toEqual({ home: 'Mexico', away: 'South Africa', status: 'finished', rA: 2, rB: 0, minuto: null, eventos: [], fecha: null })
  })
  it('null scores for not-started', () => {
    const out = mapEvent({ strHomeTeam: 'Canada', strAwayTeam: 'Qatar', intHomeScore: null, intAwayScore: null, strStatus: 'NS' })
    expect(out.rA).toBeNull()
    expect(out.status).toBe('scheduled')
  })
  it('captures kickoff from strTimestamp (normalized to UTC ISO)', () => {
    const out = mapEvent({ strHomeTeam: 'A', strAwayTeam: 'B', strStatus: 'NS', strTimestamp: '2026-06-18T19:00:00' })
    expect(out.fecha).toBe('2026-06-18T19:00:00Z')
  })
  it('falls back to dateEvent + strTime for kickoff', () => {
    const out = mapEvent({ strHomeTeam: 'A', strAwayTeam: 'B', strStatus: 'NS', dateEvent: '2026-06-18', strTime: '19:00:00' })
    expect(out.fecha).toBe('2026-06-18T19:00:00Z')
  })
})

describe('fetchSportsDB', () => {
  it('aggregates rounds and dedupes by idEvent', async () => {
    const fakeFetch = vi.fn(async (url) => ({
      ok: true,
      json: async () =>
        url.includes('r=1&') // ronda 1 (grupo), no confundir con r=16
          ? { events: [{ idEvent: '1', strHomeTeam: 'Mexico', strAwayTeam: 'South Africa', intHomeScore: '2', intAwayScore: '0', strStatus: 'FT' }] }
          : { events: [] },
    }))
    const out = await fetchSportsDB(fakeFetch)
    expect(out).toHaveLength(1)
    expect(out[0].home).toBe('Mexico')
  })

  it('trae los partidos de eliminatorias (ronda 32) además de los de grupos', async () => {
    const fakeFetch = vi.fn(async (url) => ({
      ok: true,
      json: async () =>
        url.includes('r=32&')
          ? {
              events: [
                {
                  idEvent: 'ko1',
                  strHomeTeam: 'South Africa',
                  strAwayTeam: 'Canada',
                  intHomeScore: null,
                  intAwayScore: null,
                  strStatus: 'NS',
                  dateEvent: '2026-06-28',
                  strTime: '19:00:00',
                },
              ],
            }
          : { events: [] },
    }))
    const out = await fetchSportsDB(fakeFetch)
    const ko = out.find((e) => e.home === 'South Africa' && e.away === 'Canada')
    expect(ko).toBeTruthy()
    expect(ko.status).toBe('scheduled')
    expect(ko.fecha).toBe('2026-06-28T19:00:00Z')
    // pidió explícitamente la ronda 32 de eliminatorias
    expect(fakeFetch.mock.calls.some(([u]) => u.includes('r=32&'))).toBe(true)
  })

  it('returns null when nothing comes back', async () => {
    const fakeFetch = vi.fn(async () => ({ ok: true, json: async () => ({ events: [] }) }))
    expect(await fetchSportsDB(fakeFetch)).toBeNull()
  })
})
