import { useMemo, useState } from 'react'
import { GRUPOS } from '../data/groups.js'
import { flag } from '../data/teams.js'
import { computeStandings } from '../lib/standings.js'
import { useStored } from '../hooks/useStored.js'

const GRUPO_IDS = Object.keys(GRUPOS)

export default function GruposStandings({ tick }) {
  const matches = useStored('matches', tick) || []
  const [grupo, setGrupo] = useState(GRUPO_IDS[0])

  const table = useMemo(
    () => computeStandings(GRUPOS[grupo], matches.filter((m) => m.grupo === grupo)),
    [matches, grupo],
  )

  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
        {GRUPO_IDS.map((g) => (
          <button
            key={g}
            onClick={() => setGrupo(g)}
            className={`h-9 min-w-9 shrink-0 rounded-lg px-3 font-head font-semibold transition
              ${g === grupo ? 'bg-pitch text-bg' : 'bg-surface text-white/60'}`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-surface">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-white/10 text-xs text-white/40">
              <th className="py-2 pl-3 text-left font-medium">#</th>
              <th className="py-2 text-left font-medium">Equipo</th>
              <th className="py-2 text-center font-medium">PJ</th>
              <th className="py-2 text-center font-medium">DG</th>
              <th className="py-2 pr-3 text-center font-medium">PTS</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r, i) => {
              const zone = i < 2 ? 'border-l-2 border-pitch' : i === 2 ? 'border-l-2 border-trophy' : 'border-l-2 border-transparent'
              return (
                <tr key={r.equipo} className={`border-b border-white/5 last:border-0 ${zone}`}>
                  <td className="py-2 pl-3 text-white/50">{i + 1}</td>
                  <td className="py-2">
                    <span className="mr-1.5">{flag(r.equipo)}</span>
                    <span className="font-medium">{r.equipo}</span>
                  </td>
                  <td className="py-2 text-center text-white/70">{r.pj}</td>
                  <td className="py-2 text-center text-white/70">{r.dg > 0 ? `+${r.dg}` : r.dg}</td>
                  <td className="py-2 pr-3 text-center font-head font-bold">{r.pts}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="px-1 text-xs text-white/40">
        <span className="text-pitch">▍</span> Clasifican (1°–2°) &nbsp;·&nbsp; <span className="text-trophy">▍</span> Mejor 3°
      </p>
    </div>
  )
}
