import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { isBloqueado } from '../lib/matchState.js'
import { useStored } from '../hooks/useStored.js'
import { getGroupPredictions, getOthersGroupPredictions } from '../lib/predictions.js'
import Flag from './Flag.jsx'
import LiveBadge from './LiveBadge.jsx'

function EventRow({ ev }) {
  const icon = ev.tipo === 'gol' ? '⚽' : ev.tipo === 'tarjeta_amarilla' ? '🟨' : ev.tipo === 'tarjeta_roja' ? '🟥' : '•'
  return (
    <li className="flex items-center gap-2 py-1 text-sm">
      <span aria-hidden="true">{icon}</span>
      <span className="font-medium">{ev.jugador}</span>
      {ev.minuto != null && <span className="text-white/50">{ev.minuto}'</span>}
      {ev.esPenal && <span className="text-white/50">(pen)</span>}
      <span className="ml-auto text-white/50">{ev.equipo}</span>
    </li>
  )
}

export default function MatchDetail({ match, alias, onClose }) {
  const eventos = useStored(match ? `eventos_partido:${match.id}` : null, match?.id) || []
  const [prediction, setPrediction] = useState(null)
  const [others, setOthers] = useState([])

  useEffect(() => {
    if (match?.fase === 'grupos' && alias) {
      getGroupPredictions(alias).then((list) => setPrediction(list.find((p) => p.matchId === match.id) || null))
      getOthersGroupPredictions(match.id, alias).then(setOthers)
    } else {
      setPrediction(null)
      setOthers([])
    }
  }, [match, alias])

  if (!match) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-md rounded-t-3xl border border-white/[0.08] bg-surface p-5 sm:rounded-3xl"
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-white/40">
              {match.fase === 'grupos' ? `Grupo ${match.grupo}` : 'Eliminatorias'}
            </span>
            <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 hover:bg-white/10">
              <X size={20} />
            </button>
          </div>

          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex flex-col items-center gap-1 flex-1">
              <Flag team={match.equipoA} className="h-9 w-12" />
              <span className="text-center font-head font-semibold">{match.equipoA}</span>
            </div>
            <div className="text-center">
              {isBloqueado(match.estado) ? (
                <div className="font-head text-4xl font-bold tabular-nums">
                  {match.resultadoA ?? 0}<span className="mx-1 text-white/40">:</span>{match.resultadoB ?? 0}
                </div>
              ) : (
                <div className="text-sm text-white/50">{new Date(match.fecha).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              )}
              {match.estado === 'en_vivo' && <div className="mt-1"><LiveBadge minuto={match.minuto} /></div>}
            </div>
            <div className="flex flex-col items-center gap-1 flex-1">
              <Flag team={match.equipoB} className="h-9 w-12" />
              <span className="text-center font-head font-semibold">{match.equipoB}</span>
            </div>
          </div>

          {prediction?.pronosticoA != null && (
            <div className="mb-3 rounded-xl bg-bg/60 p-2 text-center text-sm">
              Tu pronóstico: <span className="font-semibold">{prediction.pronosticoA} : {prediction.pronosticoB}</span>
              {prediction.puntos != null && <span className="ml-2 font-semibold text-trophy">+{prediction.puntos} pts</span>}
            </div>
          )}

          {match.fase === 'grupos' && others.length > 0 && (
            <div className="mb-3">
              <h3 className="mb-1 font-head text-sm uppercase tracking-wide text-white/40">Otros jugadores</h3>
              <ul className="divide-y divide-white/5">
                {others.map((o) => (
                  <li key={o.alias} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className="truncate font-medium">{o.alias}</span>
                    <span className="ml-auto font-semibold tabular-nums">{o.pronosticoA} : {o.pronosticoB}</span>
                    {o.puntos != null && <span className="w-12 text-right font-semibold text-trophy">+{o.puntos}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="mb-1 font-head text-sm uppercase tracking-wide text-white/40">Eventos</h3>
            {eventos.length === 0 ? (
              <p className="py-2 text-sm text-white/40">Sin eventos cargados.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {eventos.map((ev, i) => (
                  <EventRow key={i} ev={ev} />
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
