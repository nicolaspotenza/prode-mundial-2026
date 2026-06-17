import { useEffect, useMemo, useState } from 'react'
import { GRUPOS } from '../data/groups.js'
import { flag } from '../data/teams.js'
import { BRACKET, RONDA_LABELS } from '../data/bracket.js'
import { useStored } from '../hooks/useStored.js'
import { getKnockoutPredictions, setKnockoutPrediction } from '../lib/predictions.js'

const RONDAS = ['dieciseisavos', 'octavos', 'cuartos', 'semis', 'final']
const ALL_TEAMS = Object.values(GRUPOS).flat().sort((a, b) => a.localeCompare(b))

export default function Bracket({ alias, tick }) {
  const slots = useStored('elimination_slots', tick) || BRACKET
  const [preds, setPreds] = useState([])

  useEffect(() => {
    getKnockoutPredictions(alias).then(setPreds)
  }, [alias, tick])

  const predFor = (slotId) => preds.find((p) => p.slotId === slotId)

  const handlePick = async (slotId, team) => {
    const list = await setKnockoutPrediction(alias, slotId, team || null)
    setPreds([...list])
  }

  const byRonda = useMemo(() => {
    const map = {}
    RONDAS.forEach((r) => (map[r] = slots.filter((s) => s.ronda === r)))
    return map
  }, [slots])

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
        {RONDAS.map((ronda) => (
          <div key={ronda} className="w-44 shrink-0 space-y-2">
            <h3 className="sticky top-0 font-head text-sm font-semibold uppercase tracking-wide text-white/50">
              {RONDA_LABELS[ronda]}
            </h3>
            {byRonda[ronda].map((slot) => {
              const pick = predFor(slot.id)?.equipoElegido || ''
              const confirmed = slot.equipoClasificado
              const acerto = confirmed && pick === confirmed
              const fallo = confirmed && pick && pick !== confirmed
              const ring = acerto ? 'ring-2 ring-pitch' : fallo ? 'ring-2 ring-danger' : pick ? 'ring-1 ring-trophy/50' : 'ring-1 ring-white/10'
              return (
                <div key={slot.id} className={`rounded-xl bg-surface p-2 ${ring}`}>
                  <div className="mb-1 flex items-center gap-1 text-xs text-white/40">
                    <span>{pick ? flag(pick) : '⬜'}</span>
                    <span>#{slot.posicion}</span>
                    {confirmed && <span className="ml-auto">{acerto ? '🟢' : fallo ? '🔴' : ''}</span>}
                  </div>
                  <select
                    value={pick}
                    disabled={!!confirmed}
                    onChange={(e) => handlePick(slot.id, e.target.value)}
                    aria-label={`${RONDA_LABELS[ronda]} posición ${slot.posicion}`}
                    className="h-9 w-full rounded-lg bg-bg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch disabled:opacity-60"
                  >
                    <option value="">— Elegir —</option>
                    {ALL_TEAMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {confirmed && <p className="mt-1 text-xs text-white/50">Clasificó: {flag(confirmed)} {confirmed}</p>}
                </div>
              )
            })}
          </div>
        ))}
        <div className="flex w-24 shrink-0 flex-col items-center justify-center">
          <span className="text-4xl">🏆</span>
          <span className="font-head text-sm text-white/50">Campeón</span>
        </div>
      </div>
    </div>
  )
}
