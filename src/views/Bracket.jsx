import { useEffect, useMemo, useState } from 'react'
import { KO_MATCHES, RONDA_LABELS } from '../data/bracket.js'
import { useStored } from '../hooks/useStored.js'
import { getKnockoutPredictions, setKnockoutPrediction } from '../lib/predictions.js'
import { resolveBracket } from '../lib/bracket.js'
import { isKnockoutBettingOpen } from '../lib/matchState.js'
import Flag from '../components/Flag.jsx'
import LiveBadge from '../components/LiveBadge.jsx'
import ScoringInfo from '../components/ScoringInfo.jsx'

// Cabecera de un cruce: muestra el estado (Final / EN VIVO / a jugarse) y la fecha y hora,
// reusando el mismo criterio y look que las tarjetas de Home. `meta` es el registro de
// elimination_matches (estado/fecha/minuto), que completa applyKnockout desde la fuente.
function CrossHeader({ meta, mirror }) {
  if (!meta || (!meta.estado && !meta.fecha)) return null
  const { estado, fecha, minuto } = meta
  // La fecha y hora se muestran SIEMPRE que se conozcan, en cualquier estado.
  const fechaTxt = fecha
    ? new Date(fecha).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''
  // Apuesta cerrada (30 min antes) pero el partido aún no empezó: se avisa "Cerrada".
  const cerradaApuesta = estado !== 'finalizado' && estado !== 'en_vivo' && !isKnockoutBettingOpen(meta)
  // Indicador de estado a la izquierda: badge EN VIVO en juego; dot + etiqueta si no.
  const left =
    estado === 'en_vivo' ? (
      <LiveBadge minuto={minuto} />
    ) : (
      <span className={`flex items-center gap-1 ${mirror ? 'flex-row-reverse' : ''}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${estado === 'finalizado' ? 'bg-pitch' : 'bg-white/30'}`} />
        {estado === 'finalizado' ? 'Final' : cerradaApuesta ? '🔒 Cerrada' : 'A jugarse'}
      </span>
    )
  return (
    <div
      className={`mb-1 flex items-center justify-between gap-1 text-[10px] text-white/45 ${
        mirror ? 'flex-row-reverse' : ''
      }`}
    >
      {left}
      {fechaTxt && <span className="text-white/40">{fechaTxt}</span>}
    </div>
  )
}

// Una fila de equipo tocable dentro de un cruce. Si no hay equipo aún, muestra "A definir".
// `mirror` solo invierte la disposición visual (bandera a la derecha) para el lado derecho
// del cuadro; no cambia ningún comportamiento.
function TeamRow({ team, picked, real, locked, onPick, mirror }) {
  const disabled = !team || locked
  const showResult = picked && !!real
  const acerto = showResult && real === team
  const esGanadorReal = !!real && real === team
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(team)}
      aria-pressed={picked}
      aria-label={team || 'A definir'}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition
        ${mirror ? 'flex-row-reverse text-right' : 'text-left'}
        ${picked ? 'bg-pitch/20 ring-1 ring-pitch' : esGanadorReal ? 'bg-trophy/10 ring-1 ring-trophy/40' : 'bg-bg hover:bg-white/5'}
        ${disabled ? 'cursor-default' : ''}
        ${!team ? 'opacity-40' : ''}`}
    >
      {team ? <Flag team={team} className="h-4 w-6" /> : <span className="h-4 w-6 rounded-sm bg-white/10" />}
      <span className="flex-1 truncate">{team || 'A definir'}</span>
      {showResult && (
        <span className={`text-xs font-semibold ${acerto ? 'text-pitch' : 'text-red-400'}`}>
          {acerto ? '🟢 +20' : '🔴 0'}
        </span>
      )}
    </button>
  )
}

// Un cruce con sus dos equipos. Tocar de nuevo el elegido lo deselecciona.
function MatchCard({ teamA, teamB, ganador, real, meta, onPick, mirror }) {
  // Cruce bloqueado: ya tiene resultado real, o la apuesta cerró (30 min antes del kickoff).
  const locked = !!real || !isKnockoutBettingOpen(meta)
  const toggle = (team) => {
    if (!team || locked) return
    onPick(team === ganador ? null : team)
  }
  return (
    <div className="space-y-1 rounded-xl bg-surface p-2">
      <CrossHeader meta={meta} mirror={mirror} />
      <TeamRow team={teamA} picked={!!ganador && ganador === teamA} real={real} locked={locked} onPick={toggle} mirror={mirror} />
      <TeamRow team={teamB} picked={!!ganador && ganador === teamB} real={real} locked={locked} onPick={toggle} mirror={mirror} />
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

  const realById = useMemo(() => new Map(matches.map((m) => [m.id, m.ganador])), [matches])
  const metaById = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches])
  const resolved = useMemo(() => resolveBracket(preds, realById), [preds, realById])

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
                meta={metaById.get(m.id) || null}
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
                  meta={metaById.get(finalMatch.id) || null}
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

              {/* 3.º y 4.º puesto: lo juegan los perdedores de las semis. */}
              {(() => {
                const tercer = KO_MATCHES.find((m) => m.esTercerPuesto)
                const tr = resolved[tercer.id] || { teamA: null, teamB: null, ganador: null }
                const realTercer = realById.get(tercer.id) || null
                const tercero = realTercer || tr.ganador
                const cuarto = tercero ? (tercero === tr.teamA ? tr.teamB : tr.teamA) : null
                return (
                  <div className="w-full space-y-1">
                    <h4 className="text-center text-[11px] font-semibold uppercase tracking-wide text-white/40">
                      {RONDA_LABELS.tercer}
                    </h4>
                    <MatchCard
                      teamA={tr.teamA}
                      teamB={tr.teamB}
                      ganador={tr.ganador}
                      real={realTercer}
                      meta={metaById.get(tercer.id) || null}
                      onPick={(team) => handlePick(tercer.id, team)}
                    />
                    <p className="text-center text-xs text-white/60">
                      🥉 3.º: <span className="font-semibold text-white/80">{tercero || '—'}</span>
                      {' · '}4.º: <span className="font-semibold text-white/80">{cuarto || '—'}</span>
                    </p>
                  </div>
                )
              })()}
            </div>
          </div>

          {RIGHT_COLS.map(Column)}
        </div>
      </div>
    </div>
  )
}
