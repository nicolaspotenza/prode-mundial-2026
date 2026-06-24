import { useEffect, useMemo, useState } from 'react'
import { KO_MATCHES, RONDA_LABELS } from '../data/bracket.js'
import { useStored } from '../hooks/useStored.js'
import { getKnockoutPredictions, setKnockoutPrediction } from '../lib/predictions.js'
import { resolveBracket } from '../lib/bracket.js'
import Flag from '../components/Flag.jsx'
import ScoringInfo from '../components/ScoringInfo.jsx'

// Una fila de equipo tocable dentro de un cruce. Si no hay equipo aún, muestra "A definir".
// `mirror` solo invierte la disposición visual (bandera a la derecha) para el lado derecho
// del cuadro; no cambia ningún comportamiento.
function TeamRow({ team, picked, real, onPick, mirror }) {
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
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition
        ${mirror ? 'flex-row-reverse text-right' : 'text-left'}
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
function MatchCard({ teamA, teamB, ganador, real, onPick, mirror }) {
  const toggle = (team) => {
    if (!team) return
    onPick(team === ganador ? null : team)
  }
  return (
    <div className="space-y-1 rounded-xl bg-surface p-2">
      <TeamRow team={teamA} picked={!!ganador && ganador === teamA} real={real} onPick={toggle} mirror={mirror} />
      <TeamRow team={teamB} picked={!!ganador && ganador === teamB} real={real} onPick={toggle} mirror={mirror} />
    </div>
  )
}

// Columnas del cuadro en orden de "embudo" hacia el centro. La mitad izquierda usa los
// cruces 1..N/2 de cada ronda y la derecha los N/2+1..N (el árbol ya está armado así:
// octavos_i sale de dieciseisavos 2i-1 y 2i, etc.). Es solo el orden de pintado.
const LEFT_COLS = [
  ['dieciseisavos', 'L'],
  ['octavos', 'L'],
  ['cuartos', 'L'],
  ['semis', 'L'],
]
const RIGHT_COLS = [
  ['semis', 'R'],
  ['cuartos', 'R'],
  ['octavos', 'R'],
  ['dieciseisavos', 'R'],
]

function halfMatches(ronda, side) {
  const ms = KO_MATCHES.filter((m) => m.ronda === ronda)
  const mid = Math.ceil(ms.length / 2)
  return side === 'L' ? ms.slice(0, mid) : ms.slice(mid)
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

  // Pinta una columna de una ronda/lado: el área de cruces se reparte verticalmente
  // (justify-around) dentro de la altura común, dando el efecto de llaves que convergen.
  const Column = ([ronda, side]) => {
    const mirror = side === 'R'
    return (
      <div key={`${ronda}_${side}`} className="flex w-40 shrink-0 flex-col sm:w-44">
        <h3
          className={`mb-2 h-4 font-head text-xs font-semibold uppercase tracking-wide text-white/50 ${
            mirror ? 'text-right' : 'text-left'
          }`}
        >
          {RONDA_LABELS[ronda]}
        </h3>
        <div className="flex flex-1 flex-col justify-around gap-2">
          {halfMatches(ronda, side).map((m) => {
            const r = resolved[m.id] || { teamA: null, teamB: null, ganador: null }
            return (
              <MatchCard
                key={m.id}
                teamA={r.teamA}
                teamB={r.teamB}
                ganador={r.ganador}
                real={realById.get(m.id) || null}
                mirror={mirror}
                onPick={(team) => handlePick(m.id, team)}
              />
            )
          })}
        </div>
      </div>
    )
  }

  const finalMatch = KO_MATCHES.find((m) => m.ronda === 'final')
  const finalResolved = resolved[finalMatch.id] || { teamA: null, teamB: null, ganador: null }

  return (
    <div className="space-y-3">
      <ScoringInfo variant="eliminatorias" />

      <p className="text-sm text-white/50">
        Tocá el equipo que avanza en cada cruce. El ganador sube a la ronda siguiente
        hasta llegar al <span className="font-semibold text-trophy">campeón</span>.
      </p>

      {/* Cuadro enfrentado: mitad izquierda → centro (Final + 🏆) → mitad derecha en espejo.
          Scroll horizontal en mobile (es ancho por diseño); las columnas no se achican. */}
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex items-stretch gap-2" style={{ minWidth: 'max-content' }}>
          {LEFT_COLS.map(Column)}

          {/* Centro: Final + Campeón */}
          <div className="flex w-32 shrink-0 flex-col sm:w-36">
            <h3 className="mb-2 h-4 text-center font-head text-xs font-semibold uppercase tracking-wide text-trophy">
              Final
            </h3>
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <div className="w-full">
                <MatchCard
                  teamA={finalResolved.teamA}
                  teamB={finalResolved.teamB}
                  ganador={finalResolved.ganador}
                  real={realById.get(finalMatch.id) || null}
                  onPick={(team) => handlePick(finalMatch.id, team)}
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl">🏆</span>
                {campeon ? (
                  <Flag team={campeon} className="h-7 w-10" />
                ) : (
                  <span className="h-7 w-10 rounded-sm bg-white/10" />
                )}
                <span className="text-center text-sm font-semibold">{campeon || '—'}</span>
              </div>
            </div>
          </div>

          {RIGHT_COLS.map(Column)}
        </div>
      </div>
    </div>
  )
}
