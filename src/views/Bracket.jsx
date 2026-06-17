import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { GRUPOS } from '../data/groups.js'
import { POSICION_LABELS } from '../data/bracket.js'
import { useStored } from '../hooks/useStored.js'
import { getKnockoutPredictions, setKnockoutPrediction } from '../lib/predictions.js'
import Flag from '../components/Flag.jsx'

const GRUPO_IDS = Object.keys(GRUPOS)

export default function Bracket({ alias, tick }) {
  const slots = useStored('elimination_slots', tick) || []
  const [preds, setPreds] = useState([])

  useEffect(() => {
    getKnockoutPredictions(alias).then(setPreds)
  }, [alias, tick])

  const pickFor = (slotId) => preds.find((p) => p.slotId === slotId)?.equipoElegido || ''
  const confirmedFor = (slotId) => slots.find((s) => s.id === slotId)?.equipoClasificado || null

  const handlePick = async (slotId, team) => {
    const list = await setKnockoutPrediction(alias, slotId, team || null)
    setPreds([...list])
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/50">
        Elegí quién sale <span className="font-semibold text-pitch">1°</span> y{' '}
        <span className="font-semibold text-trophy">2°</span> en cada grupo. Avanzan los dos primeros.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {GRUPO_IDS.map((grupo, gi) => {
          const teams = GRUPOS[grupo]
          const id1 = `pos_${grupo}_1`
          const id2 = `pos_${grupo}_2`
          const pick1 = pickFor(id1)
          const pick2 = pickFor(id2)

          return (
            <motion.div
              key={grupo}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.03 }}
              className="rounded-2xl border border-white/[0.08] bg-surface p-3"
            >
              <h3 className="mb-2 font-head text-base font-bold">Grupo {grupo}</h3>

              {[
                { id: id1, pick: pick1, other: pick2, badge: 'bg-pitch text-bg', confirmed: confirmedFor(id1) },
                { id: id2, pick: pick2, other: pick1, badge: 'bg-trophy text-bg', confirmed: confirmedFor(id2) },
              ].map(({ id, pick, other, badge, confirmed }, idx) => {
                const acerto = confirmed && pick === confirmed
                const fallo = confirmed && pick && pick !== confirmed
                return (
                  <div key={id} className="mb-2 last:mb-0">
                    <div className="mb-1 flex items-center gap-2 text-xs text-white/50">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full font-head text-[11px] font-bold ${badge}`}>
                        {idx + 1}°
                      </span>
                      <span>{POSICION_LABELS[idx + 1]}</span>
                      {confirmed && <span className="ml-auto">{acerto ? '🟢' : fallo ? '🔴' : ''}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {pick ? <Flag team={pick} className="h-5 w-7" /> : <span className="h-5 w-7 rounded-sm bg-white/10" />}
                      <select
                        value={pick}
                        disabled={!!confirmed}
                        onChange={(e) => handlePick(id, e.target.value)}
                        aria-label={`${POSICION_LABELS[idx + 1]} - Grupo ${grupo}`}
                        className="h-9 flex-1 rounded-lg bg-bg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch disabled:opacity-60"
                      >
                        <option value="">— Elegir —</option>
                        {teams.map((t) => (
                          <option key={t} value={t} disabled={t === other}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    {confirmed && <p className="mt-1 text-xs text-white/50">Real: {confirmed}</p>}
                  </div>
                )
              })}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
