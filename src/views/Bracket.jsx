import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GRUPOS } from '../data/groups.js'
import { POSICION_LABELS, KO_RONDAS, RONDA_LABELS } from '../data/bracket.js'
import { useStored } from '../hooks/useStored.js'
import { getKnockoutPredictions, setKnockoutPrediction } from '../lib/predictions.js'
import Flag from '../components/Flag.jsx'
import ScoringInfo from '../components/ScoringInfo.jsx'

const GRUPO_IDS = Object.keys(GRUPOS)

/* ---------- Sub-sección: Clasificados (1° y 2° por grupo) ---------- */
function Clasificados({ slots, preds, onPick }) {
  const pickFor = (slotId) => preds.find((p) => p.slotId === slotId)?.equipoElegido || ''
  const confirmedFor = (slotId) => slots.find((s) => s.id === slotId)?.equipoClasificado || null

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
                        onChange={(e) => onPick(id, e.target.value)}
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

/* ---------- Sub-sección: Llaves (octavos → final), sembrada por los clasificados ---------- */
function Llaves({ slots, preds, qualified, onPick }) {
  const pickFor = (slotId) => preds.find((p) => p.slotId === slotId)?.equipoElegido || ''
  const confirmedFor = (slotId) => slots.find((s) => s.id === slotId)?.equipoClasificado || null
  const rondasVisibles = KO_RONDAS.filter((r) => r !== 'campeon')

  if (qualified.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-surface p-6 text-center text-white/50">
        Primero elegí los clasificados (1° y 2° de cada grupo) en la pestaña{' '}
        <span className="font-semibold text-pitch">Clasificados</span>. Las llaves se arman con esos equipos.
      </div>
    )
  }

  const campeon = pickFor('ko_campeon_1')

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">
        Completá quién avanza en cada instancia. Solo aparecen tus <span className="text-pitch">clasificados</span>.
      </p>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {rondasVisibles.map((ronda) => {
            const roundSlots = slots.filter((s) => s.ronda === ronda)
            return (
              <div key={ronda} className="w-44 shrink-0 space-y-2">
                <h3 className="font-head text-sm font-semibold uppercase tracking-wide text-white/50">
                  {RONDA_LABELS[ronda]}
                </h3>
                {roundSlots.map((slot) => {
                  const pick = pickFor(slot.id)
                  const confirmed = confirmedFor(slot.id)
                  const acerto = confirmed && pick === confirmed
                  const fallo = confirmed && pick && pick !== confirmed
                  const ring = acerto
                    ? 'ring-2 ring-pitch'
                    : fallo
                      ? 'ring-2 ring-danger'
                      : pick
                        ? 'ring-1 ring-trophy/50'
                        : 'ring-1 ring-white/10'
                  return (
                    <div key={slot.id} className={`rounded-xl bg-surface p-2 ${ring}`}>
                      <div className="mb-1 flex items-center gap-2">
                        {pick ? <Flag team={pick} className="h-4 w-6" /> : <span className="h-4 w-6 rounded-sm bg-white/10" />}
                        {confirmed && <span className="ml-auto text-xs">{acerto ? '🟢' : fallo ? '🔴' : ''}</span>}
                      </div>
                      <select
                        value={pick}
                        disabled={!!confirmed}
                        onChange={(e) => onPick(slot.id, e.target.value)}
                        aria-label={`${RONDA_LABELS[ronda]} ${slot.posicion}`}
                        className="h-9 w-full rounded-lg bg-bg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch disabled:opacity-60"
                      >
                        <option value="">— Elegir —</option>
                        {qualified.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Campeón */}
          <div className="flex w-32 shrink-0 flex-col items-center justify-center gap-2">
            <span className="text-4xl">🏆</span>
            <span className="font-head text-sm text-white/50">Campeón</span>
            {campeon ? <Flag team={campeon} className="h-7 w-10" /> : <span className="h-7 w-10 rounded-sm bg-white/10" />}
            <select
              value={campeon}
              onChange={(e) => onPick('ko_campeon_1', e.target.value)}
              aria-label="Campeón"
              className="h-9 w-full rounded-lg bg-bg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-trophy"
            >
              <option value="">— Elegir —</option>
              {qualified.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Contenedor con toggle ---------- */
export default function Bracket({ alias, tick }) {
  const slots = useStored('elimination_slots', tick) || []
  const [preds, setPreds] = useState([])
  const [sub, setSub] = useState('clasificados') // 'clasificados' | 'llaves'

  useEffect(() => {
    getKnockoutPredictions(alias).then(setPreds)
  }, [alias, tick])

  // equipos que el usuario hizo clasificar (slots pos_*), únicos y ordenados
  const qualified = useMemo(() => {
    const set = preds.filter((p) => p.slotId.startsWith('pos_') && p.equipoElegido).map((p) => p.equipoElegido)
    return [...new Set(set)].sort((a, b) => a.localeCompare(b))
  }, [preds])

  const handlePick = async (slotId, team) => {
    const list = await setKnockoutPrediction(alias, slotId, team || null)
    setPreds([...list])
  }

  return (
    <div className="space-y-3">
      <ScoringInfo variant="eliminatorias" />

      {/* segmented toggle */}
      <div className="flex rounded-xl bg-surface p-1">
        {[
          ['clasificados', 'Clasificados'],
          ['llaves', 'Llaves'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            className={`h-9 flex-1 rounded-lg font-head text-sm font-semibold transition
              ${sub === id ? 'bg-pitch text-bg' : 'text-white/60'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={sub}
          initial={{ opacity: 0, x: sub === 'llaves' ? 24 : -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: sub === 'llaves' ? -24 : 24 }}
          transition={{ duration: 0.2 }}
        >
          {sub === 'clasificados' ? (
            <Clasificados slots={slots} preds={preds} onPick={handlePick} />
          ) : (
            <Llaves slots={slots} preds={preds} qualified={qualified} onPick={handlePick} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
