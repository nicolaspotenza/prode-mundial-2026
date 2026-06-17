import { motion } from 'framer-motion'
import { buildRanking } from '../lib/ranking.js'
import { useStored } from '../hooks/useStored.js'

export default function Ranking({ alias, tick }) {
  const users = useStored('users', tick) || []
  const rows = buildRanking(users)

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-surface">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-white/10 text-xs text-white/40">
            <th className="py-2 pl-3 text-left font-medium">#</th>
            <th className="py-2 text-left font-medium">Alias</th>
            <th className="py-2 text-center font-medium">Gru</th>
            <th className="py-2 text-center font-medium">Eli</th>
            <th className="py-2 pr-3 text-center font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-white/40">
                Todavía no hay jugadores con puntos.
              </td>
            </tr>
          )}
          {rows.map((u) => {
            const me = u.alias === alias
            return (
              <motion.tr
                layout
                key={u.alias}
                className={`border-b border-white/5 last:border-0 ${me ? 'bg-pitch/10' : ''}`}
              >
                <td className="py-2.5 pl-3">
                  {u.pos === 1 ? '🥇' : u.pos === 2 ? '🥈' : u.pos === 3 ? '🥉' : u.pos}
                </td>
                <td className={`py-2.5 ${me ? 'font-semibold text-pitch' : 'font-medium'}`}>{u.alias}</td>
                <td className="py-2.5 text-center text-white/70">{u.puntosGrupos || 0}</td>
                <td className="py-2.5 text-center text-white/70">{u.puntosEliminatorias || 0}</td>
                <td className="py-2.5 pr-3 text-center font-head font-bold text-trophy">{u.total}</td>
              </motion.tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
