import { motion } from 'framer-motion'
import { isBettingOpen } from '../lib/matchState.js'
import Flag from './Flag.jsx'
import LiveBadge from './LiveBadge.jsx'
import ScoreInput from './ScoreInput.jsx'

export default function MatchCard({ match, prediction, onPredict, onOpen }) {
  const open = isBettingOpen(match)
  const hasPred = prediction?.pronosticoA != null && prediction?.pronosticoB != null
  const showOfficial = match.estado === 'en_vivo' || match.estado === 'finalizado'

  // dot de estado
  const dot =
    match.estado === 'en_vivo'
      ? 'bg-danger'
      : match.estado === 'finalizado'
        ? 'bg-pitch'
        : open
          ? hasPred
            ? 'bg-trophy'
            : 'bg-white/30'
          : 'bg-white/40'

  // texto de estado (izquierda)
  const statusText =
    match.estado === 'finalizado'
      ? 'Final'
      : match.estado === 'en_vivo'
        ? ''
        : open
          ? hasPred
            ? 'Pronóstico cargado'
            : 'Sin pronóstico'
          : 'Apuestas cerradas'

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-surface p-3 shadow-lg shadow-black/20">
      <button
        type="button"
        onClick={onOpen}
        className="mb-2 flex w-full items-center justify-between text-xs text-white/50"
      >
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          {statusText}
        </span>
        {match.estado === 'en_vivo' && <LiveBadge minuto={match.minuto} />}
        {match.estado === 'programado' && (
          <span className="text-white/40">
            {new Date(match.fecha).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {!open && ' · a jugarse'}
          </span>
        )}
      </button>

      <div className="flex items-center justify-between gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={onOpen}
          className="flex flex-1 items-center gap-2 truncate text-left"
          aria-label={`Ver detalle de ${match.equipoA} vs ${match.equipoB}`}
        >
          <Flag team={match.equipoA} className="h-5 w-7" />
          <span className="truncate font-head text-base font-semibold">{match.equipoA}</span>
        </motion.button>

        {open ? (
          <div
            className="flex items-center gap-1 px-1"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ScoreInput
              label={`Goles ${match.equipoA}`}
              value={prediction?.pronosticoA ?? null}
              disabled={false}
              onChange={(v) => onPredict(v, prediction?.pronosticoB ?? null)}
            />
            <span className="text-white/40">:</span>
            <ScoreInput
              label={`Goles ${match.equipoB}`}
              value={prediction?.pronosticoB ?? null}
              disabled={false}
              onChange={(v) => onPredict(prediction?.pronosticoA ?? null, v)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="flex flex-col items-center px-2"
            aria-label="Ver detalle"
          >
            <span className="font-head text-2xl font-bold tabular-nums">
              {showOfficial ? (
                <>
                  {match.resultadoA ?? 0}
                  <span className="mx-1 text-white/40">:</span>
                  {match.resultadoB ?? 0}
                </>
              ) : (
                <span className="text-white/30">— : —</span>
              )}
            </span>
            {match.estado === 'finalizado' && prediction?.puntos != null ? (
              <span
                className={`mt-0.5 rounded-md px-1.5 text-[11px] font-bold
                  ${prediction.puntos > 0 ? 'bg-trophy/20 text-trophy' : 'bg-white/10 text-white/50'}`}
              >
                +{prediction.puntos} pts
              </span>
            ) : (
              hasPred && (
                <span className="text-[11px] text-white/40">
                  tu pron.: {prediction.pronosticoA}:{prediction.pronosticoB}
                </span>
              )
            )}
          </button>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={onOpen}
          className="flex flex-1 items-center justify-end gap-2 truncate text-right"
          aria-label={`Ver detalle de ${match.equipoA} vs ${match.equipoB}`}
        >
          <span className="truncate font-head text-base font-semibold">{match.equipoB}</span>
          <Flag team={match.equipoB} className="h-5 w-7" />
        </motion.button>
      </div>
    </div>
  )
}
