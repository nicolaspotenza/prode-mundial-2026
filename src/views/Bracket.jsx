import { useEffect, useMemo, useState } from 'react'
import { KO_MATCHES, KO_RONDAS, RONDA_LABELS } from '../data/bracket.js'
import { useStored } from '../hooks/useStored.js'
import { getKnockoutPredictions, setKnockoutPrediction } from '../lib/predictions.js'
import { resolveBracket } from '../lib/bracket.js'
import Flag from '../components/Flag.jsx'
import ScoringInfo from '../components/ScoringInfo.jsx'

// Una fila de equipo tocable dentro de un cruce. Si no hay equipo aún, muestra "A definir".
function TeamRow({ team, picked, real, onPick }) {
  const disabled = !team
  const showResult = picked && !!real
  const acerto = showResult && real === team
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(team)}
      aria-pressed={picked}
      aria-label={team || 'A definir'}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition
        ${picked ? 'bg-pitch/20 ring-1 ring-pitch' : 'bg-bg hover:bg-white/5'}
        ${disabled ? 'cursor-default opacity-40' : ''}`}
    >
      {team ? <Flag team={team} className="h-4 w-6" /> : <span className="h-4 w-6 rounded-sm bg-white/10" />}
      <span className="flex-1 truncate">{team || 'A definir'}</span>
      {showResult && <span>{acerto ? '🟢' : '🔴'}</span>}
    </button>
  )
}

// Un cruce con sus dos equipos. Tocar de nuevo el elegido lo deselecciona.
function MatchCard({ teamA, teamB, ganador, real, onPick }) {
  const toggle = (team) => {
    if (!team) return
    onPick(team === ganador ? null : team)
  }
  return (
    <div className="space-y-1 rounded-xl bg-surface p-2">
      <TeamRow team={teamA} picked={!!ganador && ganador === teamA} real={real} onPick={toggle} />
      <TeamRow team={teamB} picked={!!ganador && ganador === teamB} real={real} onPick={toggle} />
    </div>
  )
}

export default function Bracket({ alias, tick }) {
  const matches = useStored('elimination_matches', tick) || []
  const [preds, setPreds] = useState([])

  useEffect(() => {
    getKnockoutPredictions(alias).then(setPreds).catch(() => {})
  }, [alias, tick])

  const resolved = useMemo(() => resolveBracket(preds), [preds])
  const realById = useMemo(() => new Map(matches.map((m) => [m.id, m.ganador])), [matches])

  const handlePick = async (matchId, team) => {
    try {
      const list = await setKnockoutPrediction(alias, matchId, team)
      setPreds([...list])
    } catch {
      /* silent degradation per spec */
    }
  }

  const campeon = resolved['ko_final_1']?.ganador || null

  return (
    <div className="space-y-3">
      <ScoringInfo variant="eliminatorias" />

      <p className="text-sm text-white/50">
        Tocá el equipo que avanza en cada cruce. El ganador sube a la ronda siguiente
        hasta llegar al <span className="font-semibold text-trophy">campeón</span>.
      </p>

      {/* Scroll horizontal con snap por ronda: en mobile cada ronda ocupa casi todo
          el ancho (se desliza y encaja una por una, sin achicarse); en pantallas
          grandes (sm+) vuelven a verse varias columnas a la vez. */}
      <div className="-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {KO_RONDAS.map((ronda) => {
            const roundMatches = KO_MATCHES.filter((m) => m.ronda === ronda)
            return (
              <div key={ronda} className="w-[80vw] max-w-[18rem] shrink-0 snap-start space-y-2 sm:w-52">
                <h3 className="font-head text-sm font-semibold uppercase tracking-wide text-white/50">
                  {RONDA_LABELS[ronda]}
                </h3>
                {roundMatches.map((m) => {
                  const r = resolved[m.id] || { teamA: null, teamB: null, ganador: null }
                  return (
                    <MatchCard
                      key={m.id}
                      teamA={r.teamA}
                      teamB={r.teamB}
                      ganador={r.ganador}
                      real={realById.get(m.id) || null}
                      onPick={(team) => handlePick(m.id, team)}
                    />
                  )
                })}
              </div>
            )
          })}

          {/* Campeón */}
          <div className="flex w-[60vw] max-w-[10rem] shrink-0 snap-start flex-col items-center justify-center gap-2 sm:w-32">
            <span className="text-4xl">🏆</span>
            <span className="font-head text-sm text-white/50">Campeón</span>
            {campeon ? (
              <Flag team={campeon} className="h-7 w-10" />
            ) : (
              <span className="h-7 w-10 rounded-sm bg-white/10" />
            )}
            <span className="text-center text-sm font-semibold">{campeon || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
