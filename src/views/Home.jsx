import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays } from 'lucide-react'
import { useStored } from '../hooks/useStored.js'
import { getGroupPredictions, setGroupPrediction } from '../lib/predictions.js'
import MatchCard from '../components/MatchCard.jsx'

function sameDay(iso, ref) {
  const d = new Date(iso)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate()
}

function timeAgo(iso) {
  if (!iso) return 'nunca'
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'recién'
  if (mins < 60) return `hace ${mins} min`
  const h = Math.round(mins / 60)
  return `hace ${h} h`
}

export default function Home({ alias, tick, lastSync, onOpenMatch }) {
  const matches = useStored('matches', tick) || []
  const [preds, setPreds] = useState([])

  useEffect(() => {
    getGroupPredictions(alias).then(setPreds)
  }, [alias, tick])

  const now = new Date()
  const today = useMemo(
    () =>
      matches
        .filter((m) => sameDay(m.fecha, now))
        .sort((a, b) => {
          // en vivo primero, luego por horario
          const live = (m) => (m.estado === 'en_vivo' ? 0 : 1)
          return live(a) - live(b) || new Date(a.fecha) - new Date(b.fecha)
        }),
    [matches],
  )
  const next = useMemo(() => {
    return matches
      .filter((m) => m.estado === 'programado' && new Date(m.fecha) > now)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))[0]
  }, [matches])

  const predFor = (id) => preds.find((p) => p.matchId === id)
  const handlePredict = async (matchId, a, b) => {
    const list = await setGroupPrediction(alias, matchId, a, b)
    setPreds([...list])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-head text-xl font-bold">
          <CalendarDays size={20} className="text-pitch" /> Partidos de hoy
        </h2>
        <span className="text-xs text-white/40">Actualizado {timeAgo(lastSync)}</span>
      </div>

      {today.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-surface p-5 text-center">
          <p className="text-white/60">No hay partidos hoy.</p>
          {next && (
            <p className="mt-2 text-sm text-white/40">
              Próximo: {next.equipoA} vs {next.equipoB} ·{' '}
              {new Date(next.fecha).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {today.map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <MatchCard
                match={m}
                prediction={predFor(m.id)}
                onPredict={(a, b) => handlePredict(m.id, a, b)}
                onOpen={() => onOpenMatch(m)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
