import { motion } from 'framer-motion'
import { flag } from '../data/teams.js'
import { isBloqueado } from '../lib/matchState.js'
import LiveBadge from './LiveBadge.jsx'
import ScoreInput from './ScoreInput.jsx'

const ESTADO_CHIP = {
  programado: { dot: 'bg-white/30', label: '' },
  en_vivo: { dot: 'bg-danger', label: '' },
  finalizado: { dot: 'bg-pitch', label: 'Final' },
}

export default function MatchCard({ match, prediction, onPredict, onOpen }) {
  const locked = isBloqueado(match.estado)
  const hasPred = prediction?.pronosticoA != null && prediction?.pronosticoB != null
  const chipColor = !hasPred && !locked ? 'bg-white/30' : ESTADO_CHIP[match.estado]?.dot

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-surface p-3 shadow-lg shadow-black/20">
      <div className="mb-2 flex items-center justify-between text-xs text-white/50">
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${chipColor}`} />
          {!hasPred && !locked ? 'Sin pronóstico' : hasPred && !locked ? 'Pronóstico cargado' : ESTADO_CHIP[match.estado]?.label}
        </span>
        {match.estado === 'en_vivo' && <LiveBadge minuto={match.minuto} />}
        {match.estado === 'finalizado' && prediction?.puntos != null && (
          <span className="font-semibold text-trophy">+{prediction.puntos} pts</span>
        )}
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex flex-1 items-center gap-2 truncate">
          <span className="text-xl">{flag(match.equipoA)}</span>
          <span className="truncate font-head text-base font-semibold">{match.equipoA}</span>
        </div>

        {locked ? (
          <div className="px-2 font-head text-2xl font-bold tabular-nums">
            {match.resultadoA ?? '-'}<span className="mx-1 text-white/40">:</span>{match.resultadoB ?? '-'}
          </div>
        ) : (
          <div className="flex items-center gap-1 px-1">
            <ScoreInput
              label={`Goles ${match.equipoA}`}
              value={prediction?.pronosticoA ?? null}
              disabled={locked}
              onChange={(v) => onPredict(v, prediction?.pronosticoB ?? null)}
            />
            <span className="text-white/40">:</span>
            <ScoreInput
              label={`Goles ${match.equipoB}`}
              value={prediction?.pronosticoB ?? null}
              disabled={locked}
              onChange={(v) => onPredict(prediction?.pronosticoA ?? null, v)}
            />
          </div>
        )}

        <div className="flex flex-1 items-center justify-end gap-2 truncate">
          <span className="truncate text-right font-head text-base font-semibold">{match.equipoB}</span>
          <span className="text-xl">{flag(match.equipoB)}</span>
        </div>
      </motion.button>
    </div>
  )
}
